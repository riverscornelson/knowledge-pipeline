"""
Configuration management for the integrated prompt-aware pipeline.
"""
import os
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class IntegrationConfig:
    """Configuration for the integrated pipeline with feature flags."""
    
    # Feature flags
    enable_prompt_attribution: bool = field(
        default_factory=lambda: os.getenv('ENABLE_PROMPT_ATTRIBUTION', 'true').lower() == 'true'
    )
    enable_executive_dashboard: bool = field(
        default_factory=lambda: os.getenv('ENABLE_EXECUTIVE_DASHBOARD', 'true').lower() == 'true'
    )
    enable_feedback_collection: bool = field(
        default_factory=lambda: os.getenv('ENABLE_FEEDBACK_COLLECTION', 'true').lower() == 'true'
    )
    enable_performance_monitoring: bool = field(
        default_factory=lambda: os.getenv('ENABLE_PERFORMANCE_MONITORING', 'true').lower() == 'true'
    )
    enable_web_search_enhancement: bool = field(
        default_factory=lambda: os.getenv('ENABLE_WEB_SEARCH', 'true').lower() == 'true'
    )
    enable_quality_validation: bool = field(
        default_factory=lambda: os.getenv('ENABLE_QUALITY_VALIDATION', 'true').lower() == 'true'
    )
    
    # Rollout configuration
    rollout_percentage: int = field(
        default_factory=lambda: int(os.getenv('ROLLOUT_PERCENTAGE', '100'))
    )
    rollout_mode: str = field(
        default_factory=lambda: os.getenv('ROLLOUT_MODE', 'full')  # 'full', 'gradual', 'ab_test'
    )
    
    # A/B testing configuration
    ab_test_enabled: bool = field(
        default_factory=lambda: os.getenv('AB_TEST_ENABLED', 'false').lower() == 'true'
    )
    ab_test_control_group: float = field(
        default_factory=lambda: float(os.getenv('AB_TEST_CONTROL_GROUP', '0.5'))
    )
    
    # Performance thresholds
    quality_threshold: float = field(
        default_factory=lambda: float(os.getenv('QUALITY_THRESHOLD', '0.7'))
    )
    processing_time_threshold: float = field(
        default_factory=lambda: float(os.getenv('PROCESSING_TIME_THRESHOLD', '30.0'))
    )
    
    # Migration settings
    migration_batch_size: int = field(
        default_factory=lambda: int(os.getenv('MIGRATION_BATCH_SIZE', '100'))
    )
    migration_delay_seconds: float = field(
        default_factory=lambda: float(os.getenv('MIGRATION_DELAY_SECONDS', '1.0'))
    )
    
    def should_use_new_pipeline(self, document_id: Optional[str] = None) -> bool:
        """Determine if the new pipeline should be used based on rollout configuration."""
        if self.rollout_mode == 'full':
            return True
            
        elif self.rollout_mode == 'gradual':
            # Use document ID for consistent assignment
            if document_id:
                # Simple hash-based assignment
                hash_value = sum(ord(c) for c in document_id) % 100
                return hash_value < self.rollout_percentage
            return False
            
        elif self.rollout_mode == 'ab_test' and self.ab_test_enabled:
            # A/B test mode
            if document_id:
                hash_value = sum(ord(c) for c in document_id) % 100
                control_threshold = int(self.ab_test_control_group * 100)
                return hash_value >= control_threshold
            return False
            
        return False
        
    def get_feature_flags(self) -> Dict[str, bool]:
        """Get all feature flags as a dictionary."""
        return {
            "prompt_attribution": self.enable_prompt_attribution,
            "executive_dashboard": self.enable_executive_dashboard,
            "feedback_collection": self.enable_feedback_collection,
            "performance_monitoring": self.enable_performance_monitoring,
            "web_search_enhancement": self.enable_web_search_enhancement,
            "quality_validation": self.enable_quality_validation
        }
        
    def validate_configuration(self) -> Dict[str, Any]:
        """Validate configuration and return any issues."""
        issues = []
        
        # Validate rollout percentage
        if not 0 <= self.rollout_percentage <= 100:
            issues.append("Rollout percentage must be between 0 and 100")
            
        # Validate A/B test control group
        if not 0 <= self.ab_test_control_group <= 1:
            issues.append("A/B test control group must be between 0 and 1")
            
        # Validate thresholds
        if self.quality_threshold < 0 or self.quality_threshold > 1:
            issues.append("Quality threshold must be between 0 and 1")
            
        if self.processing_time_threshold <= 0:
            issues.append("Processing time threshold must be positive")
            
        # Validate migration settings
        if self.migration_batch_size <= 0:
            issues.append("Migration batch size must be positive")
            
        if self.migration_delay_seconds < 0:
            issues.append("Migration delay cannot be negative")
            
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "timestamp": datetime.now().isoformat()
        }


class FeatureToggle:
    """Feature toggle management for gradual rollout."""
    
    def __init__(self, config: IntegrationConfig):
        """Initialize feature toggle with configuration."""
        self.config = config
        self._feature_states = {}
        
    def is_enabled(self, feature: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """Check if a feature is enabled for the given context."""
        # Check if feature is globally enabled
        feature_flags = self.config.get_feature_flags()
        if not feature_flags.get(feature, False):
            return False
            
        # Check rollout rules
        if context and 'document_id' in context:
            return self.config.should_use_new_pipeline(context['document_id'])
            
        return self.config.rollout_mode == 'full'
        
    def get_variant(self, feature: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Get the variant for A/B testing."""
        if not self.config.ab_test_enabled:
            return "treatment"
            
        if context and 'document_id' in context:
            hash_value = sum(ord(c) for c in context['document_id']) % 100
            control_threshold = int(self.config.ab_test_control_group * 100)
            return "control" if hash_value < control_threshold else "treatment"
            
        return "control"
        
    def track_usage(self, feature: str, variant: str, outcome: Optional[Dict[str, Any]] = None):
        """Track feature usage for analysis."""
        # In production, this would send to analytics
        usage_data = {
            "feature": feature,
            "variant": variant,
            "timestamp": datetime.now().isoformat(),
            "outcome": outcome
        }
        
        if feature not in self._feature_states:
            self._feature_states[feature] = []
            
        self._feature_states[feature].append(usage_data)
        
    def get_usage_report(self) -> Dict[str, Any]:
        """Get usage report for all features."""
        report = {}
        
        for feature, usage_list in self._feature_states.items():
            total_usage = len(usage_list)
            control_usage = sum(1 for u in usage_list if u.get("variant") == "control")
            treatment_usage = sum(1 for u in usage_list if u.get("variant") == "treatment")
            
            report[feature] = {
                "total_usage": total_usage,
                "control_usage": control_usage,
                "treatment_usage": treatment_usage,
                "control_percentage": control_usage / total_usage if total_usage > 0 else 0,
                "treatment_percentage": treatment_usage / total_usage if total_usage > 0 else 0
            }
            
        return report