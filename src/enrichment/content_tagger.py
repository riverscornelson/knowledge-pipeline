"""
Content tagger that retrieves existing tags from Notion and generates new ones using OpenAI.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from openai import OpenAI
from pydantic import BaseModel, Field

from ..core.config import PipelineConfig
from ..core.prompt_config import PromptConfig
from ..core.notion_client import NotionClient
from .base_analyzer import BaseAnalyzer


class TagOutput(BaseModel):
    """Structured output for tag generation."""
    topical_tags: List[str] = Field(
        description="3-5 subject matter and theme tags",
        min_length=3,
        max_length=5
    )
    domain_tags: List[str] = Field(
        description="2-4 industry and application area tags",
        min_length=2,
        max_length=4
    )
    tag_selection_reasoning: Optional[Dict[str, List[str]]] = Field(
        description="Reasoning about tag selection",
        default_factory=lambda: {
            "existing_tags_used": [],
            "new_tags_created": [],
            "considered_but_rejected": []
        }
    )
    confidence_scores: Optional[Dict[str, float]] = Field(
        description="Confidence score for each tag (0.0-1.0)",
        default_factory=dict
    )


class ContentTagger(BaseAnalyzer):
    """Analyzer that generates topical and domain tags for content."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient, 
                 prompt_config: Optional[PromptConfig] = None):
        """Initialize content tagger with Notion client for tag retrieval.
        
        Args:
            config: Pipeline configuration
            notion_client: Notion client for accessing database
            prompt_config: Optional prompt configuration instance
        """
        super().__init__(config, prompt_config)
        self.notion_client = notion_client
        self._tag_cache = {
            "topical_tags": [],
            "domain_tags": []
        }
        self._cache_timestamp = None
        self._cache_duration = timedelta(minutes=30)  # Cache for 30 minutes
        self._items_processed = 0
        self._cache_refresh_interval = 10  # Refresh cache every 10 items
        
        # Initialize structured output client for tag generation
        self.structured_client = OpenAI(api_key=config.openai.api_key)
        
        # Model configuration for tagger
        self.tagger_config = self.prompt_config.get_prompt("tagger", None)
        self.model = self.tagger_config.get("model", "gpt-4o-mini")
        self.temperature = self.tagger_config.get("temperature", 0.3)
        
        self.logger.info(f"ContentTagger initialized with model: {self.model}")
    
    def _refresh_tag_cache(self, force: bool = False) -> Dict[str, List[str]]:
        """Refresh the cache of existing tags from Notion.
        
        Args:
            force: Force refresh even if cache is still valid
            
        Returns:
            Dictionary with topical_tags and domain_tags lists
        """
        # Check if cache needs refresh
        should_refresh = (
            force or
            self._cache_timestamp is None or
            datetime.now() - self._cache_timestamp > self._cache_duration or
            self._items_processed >= self._cache_refresh_interval
        )
        
        if not should_refresh:
            return self._tag_cache
        
        try:
            self.logger.info("Refreshing tag cache from Notion...")
            
            # Get multi-select options for both tag properties
            topical_options = self.notion_client.get_multi_select_options("Topical Tags")
            domain_options = self.notion_client.get_multi_select_options("Domain Tags")
            
            self._tag_cache = {
                "topical_tags": sorted(topical_options),
                "domain_tags": sorted(domain_options)
            }
            
            self._cache_timestamp = datetime.now()
            self._items_processed = 0
            
            self.logger.info(
                f"Tag cache refreshed - Found {len(topical_options)} topical tags "
                f"and {len(domain_options)} domain tags"
            )
            
            return self._tag_cache
            
        except Exception as e:
            self.logger.error(f"Failed to refresh tag cache: {e}")
            # Return existing cache or empty if none exists
            return self._tag_cache if self._tag_cache["topical_tags"] else {
                "topical_tags": [],
                "domain_tags": []
            }
    
    def _validate_tag(self, tag: str) -> str:
        """Validate and format a tag according to requirements.
        
        Args:
            tag: The tag to validate
            
        Returns:
            Validated and formatted tag
        """
        # Remove extra whitespace
        tag = " ".join(tag.split())
        
        # Ensure 1-4 words
        words = tag.split()
        if len(words) > 4:
            tag = " ".join(words[:4])
        elif len(words) == 0:
            return ""
        
        # Convert to Title Case
        tag = tag.title()
        
        # Handle special cases (common acronyms, etc)
        acronyms = ["AI", "ML", "API", "SDK", "UI", "UX", "IoT", "SaaS", "PaaS", "IaaS"]
        for acronym in acronyms:
            tag = tag.replace(acronym.title(), acronym)
        
        return tag
    
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build the prompt for tag generation.
        
        Args:
            content: The content to analyze
            title: The document title
            config: Prompt configuration
            
        Returns:
            Formatted prompt string
        """
        # Get existing tags
        existing_tags = self._refresh_tag_cache()
        
        # Format existing tags for the prompt
        topical_tags_formatted = "\n".join(f"  - {tag}" for tag in existing_tags["topical_tags"])
        domain_tags_formatted = "\n".join(f"  - {tag}" for tag in existing_tags["domain_tags"])
        
        if not topical_tags_formatted:
            topical_tags_formatted = "  (No existing topical tags yet)"
        if not domain_tags_formatted:
            domain_tags_formatted = "  (No existing domain tags yet)"
        
        prompt = f"""Analyze this content and generate appropriate tags.

