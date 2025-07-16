"""
Base analyzer class with prompt configuration and web search support.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import os
from urllib.parse import urlparse
from openai import OpenAI
from ..core.config import PipelineConfig
from ..core.prompt_config import PromptConfig
from ..utils.logging import setup_logger


class BaseAnalyzer(ABC):
    """Base class for all analyzers with prompt configuration and web search support."""
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        """Initialize analyzer with configuration.
        
        Args:
            config: Pipeline configuration
            prompt_config: Optional prompt configuration instance
        """
        self.config = config
        self.prompt_config = prompt_config or PromptConfig()
        self.client = OpenAI(api_key=config.openai.api_key)
        self.logger = setup_logger(self.__class__.__name__)
        
        # Determine if Responses API is available
        self.has_responses_api = hasattr(self.client, 'responses')
        if self.has_responses_api:
            self.logger.info("OpenAI Responses API is available")
        else:
            self.logger.warning("OpenAI Responses API not available, web search will be disabled")
    
    @property
    def analyzer_name(self) -> str:
        """Get normalized analyzer name for configuration lookup."""
        return self.__class__.__name__.lower().replace("analyzer", "").replace("advanced", "").replace("content", "").strip()
    
    def analyze(self, content: str, title: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Analyze content with appropriate prompts and optional web search.
        
        Args:
            content: The content to analyze
            title: The document title
            content_type: Optional content type for specialized prompts
            
        Returns:
            Analysis results dictionary
        """
        try:
            # Get configuration for this analyzer and content type
            prompt_config = self.prompt_config.get_prompt(self.analyzer_name, content_type)
            
            # Determine if we should use web search
            config_web_search = prompt_config.get("web_search", False)
            use_web_search = (
                self.prompt_config.web_search_enabled and 
                config_web_search and
                self.has_responses_api
            )
            
            if config_web_search and not use_web_search:
                self.logger.debug(
                    f"Web search requested but not available - "
                    f"global_enabled: {self.prompt_config.web_search_enabled}, "
                    f"has_api: {self.has_responses_api}"
                )
            
            self.logger.info(
                f"Analyzing '{title}' (type: {content_type or 'default'}, "
                f"web_search: {use_web_search})"
            )
            
            # Build the prompt
            user_prompt = self._build_prompt(content, title, prompt_config)
            
            # Perform analysis
            if use_web_search:
                return self._analyze_with_web_search(user_prompt, prompt_config)
            else:
                return self._analyze_standard(user_prompt, prompt_config)
                
        except Exception as e:
            self.logger.error(f"Analysis failed for '{title}': {e}")
            return self._get_fallback_result(str(e))
    
    def _analyze_with_web_search(self, user_prompt: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze using Responses API with web search.
        
        Args:
            user_prompt: The formatted user prompt
            config: Prompt configuration
            
        Returns:
            Analysis results with web search indicator
        """
        try:
            self.logger.debug("Using Responses API with web search")
            
            # Build the input for Responses API
            input_data = [
                {
                    "role": "system",
                    "content": config.get("system", self._get_default_system_prompt())
                },
                {
                    "role": "user", 
                    "content": user_prompt
                }
            ]
            
            response = self.client.responses.create(
                model=os.getenv("WEB_SEARCH_MODEL", "o3"),
                input=input_data,
                tools=[{"type": "web_search"}],
                temperature=config.get("temperature", 0.3)
            )
            
            # Comprehensive logging to understand response structure
            self.logger.info(f"Responses API response type: {type(response)}")
            self.logger.info(f"Response attributes: {[attr for attr in dir(response) if not attr.startswith('_')]}")
            
            # Log specific attributes if they exist
            if hasattr(response, 'output'):
                self.logger.info(f"response.output type: {type(response.output)}")
            if hasattr(response, 'annotations'):
                self.logger.info(f"response.annotations: {response.annotations}")
            if hasattr(response, 'messages'):
                self.logger.info(f"response.messages count: {len(response.messages) if response.messages else 0}")
                if response.messages:
                    for i, msg in enumerate(response.messages):
                        self.logger.info(f"Message {i} attributes: {[attr for attr in dir(msg) if not attr.startswith('_')]}")
                        if hasattr(msg, 'tool_calls'):
                            self.logger.info(f"Message {i} tool_calls: {msg.tool_calls}")
            
            # Extract the output text
            output_text = getattr(response, 'output_text', None)
            if not output_text and hasattr(response, 'output'):
                output_text = response.output
            if not output_text:
                # Fallback to extracting from response structure
                output_text = str(response)
            
            # Extract citations/web search data
            web_citations = []
            web_search_actually_used = False
            
            # Check for annotations (common in Responses API)
            if hasattr(response, 'annotations') and response.annotations:
                self.logger.info(f"Found {len(response.annotations)} annotations")
                for ann in response.annotations:
                    if hasattr(ann, 'type') and ann.type == 'url_citation':
                        web_citations.append({
                            'title': getattr(ann, 'title', 'Unknown'),
                            'url': getattr(ann, 'url', ''),
                            'domain': self._extract_domain(getattr(ann, 'url', ''))
                        })
                        web_search_actually_used = True
            
            # Check for tool calls in messages
            if hasattr(response, 'messages') and response.messages:
                for msg in response.messages:
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        for tool_call in msg.tool_calls:
                            if hasattr(tool_call, 'type') and tool_call.type == 'web_search':
                                web_search_actually_used = True
                                self.logger.info("Web search tool was called")
            
            # Log citation results
            if web_citations:
                self.logger.info(f"Extracted {len(web_citations)} web citations")
            else:
                self.logger.info("No web citations found in response")
            
            return {
                "analysis": output_text,
                "web_search_used": web_search_actually_used,
                "web_citations": web_citations,
                "success": True,
                "model": os.getenv("WEB_SEARCH_MODEL", "o3")
            }
            
        except Exception as e:
            self.logger.error(f"Web search analysis failed: {e}")
            # Fallback to standard analysis
            return self._analyze_standard(user_prompt, config)
    
    def _extract_domain(self, url: str) -> str:
        """Extract domain from URL for display."""
        try:
            parsed = urlparse(url)
            return parsed.netloc or parsed.path.split('/')[0]
        except:
            return ""
    
    def _analyze_standard(self, user_prompt: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Standard analysis using Chat Completions API.
        
        Args:
            user_prompt: The formatted user prompt
            config: Prompt configuration
            
        Returns:
            Analysis results without web search
        """
        try:
            self.logger.debug("Using standard Chat Completions API")
            
            # Use model_summary as default model
            model = getattr(self.config.openai, 'model', self.config.openai.model_summary)
            
            completion = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system", 
                        "content": config.get("system", self._get_default_system_prompt())
                    },
                    {
                        "role": "user", 
                        "content": user_prompt
                    }
                ],
                temperature=config.get("temperature", 0.3)
            )
            
            return {
                "analysis": completion.choices[0].message.content,
                "web_search_used": False,
                "success": True,
                "model": self.config.openai.model
            }
            
        except Exception as e:
            self.logger.error(f"Standard analysis failed: {e}")
            raise
    
    @abstractmethod
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build the user prompt for analysis.
        
        Args:
            content: The content to analyze
            title: The document title
            config: Prompt configuration
            
        Returns:
            Formatted prompt string
        """
        pass
    
    @abstractmethod
    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for this analyzer.
        
        Returns:
            Default system prompt string
        """
        pass
    
    @abstractmethod
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """Get fallback result when analysis fails.
        
        Args:
            error_message: The error that occurred
            
        Returns:
            Fallback analysis result
        """
        pass