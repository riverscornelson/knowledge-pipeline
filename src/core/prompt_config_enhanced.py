"""
Enhanced prompt configuration management that supports both YAML and Notion-based prompts.
Provides dynamic prompt loading from Notion with fallback to YAML configuration.
"""
import os
import yaml
import time
from typing import Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
from notion_client import Client
from ..utils.logging import setup_logger

# Ensure environment variables are loaded
load_dotenv()


class EnhancedPromptConfig:
    """Manages prompt configuration from both YAML files and Notion database."""
    
    def __init__(self, config_path: Optional[Path] = None, notion_db_id: Optional[str] = None):
        """Initialize enhanced prompt configuration.
        
        Args:
            config_path: Path to prompts.yaml file. Defaults to config/prompts.yaml
            notion_db_id: ID of the Pipeline Prompts database in Notion
        """
        self.logger = setup_logger(__name__)
        self.config_path = config_path or Path("config/prompts.yaml")
        self.yaml_prompts = self._load_yaml_prompts()
        self.web_search_enabled = os.getenv("ENABLE_WEB_SEARCH", "false").lower() == "true"
        
        # Notion configuration
        self.notion_db_id = notion_db_id or os.getenv("NOTION_PROMPTS_DB_ID")
        self.notion_token = os.getenv("NOTION_TOKEN")
        self.notion_client = None
        self.notion_prompts_cache = {}
        self.cache_ttl = timedelta(minutes=5)  # 5-minute cache
        self.last_cache_update = None
        
        # Initialize Notion client if credentials available
        if self.notion_token and self.notion_db_id:
            try:
                self.notion_client = Client(auth=self.notion_token)
                self.logger.info(f"Initialized Notion client for prompt database: {self.notion_db_id}")
                self._refresh_notion_cache()
            except Exception as e:
                self.logger.error(f"Failed to initialize Notion client: {e}")
                self.notion_client = None
        else:
            self.logger.info("Notion credentials not provided, using YAML prompts only")
        
        self.logger.info(f"Enhanced PromptConfig initialized, web search: {self.web_search_enabled}")
        
    def _load_yaml_prompts(self) -> Dict[str, Any]:
        """Load prompts from YAML with environment variable substitution."""
        if not self.config_path.exists():
            self.logger.warning(f"Prompt config file not found at {self.config_path}, using defaults")
            return self._get_default_prompts()
            
        try:
            with open(self.config_path) as f:
                content = f.read()
                # Substitute environment variables
                content = os.path.expandvars(content)
                prompts = yaml.safe_load(content)
                self.logger.info(f"Loaded {len(prompts.get('defaults', {}))} default prompts from YAML")
                return prompts
        except Exception as e:
            self.logger.error(f"Failed to load YAML prompt config: {e}")
            return self._get_default_prompts()
    
    def _get_default_prompts(self) -> Dict[str, Any]:
        """Return default prompts with formatting when config files are not available."""
        return {
            "defaults": {
                "summarizer": {
                    "system": """You are an expert content analyst creating scannable Notion summaries.

## 📋 Executive Summary
[3 bullet points, 15 words each]

## 🎯 Key Points
[Numbered list with emojis]

## 💡 Strategic Implications
[Callout-style insights]""",
                    "temperature": 0.3,
                    "web_search": False
                },
                "classifier": {
                    "system": """You are a classification expert providing structured categorization.

## 🏷️ Classification Results
**Primary Category**: [Category]
**Confidence**: [XX%]

### 📊 Attributes
| Attribute | Value | Confidence |
|-----------|-------|------------|
| Content-Type | [Type] | [XX%] |""",
                    "temperature": 0.1,
                    "web_search": False
                },
                "insights": {
                    "system": """You are a strategic analyst creating actionable Notion insights.

## 🔮 Strategic Insights

### 🚀 Opportunities
[Numbered list with impact indicators]

### ⚠️ Risks & Challenges  
[Bulleted list with severity markers]""",
                    "temperature": 0.6,
                    "web_search": True
                }
            }
        }
    
    def _refresh_notion_cache(self) -> None:
        """Refresh the cache of prompts from Notion database."""
        if not self.notion_client:
            return
            
        try:
            self.logger.info("Refreshing Notion prompts cache...")
            
            # Query all active prompts
            response = self.notion_client.databases.query(
                database_id=self.notion_db_id,
                filter={"property": "Active", "checkbox": {"equals": True}},
                page_size=100
            )
            
            new_cache = {}
            
            for page in response.get("results", []):
                props = page.get("properties", {})
                
                # Extract prompt data
                content_type = self._get_property_value(props.get("Content Type"))
                analyzer_type = self._get_property_value(props.get("Analyzer Type"))
                system_prompt = self._get_property_value(props.get("System Prompt"))
                formatting_instructions = self._get_property_value(props.get("Formatting Instructions"))
                temperature = self._get_property_value(props.get("Temperature"), default=0.3)
                web_search = self._get_property_value(props.get("Web Search"), default=False)
                version = self._get_property_value(props.get("Version"), default=1.0)
                
                if content_type and analyzer_type and system_prompt:
                    # Combine system prompt with formatting instructions
                    full_prompt = system_prompt
                    if formatting_instructions:
                        full_prompt = f"{system_prompt}\n\n{formatting_instructions}"
                    
                    # Store in cache
                    cache_key = f"{content_type.lower()}_{analyzer_type.lower()}"
                    
                    # Keep highest version if multiple exist
                    if cache_key not in new_cache or version > new_cache[cache_key].get("version", 0):
                        new_cache[cache_key] = {
                            "system": full_prompt,
                            "temperature": float(temperature),
                            "web_search": bool(web_search),
                            "version": float(version),
                            "page_id": page["id"],
                            "last_modified": page.get("last_edited_time")
                        }
            
            self.notion_prompts_cache = new_cache
            self.last_cache_update = datetime.now()
            self.logger.info(f"Cached {len(new_cache)} prompts from Notion")
            
        except Exception as e:
            self.logger.error(f"Failed to refresh Notion cache: {e}")
    
    def _get_property_value(self, prop: Optional[Dict], default: Any = None) -> Any:
        """Extract value from Notion property."""
        if not prop:
            return default
            
        prop_type = prop.get("type")
        
        if prop_type == "title":
            texts = prop.get("title", [])
            return texts[0].get("plain_text", "") if texts else default
        elif prop_type == "rich_text":
            texts = prop.get("rich_text", [])
            return texts[0].get("plain_text", "") if texts else default
        elif prop_type == "select":
            return prop.get("select", {}).get("name", default)
        elif prop_type == "number":
            return prop.get("number", default)
        elif prop_type == "checkbox":
            return prop.get("checkbox", default)
        else:
            return default
    
    def _should_refresh_cache(self) -> bool:
        """Check if cache should be refreshed."""
        if not self.last_cache_update:
            return True
        return datetime.now() - self.last_cache_update > self.cache_ttl
    
    def get_prompt(self, analyzer: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Get prompt configuration for analyzer and content type.
        
        First attempts to fetch from Notion, falls back to YAML if unavailable.
        
        Args:
            analyzer: Name of the analyzer (e.g., 'summarizer', 'classifier')
            content_type: Optional content type for specialized prompts
            
        Returns:
            Dict containing prompt configuration with keys:
            - system: System prompt text with formatting instructions
            - temperature: Temperature setting
            - web_search: Whether to use web search
            - source: Where the prompt came from ('notion' or 'yaml')
        """
        # Normalize analyzer name
        analyzer = analyzer.lower().replace("analyzer", "").replace("advanced", "").replace("content", "").strip()
        analyzer = analyzer.strip("_")
        
        # Try Notion first if available
        if self.notion_client and content_type:
            # Refresh cache if needed
            if self._should_refresh_cache():
                self._refresh_notion_cache()
            
            # Look for specific content type prompt
            cache_key = f"{content_type.lower().replace(' ', '_')}_{analyzer}"
            notion_prompt = self.notion_prompts_cache.get(cache_key)
            
            if notion_prompt:
                config = notion_prompt.copy()
                config["source"] = "notion"
                
                # Apply environment variable overrides
                env_web_search = os.getenv(f"{analyzer.upper()}_WEB_SEARCH")
                if env_web_search:
                    config["web_search"] = env_web_search.lower() == "true"
                
                # Ensure web search is only enabled if globally enabled
                if not self.web_search_enabled:
                    config["web_search"] = False
                
                self.logger.info(f"Using Notion prompt for {analyzer}/{content_type} (v{config.get('version')})")
                return config
        
        # Fall back to YAML prompts
        config = self._get_yaml_prompt(analyzer, content_type)
        config["source"] = "yaml"
        return config
    
    def _get_yaml_prompt(self, analyzer: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Get prompt from YAML configuration."""
        # Start with defaults
        default_config = self.yaml_prompts.get("defaults", {}).get(analyzer, {})
        config = default_config.copy()
        
        # Apply content-type overrides if available
        if content_type and "content_types" in self.yaml_prompts:
            content_type_key = content_type.lower().replace(" ", "_").replace("-", "_")
            content_config = self.yaml_prompts.get("content_types", {}).get(content_type_key, {}).get(analyzer, {})
            if content_config:
                config.update(content_config)
        
        # Apply environment variable overrides for web search
        env_web_search = os.getenv(f"{analyzer.upper()}_WEB_SEARCH")
        if env_web_search:
            config["web_search"] = env_web_search.lower() == "true"
        
        # Ensure web search is only enabled if globally enabled
        if not self.web_search_enabled:
            config["web_search"] = False
        
        return config
    
    def update_prompt_quality(self, analyzer: str, content_type: str, quality_score: float) -> None:
        """Update quality score for a prompt in Notion.
        
        Args:
            analyzer: Analyzer type
            content_type: Content type
            quality_score: Quality score (1-5)
        """
        if not self.notion_client:
            return
            
        cache_key = f"{content_type.lower().replace(' ', '_')}_{analyzer}"
        prompt_data = self.notion_prompts_cache.get(cache_key)
        
        if not prompt_data or "page_id" not in prompt_data:
            return
            
        try:
            # Get current metrics
            page = self.notion_client.pages.retrieve(page_id=prompt_data["page_id"])
            props = page.get("properties", {})
            
            current_usage = self._get_property_value(props.get("Usage Count"), default=0)
            current_quality = self._get_property_value(props.get("Quality Score"), default=0)
            
            # Calculate new average quality score
            new_usage = current_usage + 1
            if current_usage == 0:
                new_quality = quality_score
            else:
                new_quality = ((current_quality * current_usage) + quality_score) / new_usage
            
            # Update Notion page
            self.notion_client.pages.update(
                page_id=prompt_data["page_id"],
                properties={
                    "Usage Count": {"number": new_usage},
                    "Quality Score": {"number": round(new_quality, 2)}
                }
            )
            
            self.logger.info(f"Updated quality metrics for {analyzer}/{content_type}: score={new_quality:.2f}, usage={new_usage}")
            
        except Exception as e:
            self.logger.error(f"Failed to update prompt quality: {e}")
    
    def get_custom_analyzer_prompt(self, analyzer_name: str) -> Optional[str]:
        """Get custom analyzer prompt template."""
        # Try Notion first
        if self.notion_client:
            if self._should_refresh_cache():
                self._refresh_notion_cache()
            
            # Look for custom analyzer prompts
            for key, prompt_data in self.notion_prompts_cache.items():
                if key.endswith(f"_{analyzer_name.lower()}"):
                    return prompt_data.get("system")
        
        # Fall back to YAML
        analyzer_config = self.yaml_prompts.get("analyzers", {}).get(analyzer_name.lower(), {})
        return analyzer_config.get("default_prompt")
    
    def is_analyzer_enabled(self, analyzer_name: str) -> bool:
        """Check if a custom analyzer is enabled."""
        # Check environment variable first
        env_var = f"ENABLE_{analyzer_name.upper()}_ANALYSIS"
        if os.getenv(env_var):
            return os.getenv(env_var, "false").lower() == "true"
            
        # Check YAML config
        analyzer_config = self.yaml_prompts.get("analyzers", {}).get(analyzer_name.lower(), {})
        enabled = analyzer_config.get("enabled", "false")
        
        # Handle environment variable references in YAML
        if enabled.startswith("${") and enabled.endswith("}"):
            var_name = enabled[2:-1]
            return os.getenv(var_name, "false").lower() == "true"
            
        return str(enabled).lower() == "true"
    
    def get_prompt_stats(self) -> Dict[str, Any]:
        """Get statistics about loaded prompts."""
        stats = {
            "yaml_prompts": len(self.yaml_prompts.get("defaults", {})),
            "notion_prompts": len(self.notion_prompts_cache),
            "cache_age_seconds": (datetime.now() - self.last_cache_update).total_seconds() if self.last_cache_update else None,
            "web_search_enabled": self.web_search_enabled,
            "notion_connected": self.notion_client is not None
        }
        return stats