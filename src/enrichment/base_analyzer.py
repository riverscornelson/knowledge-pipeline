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
            
            # Debug logging
            self.logger.debug(f"Web search decision for {self.analyzer_name}:")
            self.logger.debug(f"  - config_web_search: {config_web_search}")
            self.logger.debug(f"  - global enabled: {self.prompt_config.web_search_enabled}")
            self.logger.debug(f"  - has responses API: {self.has_responses_api}")
            
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
            
            # Create request parameters
            request_params = {
                "model": os.getenv("WEB_SEARCH_MODEL", "o3"),
                "input": input_data,
                "tools": [{"type": "web_search"}]
            }
            
            # Only add temperature if not using o3 (o3 doesn't support temperature)
            model = request_params["model"]
            if model != "o3":
                request_params["temperature"] = config.get("temperature", 0.3)
            
            response = self.client.responses.create(**request_params)
            
            # Comprehensive logging to understand response structure
            self.logger.info(f"Responses API response type: {type(response)}")
            self.logger.info(f"Response attributes: {[attr for attr in dir(response) if not attr.startswith('_')]}")
            
            # Log specific attributes if they exist
            if hasattr(response, 'output'):
                self.logger.info(f"response.output type: {type(response.output)}")
                if isinstance(response.output, list) and response.output:
                    self.logger.info(f"response.output length: {len(response.output)}")
                    for idx, item in enumerate(response.output):
                        self.logger.info(f"response.output[{idx}] type: {type(item)}")
                        if hasattr(item, 'type'):
                            self.logger.info(f"response.output[{idx}].type: {item.type}")
                        if hasattr(item, 'tool_calls'):
                            self.logger.info(f"response.output[{idx}] has tool_calls")
                        # Log all attributes of the output item
                        attrs = [attr for attr in dir(item) if not attr.startswith('_')]
                        self.logger.info(f"response.output[{idx}] attributes: {attrs}")
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
            output_text = None
            
            # Try various ways to get the text
            if hasattr(response, 'output_text') and response.output_text:
                output_text = response.output_text
                self.logger.info("Got text from output_text")
            elif hasattr(response, 'text') and response.text:
                output_text = response.text
                self.logger.info("Got text from text attribute")
            elif hasattr(response, 'output') and response.output:
                # Output is a list of message objects
                if isinstance(response.output, list):
                    for item in response.output:
                        if hasattr(item, 'text'):
                            output_text = item.text
                            self.logger.info("Got text from output list item")
                            break
                        elif hasattr(item, 'content'):
                            output_text = item.content
                            self.logger.info("Got text from output list content")
                            break
                else:
                    output_text = str(response.output)
                    self.logger.info("Got text by converting output to string")
            
            if not output_text:
                # Fallback to extracting from response structure
                output_text = str(response)
                self.logger.warning("Had to use fallback string conversion")
            
            # Extract citations/web search data
            web_citations = []
            web_search_actually_used = False
            web_search_queries = []
            
            # Check in the output array for web_search_call items
            if hasattr(response, 'output') and isinstance(response.output, list):
                for item in response.output:
                    if hasattr(item, 'type') and item.type == 'web_search_call':
                        web_search_actually_used = True
                        self.logger.info(f"Found web search call: {item.id}")
                        
                        # Extract search query
                        if hasattr(item, 'action') and hasattr(item.action, 'query'):
                            web_search_queries.append(item.action.query)
                            self.logger.info(f"Web search query: {item.action.query}")
                    
                    # Check for web search results (might be in a different format)
                    elif hasattr(item, 'type') and item.type == 'web_search_result':
                        if hasattr(item, 'results'):
                            for result in item.results:
                                web_citations.append({
                                    'title': getattr(result, 'title', 'Unknown'),
                                    'url': getattr(result, 'url', ''),
                                    'domain': self._extract_domain(getattr(result, 'url', ''))
                                })
            
            # Also check for annotations (might be in different location)
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
            
            # Log citation results
            if web_citations:
                self.logger.info(f"Extracted {len(web_citations)} web citations")
            elif web_search_queries:
                self.logger.info(f"Web search was used with {len(web_search_queries)} queries but no citations extracted")
                # If we have queries but no citations, we can at least show what was searched
                for query in web_search_queries:
                    web_citations.append({
                        'title': f'Search: "{query}"',
                        'url': '',
                        'domain': 'Web Search Query'
                    })
            else:
                self.logger.info("No web search activity found in response")
            
            return {
                "analysis": output_text,
                "web_search_used": web_search_actually_used,
                "web_citations": web_citations,
                "web_search_queries": web_search_queries,
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