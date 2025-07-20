"""
Migration manager for deploying the integrated pipeline.
"""
import time
import json
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime
from ..core.notion_client import NotionClient
from ..core.integration_config import IntegrationConfig
from ..enrichment.pipeline_processor import PipelineProcessor
from ..enrichment.prompt_aware_pipeline import PromptAwarePipeline
from ..utils.logging import setup_logger


class MigrationManager:
    """Manage migration to the new prompt-aware pipeline."""
    
    def __init__(
        self,
        config: IntegrationConfig,
        notion_client: NotionClient,
        old_pipeline: PipelineProcessor,
        new_pipeline: PromptAwarePipeline
    ):
        """Initialize migration manager."""
        self.config = config
        self.notion_client = notion_client
        self.old_pipeline = old_pipeline
        self.new_pipeline = new_pipeline
        self.logger = setup_logger(__name__)
        
        # Migration state
        self.migration_stats = {
            "total_documents": 0,
            "migrated": 0,
            "failed": 0,
            "skipped": 0,
            "start_time": None,
            "end_time": None,
            "performance_comparisons": []
        }
        
    def run_side_by_side_comparison(self, limit: int = 10) -> Dict[str, Any]:
        """Run side-by-side comparison of old vs new pipeline."""
        self.logger.info(f"Starting side-by-side comparison with {limit} documents")
        
        comparison_results = {
            "documents_compared": 0,
            "old_pipeline_wins": 0,
            "new_pipeline_wins": 0,
            "ties": 0,
            "detailed_results": []
        }
        
        # Get documents for comparison
        items = list(self.notion_client.get_inbox_items(limit))
        comparison_results["documents_compared"] = len(items)
        
        for item in items:
            try:
                result = self._compare_pipelines_for_item(item)
                comparison_results["detailed_results"].append(result)
                
                # Track wins
                if result["winner"] == "old":
                    comparison_results["old_pipeline_wins"] += 1
                elif result["winner"] == "new":
                    comparison_results["new_pipeline_wins"] += 1
                else:
                    comparison_results["ties"] += 1
                    
            except Exception as e:
                self.logger.error(f"Comparison failed for item {item['id']}: {e}")
                
        # Calculate overall metrics
        comparison_results["new_pipeline_win_rate"] = (
            comparison_results["new_pipeline_wins"] / comparison_results["documents_compared"]
            if comparison_results["documents_compared"] > 0 else 0
        )
        
        self.logger.info(
            f"Comparison complete: New pipeline wins {comparison_results['new_pipeline_win_rate']:.1%} "
            f"({comparison_results['new_pipeline_wins']}/{comparison_results['documents_compared']})"
        )
        
        return comparison_results
        
    def _compare_pipelines_for_item(self, item: Dict) -> Dict[str, Any]:
        """Compare both pipelines for a single item."""
        item_id = item['id']
        title = item['properties']['Title']['title'][0]['text']['content']
        
        # Extract content once
        content = self.old_pipeline._extract_content(item)
        if not content:
            return {"item_id": item_id, "error": "No content to compare"}
            
        # Run old pipeline
        old_start = time.time()
        try:
            old_result = self.old_pipeline.enrich_content(content, item)
            old_time = time.time() - old_start
            old_success = True
        except Exception as e:
            old_result = None
            old_time = time.time() - old_start
            old_success = False
            self.logger.error(f"Old pipeline failed for {item_id}: {e}")
            
        # Run new pipeline (mocked since it requires different input format)
        new_start = time.time()
        try:
            # Create source content object
            from ..core.models import SourceContent
            source = SourceContent(
                id=item_id,
                title=title,
                content=content,
                source_type="notion"
            )
            
            new_result = self.new_pipeline.process_with_attribution(source)
            new_time = time.time() - new_start
            new_success = new_result.get("success", False)
        except Exception as e:
            new_result = None
            new_time = time.time() - new_start
            new_success = False
            self.logger.error(f"New pipeline failed for {item_id}: {e}")
            
        # Compare results
        comparison = {
            "item_id": item_id,
            "title": title,
            "old_pipeline": {
                "success": old_success,
                "processing_time": old_time,
                "quality_score": getattr(old_result, 'quality_score', 0) if old_result else 0
            },
            "new_pipeline": {
                "success": new_success,
                "processing_time": new_time,
                "has_attribution": bool(new_result and new_result.get("attribution"))
            },
            "winner": self._determine_winner(old_result, new_result, old_time, new_time)
        }
        
        return comparison
        
    def _determine_winner(
        self,
        old_result: Any,
        new_result: Any,
        old_time: float,
        new_time: float
    ) -> str:
        """Determine which pipeline performed better."""
        # If only one succeeded, it wins
        if old_result and not new_result:
            return "old"
        elif new_result and not old_result:
            return "new"
        elif not old_result and not new_result:
            return "tie"
            
        # Both succeeded - compare quality and features
        old_quality = getattr(old_result, 'quality_score', 0)
        
        # New pipeline wins if it has attribution and similar quality
        if new_result.get("attribution") and old_quality > 0:
            # New pipeline provides additional value through attribution
            return "new"
        elif old_quality > 0.8 and new_time > old_time * 2:
            # Old pipeline wins if much faster with good quality
            return "old"
        else:
            # Default to new pipeline for additional features
            return "new"
            
    def migrate_batch(
        self,
        batch_size: Optional[int] = None,
        progress_callback: Optional[Callable[[Dict], None]] = None
    ) -> Dict[str, Any]:
        """Migrate a batch of documents to the new pipeline."""
        if batch_size is None:
            batch_size = self.config.migration_batch_size
            
        self.logger.info(f"Starting batch migration of {batch_size} documents")
        self.migration_stats["start_time"] = datetime.now()
        
        # Get documents to migrate
        items = list(self.notion_client.get_inbox_items(batch_size))
        self.migration_stats["total_documents"] = len(items)
        
        for i, item in enumerate(items):
            try:
                # Check if we should use new pipeline for this item
                should_migrate = self.config.should_use_new_pipeline(item['id'])
                
                if should_migrate:
                    self._migrate_single_item(item)
                    self.migration_stats["migrated"] += 1
                else:
                    self.migration_stats["skipped"] += 1
                    
                # Progress callback
                if progress_callback:
                    progress = {
                        "current": i + 1,
                        "total": len(items),
                        "migrated": self.migration_stats["migrated"],
                        "failed": self.migration_stats["failed"],
                        "percentage": (i + 1) / len(items) * 100
                    }
                    progress_callback(progress)
                    
                # Rate limiting
                time.sleep(self.config.migration_delay_seconds)
                
            except Exception as e:
                self.logger.error(f"Migration failed for item {item['id']}: {e}")
                self.migration_stats["failed"] += 1
                
        self.migration_stats["end_time"] = datetime.now()
        
        self.logger.info(
            f"Migration complete: {self.migration_stats['migrated']} migrated, "
            f"{self.migration_stats['failed']} failed, "
            f"{self.migration_stats['skipped']} skipped"
        )
        
        return dict(self.migration_stats)
        
    def _migrate_single_item(self, item: Dict):
        """Migrate a single item to the new pipeline."""
        item_id = item['id']
        
        # Extract content
        content = self.old_pipeline._extract_content(item)
        if not content:
            raise ValueError("No content to migrate")
            
        # Create source content object
        from ..core.models import SourceContent
        source = SourceContent(
            id=item_id,
            title=item['properties']['Title']['title'][0]['text']['content'],
            content=content,
            source_type="notion"
        )
        
        # Process with new pipeline
        result = self.new_pipeline.process_with_attribution(source)
        
        if not result.get("success"):
            raise Exception("New pipeline processing failed")
            
        # Update the Notion page with new format
        self._update_page_with_new_format(item_id, result)
        
    def _update_page_with_new_format(self, page_id: str, result: Dict):
        """Update Notion page with new attribution format."""
        # Update properties to indicate migration
        properties = {
            "Status": {"select": {"name": "Enriched"}},
            "Migration-Status": {"select": {"name": "Migrated"}}
        }
        
        # Add quality indicator if available
        if result.get("dashboard") and "key_metrics" in result["dashboard"]:
            metrics = result["dashboard"]["key_metrics"]
            if "Quality" in metrics:
                properties["Quality"] = {"select": {"name": metrics["Quality"]}}
                
        self.notion_client.client.pages.update(page_id=page_id, properties=properties)
        
        # Replace page content with new format
        if result.get("notion_page"):
            notion_page = result["notion_page"]
            
            # Clear existing content
            self._clear_page_content(page_id)
            
            # Add new content
            if notion_page.get("children"):
                self.notion_client.add_content_blocks(page_id, notion_page["children"])
                
    def _clear_page_content(self, page_id: str):
        """Clear existing page content before migration."""
        try:
            blocks = self.notion_client.client.blocks.children.list(block_id=page_id)
            
            # Delete existing blocks
            for block in blocks['results']:
                if block['type'] not in ['breadcrumb']:  # Keep navigation elements
                    self.notion_client.client.blocks.delete(block_id=block['id'])
                    
        except Exception as e:
            self.logger.warning(f"Could not clear page content for {page_id}: {e}")
            
    def rollback_migration(self, limit: int = 100) -> Dict[str, Any]:
        """Rollback migrated documents to original format."""
        self.logger.info(f"Starting rollback of up to {limit} documents")
        
        rollback_stats = {
            "total_checked": 0,
            "rolled_back": 0,
            "failed": 0
        }
        
        # Find migrated documents
        try:
            # Query for documents with Migration-Status = "Migrated"
            query_filter = {
                "property": "Migration-Status",
                "select": {"equals": "Migrated"}
            }
            
            response = self.notion_client.client.databases.query(
                database_id=self.notion_client.db_id,
                filter=query_filter,
                page_size=min(limit, 100)
            )
            
            for item in response['results']:
                rollback_stats["total_checked"] += 1
                
                try:
                    self._rollback_single_item(item)
                    rollback_stats["rolled_back"] += 1
                except Exception as e:
                    self.logger.error(f"Rollback failed for {item['id']}: {e}")
                    rollback_stats["failed"] += 1
                    
        except Exception as e:
            self.logger.error(f"Rollback query failed: {e}")
            
        self.logger.info(
            f"Rollback complete: {rollback_stats['rolled_back']} rolled back, "
            f"{rollback_stats['failed']} failed"
        )
        
        return rollback_stats
        
    def _rollback_single_item(self, item: Dict):
        """Rollback a single item to original format."""
        page_id = item['id']
        
        # Extract content for reprocessing
        content = self.old_pipeline._extract_content(item)
        if not content:
            raise ValueError("No content for rollback")
            
        # Process with old pipeline
        result = self.old_pipeline.enrich_content(content, item)
        
        # Update with old format
        self.old_pipeline._store_results(item, result, content)
        
        # Update migration status
        properties = {
            "Migration-Status": {"select": {"name": "Rolled Back"}}
        }
        self.notion_client.client.pages.update(page_id=page_id, properties=properties)
        
    def generate_migration_report(self) -> Dict[str, Any]:
        """Generate comprehensive migration report."""
        end_time = self.migration_stats.get("end_time") or datetime.now()
        start_time = self.migration_stats.get("start_time") or end_time
        duration = (end_time - start_time).total_seconds()
        
        report = {
            "summary": dict(self.migration_stats),
            "performance": {
                "duration_seconds": duration,
                "documents_per_second": self.migration_stats["total_documents"] / duration if duration > 0 else 0,
                "success_rate": (
                    self.migration_stats["migrated"] / self.migration_stats["total_documents"]
                    if self.migration_stats["total_documents"] > 0 else 0
                )
            },
            "configuration": {
                "batch_size": self.config.migration_batch_size,
                "delay_seconds": self.config.migration_delay_seconds,
                "rollout_mode": self.config.rollout_mode,
                "rollout_percentage": self.config.rollout_percentage
            },
            "recommendations": self._generate_migration_recommendations()
        }
        
        return report
        
    def _generate_migration_recommendations(self) -> List[str]:
        """Generate recommendations based on migration performance."""
        recommendations = []
        
        success_rate = (
            self.migration_stats["migrated"] / self.migration_stats["total_documents"]
            if self.migration_stats["total_documents"] > 0 else 0
        )
        
        if success_rate < 0.95:
            recommendations.append(
                f"Success rate is {success_rate:.1%}. Consider investigating failure causes."
            )
            
        if self.migration_stats["failed"] > 0:
            recommendations.append(
                f"{self.migration_stats['failed']} documents failed migration. "
                "Review error logs and consider retry mechanism."
            )
            
        if self.config.migration_delay_seconds > 2:
            recommendations.append(
                "Migration delay is high. Consider reducing for faster processing."
            )
            
        if len(recommendations) == 0:
            recommendations.append("Migration completed successfully with no issues detected.")
            
        return recommendations