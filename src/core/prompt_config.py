"""
Prompt configuration management with content-type awareness and web search support.
"""
import os
import yaml
from typing import Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv
from ..utils.logging import setup_logger

# Ensure environment variables are loaded
load_dotenv()


class PromptConfig:
    """Manages prompt configuration with content-type awareness and web search."""
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize prompt configuration.
        
        Args:
            config_path: Path to prompts.yaml file. Defaults to config/prompts.yaml
        """
        self.logger = setup_logger(__name__)
        self.config_path = config_path or Path("config/prompts.yaml")
        self.prompts = self._load_prompts()
        self.web_search_enabled = os.getenv("ENABLE_WEB_SEARCH", "false").lower() == "true"
        
        self.logger.info(f"Loaded prompt config from {self.config_path}, web search: {self.web_search_enabled}")
        
    def _load_prompts(self) -> Dict[str, Any]:
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
                self.logger.info(f"Loaded {len(prompts.get('defaults', {}))} default prompts")
                return prompts
        except Exception as e:
            self.logger.error(f"Failed to load prompt config: {e}")
            return self._get_default_prompts()
    
    def _get_default_prompts(self) -> Dict[str, Any]:
        """Return default prompts when config file is not available."""
        return {
            "defaults": {
                "summarizer": {
                    "system": "You are an expert content analyst specializing in extracting actionable insights.",
                    "temperature": 0.3,
                    "web_search": False
                },
                "classifier": {
                    "system": "You are a classification expert trained to categorize content accurately.",
                    "temperature": 0.1,
                    "web_search": False
                },
                "insights": {
                    "system": "You are a strategic analyst identifying actionable insights and opportunities.",
                    "temperature": 0.6,
                    "web_search": True
                }
            }
        }
    
    def get_prompt(self, analyzer: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """Get prompt configuration for analyzer and content type.
        
        Args:
            analyzer: Name of the analyzer (e.g., 'summarizer', 'classifier')
            content_type: Optional content type for specialized prompts
            
        Returns:
            Dict containing prompt configuration with keys:
            - system: System prompt text
            - temperature: Temperature setting
            - web_search: Whether to use web search
        """
        # Normalize analyzer name
        analyzer = analyzer.lower().replace("analyzer", "").replace("advanced", "").replace("content", "").strip()
        # Remove any trailing underscores left after replacements
        analyzer = analyzer.strip("_")
        
        # Start with defaults
        default_config = self.prompts.get("defaults", {}).get(analyzer, {})
        config = default_config.copy()
        self.logger.debug(f"Default config for {analyzer}: web_search={config.get('web_search', 'not set')}")
        
        # Apply content-type overrides if available
        if content_type and "content_types" in self.prompts:
            # Normalize content type
            content_type_key = content_type.lower().replace(" ", "_").replace("-", "_")
            content_config = self.prompts.get("content_types", {}).get(content_type_key, {}).get(analyzer, {})
            if content_config:
                self.logger.debug(f"Content-type config for {analyzer}/{content_type_key}: web_search={content_config.get('web_search', 'not set')}")
                config.update(content_config)
                self.logger.debug(f"After update: web_search={config.get('web_search', 'not set')}")
            else:
                self.logger.debug(f"No content-type config found for {analyzer}/{content_type_key}")
        
        # Apply environment variable overrides for web search
        env_web_search = os.getenv(f"{analyzer.upper()}_WEB_SEARCH")
        if env_web_search:
            config["web_search"] = env_web_search.lower() == "true"
            self.logger.debug(f"Environment override for {analyzer}: {env_web_search} -> {config['web_search']}")
        
        # Ensure web search is only enabled if globally enabled
        if not self.web_search_enabled:
            config["web_search"] = False
            self.logger.debug(f"Global web search disabled, forcing {analyzer} to False")
            
        self.logger.info(f"Prompt config for {analyzer}/{content_type}: web_search={config.get('web_search')} (global={self.web_search_enabled})")
        
        return config
    
    def get_custom_analyzer_prompt(self, analyzer_name: str) -> Optional[str]:
        """Get custom analyzer prompt template.
        
        Args:
            analyzer_name: Name of the custom analyzer
            
        Returns:
            Prompt template string or None if not found
        """
        analyzer_config = self.prompts.get("analyzers", {}).get(analyzer_name.lower(), {})
        return analyzer_config.get("default_prompt")
    
    def is_analyzer_enabled(self, analyzer_name: str) -> bool:
        """Check if a custom analyzer is enabled.
        
        Args:
            analyzer_name: Name of the analyzer
            
        Returns:
            True if enabled, False otherwise
        """
        # Check environment variable first
        env_var = f"ENABLE_{analyzer_name.upper()}_ANALYSIS"
        if os.getenv(env_var):
            return os.getenv(env_var, "false").lower() == "true"
            
        # Check config file
        analyzer_config = self.prompts.get("analyzers", {}).get(analyzer_name.lower(), {})
        enabled = analyzer_config.get("enabled", "false")
        
        # Handle environment variable references in YAML
        if enabled.startswith("${") and enabled.endswith("}"):
            var_name = enabled[2:-1]
            return os.getenv(var_name, "false").lower() == "true"
            
        return str(enabled).lower() == "true"