TITLE: {title}

CONTENT:
{content[:8000]}  # Limit content length for token efficiency

EXISTING TOPICAL TAGS:
{topical_tags_formatted}

EXISTING DOMAIN TAGS:
{domain_tags_formatted}

INSTRUCTIONS:
1. STRONGLY PREFER EXISTING TAGS when they accurately describe the content
2. Only create new tags when absolutely necessary (no existing tag captures the concept)
3. Topical Tags: Focus on subject matter, themes, and concepts (3-5 tags)
4. Domain Tags: Focus on industries, sectors, and application areas (2-4 tags)
5. Each tag must be 1-4 words, Title Case
6. Provide confidence scores (0.0-1.0) for each tag

Remember: Consistency is key. Use existing tags whenever possible to maintain a clean taxonomy."""
        
        return prompt
    
    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for the tagger.
        
        Returns:
            Default system prompt string
        """
        return """You are an expert content tagger specializing in maintaining consistent taxonomies.
Your goal is to categorize content with existing tags whenever possible, only creating new tags
when absolutely necessary. You understand nuanced differences between topics and domains,
and you prioritize taxonomy consistency over perfect accuracy."""
    
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """Get fallback result when analysis fails.
        
        Args:
            error_message: The error that occurred
            
        Returns:
            Fallback analysis result
        """
        return {
            "topical_tags": ["Content Analysis", "Knowledge Management"],
            "domain_tags": ["General", "Technology"],
            "error": error_message,
            "success": False
        }
    
    def analyze(self, content: str, title: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Analyze content and generate tags.
        
        Args:
            content: The content to analyze
            title: The document title
            content_type: Optional content type for specialized prompts
            
        Returns:
            Dictionary with topical_tags, domain_tags, and metadata
        """
        try:
            # Increment processed counter
            self._items_processed += 1
            
            # Get configuration
            prompt_config = self.prompt_config.get_prompt("tagger", content_type)
            
            self.logger.info(f"Generating tags for '{title}' (type: {content_type or 'default'})")
            
            # Build the prompt
            user_prompt = self._build_prompt(content, title, prompt_config)
            
            # Use structured output for tag generation
            completion = self.structured_client.beta.chat.completions.parse(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": prompt_config.get("system", self._get_default_system_prompt())
                    },
                    {
                        "role": "user",
                        "content": user_prompt
                    }
                ],
                temperature=self.temperature,
                response_format=TagOutput
            )
            
            tag_output = completion.choices[0].message.parsed
            
            # Validate all tags
            validated_topical = [self._validate_tag(tag) for tag in tag_output.topical_tags if tag]
            validated_domain = [self._validate_tag(tag) for tag in tag_output.domain_tags if tag]
            
            # Remove any empty tags after validation
            validated_topical = [tag for tag in validated_topical if tag]
            validated_domain = [tag for tag in validated_domain if tag]
            
            # Log new tag creation
            new_tags = tag_output.tag_selection_reasoning.get("new_tags_created", [])
            if new_tags:
                self.logger.info(f"Created {len(new_tags)} new tags: {', '.join(new_tags)}")
            
            return {
                "topical_tags": validated_topical,
                "domain_tags": validated_domain,
                "tag_selection_reasoning": tag_output.tag_selection_reasoning,
                "confidence_scores": tag_output.confidence_scores,
                "existing_tags_cache": {
                    "topical_count": len(self._tag_cache["topical_tags"]),
                    "domain_count": len(self._tag_cache["domain_tags"])
                },
                "success": True,
                "model": self.model
            }
            
        except Exception as e:
            self.logger.error(f"Tag generation failed for '{title}': {e}")
            return self._get_fallback_result(str(e))