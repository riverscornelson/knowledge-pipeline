"""
Main integration manager that coordinates all components of the enhanced pipeline.
"""
import os
import time
from typing import Dict, List, Any, Optional
from datetime import datetime

from .core.config import PipelineConfig
from .core.integration_config import IntegrationConfig, FeatureToggle
from .core.notion_client import NotionClient
from .core.models import SourceContent
from .enrichment.pipeline_processor import PipelineProcessor
from .enrichment.prompt_aware_pipeline import PromptAwarePipeline
from .enrichment.prompt_attribution_tracker import PromptAttributionTracker
from .enrichment.executive_dashboard_generator import ExecutiveDashboardGenerator
from .utils.notion_formatter_enhanced import NotionFormatterEnhanced
from .utils.migration_manager import MigrationManager
from .utils.feedback_collector import FeedbackCollector
from .utils.logging import setup_logger


class IntegrationManager:
    """Main coordinator for the integrated prompt-aware pipeline system."""
    
    def __init__(self, pipeline_config: PipelineConfig):
        """Initialize the integration manager with all components."""
        self.pipeline_config = pipeline_config
        self.integration_config = IntegrationConfig()
        self.feature_toggle = FeatureToggle(self.integration_config)
        self.logger = setup_logger(__name__)
        
        # Initialize core components
        self.notion_client = NotionClient(pipeline_config.notion)
        
        # Initialize pipelines
        self.legacy_pipeline = PipelineProcessor(pipeline_config, self.notion_client)
        self.enhanced_pipeline = PromptAwarePipeline(pipeline_config, self.notion_client)
        
        # Initialize support systems
        self.attribution_tracker = PromptAttributionTracker(self.notion_client)
        self.dashboard_generator = ExecutiveDashboardGenerator()
        self.notion_formatter = NotionFormatterEnhanced()
        self.feedback_collector = FeedbackCollector(self.notion_client)
        
        # Initialize migration manager
        self.migration_manager = MigrationManager(
            self.integration_config,
            self.notion_client,
            self.legacy_pipeline,
            self.enhanced_pipeline
        )
        
        # Performance monitoring
        self.performance_metrics = {
            "total_processed": 0,
            "legacy_used": 0,
            "enhanced_used": 0,
            "average_processing_time": 0.0,
            "quality_scores": [],
            "error_count": 0
        }
        
        self.logger.info("Integration manager initialized successfully")
        
    def process_document(self, document_id: str) -> Dict[str, Any]:
        """Process a single document using the appropriate pipeline."""
        start_time = time.time()
        
        try:
            # Get document from Notion
            item = self._get_notion_item(document_id)
            if not item:
                return {"error": f"Document {document_id} not found"}
                
            # Determine which pipeline to use
            context = {"document_id": document_id}
            use_enhanced = self.feature_toggle.is_enabled("prompt_attribution", context)
            
            if use_enhanced:
                result = self._process_with_enhanced_pipeline(item)
                self.performance_metrics["enhanced_used"] += 1
                variant = "enhanced"
            else:
                result = self._process_with_legacy_pipeline(item)
                self.performance_metrics["legacy_used"] += 1
                variant = "legacy"
                
            # Track performance
            processing_time = time.time() - start_time
            self._update_performance_metrics(processing_time, result, variant)
            
            # Track feature usage
            self.feature_toggle.track_usage("prompt_attribution", variant, {
                "processing_time": processing_time,
                "success": result.get("success", False)
            })
            
            # Schedule feedback collection if enabled
            if self.feature_toggle.is_enabled("feedback_collection", context):
                self.feedback_collector.schedule_feedback_collection(document_id)
                
            return result
            
        except Exception as e:
            self.logger.error(f"Document processing failed for {document_id}: {e}")
            self.performance_metrics["error_count"] += 1
            return {"error": str(e), "document_id": document_id}
            
    def _get_notion_item(self, document_id: str) -> Optional[Dict]:
        """Retrieve a Notion item by ID."""
        try:
            return self.notion_client.client.pages.retrieve(page_id=document_id)
        except Exception as e:
            self.logger.error(f"Failed to retrieve Notion item {document_id}: {e}")
            return None
            
    def _process_with_enhanced_pipeline(self, item: Dict) -> Dict[str, Any]:
        """Process document with the enhanced prompt-aware pipeline."""
        # Extract content and create source object
        content = self.legacy_pipeline._extract_content(item)
        if not content:
            return {"error": "No content found", "success": False}
            
        source = SourceContent(
            id=item['id'],
            title=item['properties']['Title']['title'][0]['text']['content'],
            content=content,
            source_type="notion"
        )
        
        # Process with attribution
        result = self.enhanced_pipeline.process_with_attribution(source)
        
        # Store attribution data
        if result.get("success") and result.get("attribution"):
            self.attribution_tracker.store_attribution(
                document_id=item['id'],
                analysis_results=result["attribution"],
                processing_time=result.get("processing_time", 0)
            )
            
        return result
        
    def _process_with_legacy_pipeline(self, item: Dict) -> Dict[str, Any]:
        """Process document with the legacy pipeline."""
        try:
            # Extract content
            content = self.legacy_pipeline._extract_content(item)
            if not content:
                return {"error": "No content found", "success": False}
                
            # Process with legacy pipeline
            result = self.legacy_pipeline.enrich_content(content, item)
            
            # Store results using legacy format
            self.legacy_pipeline._store_results(item, result, content)
            
            return {
                "success": True,
                "pipeline_used": "legacy",
                "quality_score": getattr(result, 'quality_score', 0),
                "processing_time": getattr(result, 'processing_time', 0)
            }
            
        except Exception as e:
            self.logger.error(f"Legacy pipeline processing failed: {e}")
            return {"error": str(e), "success": False}
            
    def _update_performance_metrics(self, processing_time: float, result: Dict, variant: str):
        """Update performance tracking metrics."""
        self.performance_metrics["total_processed"] += 1
        
        # Update average processing time
        total = self.performance_metrics["total_processed"]
        current_avg = self.performance_metrics["average_processing_time"]
        self.performance_metrics["average_processing_time"] = (
            (current_avg * (total - 1) + processing_time) / total
        )
        
        # Track quality scores
        quality_score = result.get("quality_score", 0)
        if quality_score > 0:
            self.performance_metrics["quality_scores"].append({
                "score": quality_score,
                "variant": variant,
                "timestamp": datetime.now().isoformat()
            })
            
    def process_batch(self, limit: int = 50) -> Dict[str, Any]:
        """Process a batch of documents with intelligent routing."""
        self.logger.info(f"Processing batch of {limit} documents")
        
        batch_stats = {
            "processed": 0,
            "failed": 0,
            "skipped": 0,
            "legacy_used": 0,
            "enhanced_used": 0,
            "average_quality": 0.0,
            "errors": []
        }
        
        # Get inbox items
        items = list(self.notion_client.get_inbox_items(limit))
        quality_scores = []
        
        for item in items:
            try:
                # Check if already processed
                status = item['properties'].get('Status', {}).get('select', {}).get('name')
                if status == 'Enriched':
                    batch_stats["skipped"] += 1
                    continue
                    
                # Process item
                result = self.process_document(item['id'])
                
                if result.get("success"):
                    batch_stats["processed"] += 1
                    
                    # Track pipeline usage
                    if result.get("pipeline_used") == "legacy":
                        batch_stats["legacy_used"] += 1
                    else:
                        batch_stats["enhanced_used"] += 1
                        
                    # Track quality
                    quality = result.get("quality_score", 0)
                    if quality > 0:
                        quality_scores.append(quality)
                        
                else:
                    batch_stats["failed"] += 1
                    batch_stats["errors"].append({
                        "document_id": item['id'],
                        "error": result.get("error", "Unknown error")
                    })
                    
                # Rate limiting
                time.sleep(self.pipeline_config.rate_limit_delay)
                
            except Exception as e:
                batch_stats["failed"] += 1
                batch_stats["errors"].append({
                    "document_id": item['id'],
                    "error": str(e)
                })
                
        # Calculate average quality
        if quality_scores:
            batch_stats["average_quality"] = sum(quality_scores) / len(quality_scores)
            
        self.logger.info(f"Batch processing complete: {batch_stats}")
        return batch_stats
        
    def run_comparison_study(self, sample_size: int = 20) -> Dict[str, Any]:
        """Run A/B comparison between legacy and enhanced pipelines."""
        self.logger.info(f"Starting comparison study with {sample_size} documents")
        
        return self.migration_manager.run_side_by_side_comparison(sample_size)
        
    def migrate_to_enhanced_pipeline(
        self,
        batch_size: int = 100,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """Migrate documents to the enhanced pipeline."""
        self.logger.info(f"Starting migration to enhanced pipeline (batch size: {batch_size})")
        
        return self.migration_manager.migrate_batch(batch_size, progress_callback)
        
    def rollback_migration(self, limit: int = 100) -> Dict[str, Any]:
        """Rollback migration to legacy pipeline."""
        self.logger.info(f"Rolling back migration (limit: {limit})")
        
        return self.migration_manager.rollback_migration(limit)
        
    def collect_user_feedback(self, document_id: str) -> Dict[str, Any]:
        """Collect user feedback from a processed document."""
        feedback = self.feedback_collector.extract_feedback_from_page(document_id)
        
        if feedback:
            # Update prompt quality scores based on feedback
            for rating in feedback.get("ratings", []):
                # Associate rating with prompts used for this document
                attribution_data = self.attribution_tracker.get_document_attribution(document_id)
                for record in attribution_data:
                    for analysis in record.get("analyses", []):
                        prompt_id = analysis.get("prompt_id")
                        if prompt_id:
                            self.feedback_collector.update_prompt_quality_score(prompt_id, feedback)
                            
        return feedback or {"message": "No feedback found"}
        
    def generate_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        report = {
            "timestamp": datetime.now().isoformat(),
            "system_performance": dict(self.performance_metrics),
            "feature_usage": self.feature_toggle.get_usage_report(),
            "attribution_performance": self.attribution_tracker.get_performance_report(),
            "feedback_summary": self.feedback_collector.generate_feedback_report(),
            "configuration": {
                "feature_flags": self.integration_config.get_feature_flags(),
                "rollout_config": {
                    "mode": self.integration_config.rollout_mode,
                    "percentage": self.integration_config.rollout_percentage,
                    "ab_test_enabled": self.integration_config.ab_test_enabled
                }
            }
        }
        
        # Add performance analysis
        if self.performance_metrics["quality_scores"]:
            legacy_scores = [s["score"] for s in self.performance_metrics["quality_scores"] if s["variant"] == "legacy"]
            enhanced_scores = [s["score"] for s in self.performance_metrics["quality_scores"] if s["variant"] == "enhanced"]
            
            report["performance_analysis"] = {
                "legacy_avg_quality": sum(legacy_scores) / len(legacy_scores) if legacy_scores else 0,
                "enhanced_avg_quality": sum(enhanced_scores) / len(enhanced_scores) if enhanced_scores else 0,
                "quality_improvement": (
                    (sum(enhanced_scores) / len(enhanced_scores)) - (sum(legacy_scores) / len(legacy_scores))
                    if legacy_scores and enhanced_scores else 0
                )
            }
            
        return report
        
    def get_system_status(self) -> Dict[str, Any]:
        """Get current system status and health."""
        validation_result = self.integration_config.validate_configuration()
        
        status = {
            "system_health": "healthy" if validation_result["valid"] else "degraded",
            "configuration_valid": validation_result["valid"],
            "configuration_issues": validation_result.get("issues", []),
            "feature_flags": self.integration_config.get_feature_flags(),
            "performance_summary": {
                "total_processed": self.performance_metrics["total_processed"],
                "error_rate": (
                    self.performance_metrics["error_count"] / self.performance_metrics["total_processed"]
                    if self.performance_metrics["total_processed"] > 0 else 0
                ),
                "average_processing_time": self.performance_metrics["average_processing_time"],
                "pipeline_distribution": {
                    "legacy": self.performance_metrics["legacy_used"],
                    "enhanced": self.performance_metrics["enhanced_used"]
                }
            },
            "components": {
                "notion_client": "connected",
                "attribution_tracker": "active",
                "feedback_collector": "active",
                "migration_manager": "ready"
            }
        }
        
        return status
        
    def update_feature_flags(self, flags: Dict[str, bool]) -> Dict[str, Any]:
        """Update feature flags configuration."""
        try:
            # Update environment variables
            for flag, value in flags.items():
                env_var = f"ENABLE_{flag.upper()}"
                os.environ[env_var] = str(value).lower()
                
            # Reinitialize configuration
            self.integration_config = IntegrationConfig()
            self.feature_toggle = FeatureToggle(self.integration_config)
            
            self.logger.info(f"Feature flags updated: {flags}")
            
            return {
                "success": True,
                "updated_flags": flags,
                "current_config": self.integration_config.get_feature_flags()
            }
            
        except Exception as e:
            self.logger.error(f"Failed to update feature flags: {e}")
            return {"success": False, "error": str(e)}