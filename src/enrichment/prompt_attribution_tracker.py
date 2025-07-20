"""
Prompt attribution tracking and management system.
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import defaultdict
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger


class PromptAttributionTracker:
    """Track and manage prompt attribution data."""
    
    def __init__(self, notion_client: NotionClient):
        """Initialize attribution tracker."""
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # In-memory cache for attribution data
        self.attribution_cache = defaultdict(list)
        
        # Performance metrics
        self.prompt_performance = defaultdict(lambda: {
            "total_uses": 0,
            "avg_quality": 0.0,
            "avg_processing_time": 0.0,
            "user_ratings": [],
            "web_search_uses": 0,
            "failure_count": 0
        })
        
        # Load historical data if available
        self._load_historical_data()
        
    def _load_historical_data(self):
        """Load historical attribution data from storage."""
        # In production, this would load from a database
        # For now, we'll just initialize empty
        pass
        
    def store_attribution(
        self,
        document_id: str,
        analysis_results: List[Any],
        processing_time: float
    ):
        """Store attribution data for a processed document."""
        attribution_record = {
            "document_id": document_id,
            "timestamp": datetime.now().isoformat(),
            "processing_time": processing_time,
            "analyses": []
        }
        
        for result in analysis_results:
            if hasattr(result, 'prompt_used') and result.prompt_used:
                prompt = result.prompt_used
                
                # Store analysis attribution
                analysis_record = {
                    "prompt_id": prompt.prompt_id,
                    "prompt_name": prompt.prompt_name,
                    "version": prompt.version,
                    "quality_score": result.quality_score,
                    "processing_time": result.processing_time,
                    "web_sources_count": len(result.web_sources) if hasattr(result, 'web_sources') else 0
                }
                attribution_record["analyses"].append(analysis_record)
                
                # Update performance metrics
                self._update_performance_metrics(prompt.prompt_id, result)
                
        # Store in cache
        self.attribution_cache[document_id].append(attribution_record)
        
        # Persist to storage (async in production)
        self._persist_attribution(attribution_record)
        
    def _update_performance_metrics(self, prompt_id: str, result: Any):
        """Update performance metrics for a prompt."""
        metrics = self.prompt_performance[prompt_id]
        
        # Update counters
        metrics["total_uses"] += 1
        
        # Update averages
        total = metrics["total_uses"]
        metrics["avg_quality"] = (
            (metrics["avg_quality"] * (total - 1) + result.quality_score) / total
        )
        metrics["avg_processing_time"] = (
            (metrics["avg_processing_time"] * (total - 1) + result.processing_time) / total
        )
        
        # Track web search usage
        if hasattr(result, 'web_sources') and result.web_sources:
            metrics["web_search_uses"] += 1
            
        # Track failures
        if result.quality_score < 0.3:
            metrics["failure_count"] += 1
            
    def _persist_attribution(self, record: Dict):
        """Persist attribution record to storage."""
        # In production, this would write to a database
        # For now, we'll log it
        self.logger.info(f"Attribution stored for document {record['document_id']}")
        
    def get_prompt_performance(self, prompt_id: str) -> Dict[str, Any]:
        """Get performance metrics for a specific prompt."""
        return dict(self.prompt_performance.get(prompt_id, {}))
        
    def get_document_attribution(self, document_id: str) -> List[Dict]:
        """Get all attribution records for a document."""
        return list(self.attribution_cache.get(document_id, []))
        
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate a comprehensive performance report."""
        report = {
            "summary": {
                "total_prompts": len(self.prompt_performance),
                "total_documents": len(self.attribution_cache),
                "avg_quality_across_prompts": 0.0,
                "web_search_usage_rate": 0.0
            },
            "prompt_details": {},
            "recommendations": []
        }
        
        # Calculate summary metrics
        if self.prompt_performance:
            total_quality = sum(m["avg_quality"] for m in self.prompt_performance.values())
            report["summary"]["avg_quality_across_prompts"] = total_quality / len(self.prompt_performance)
            
            total_uses = sum(m["total_uses"] for m in self.prompt_performance.values())
            total_web = sum(m["web_search_uses"] for m in self.prompt_performance.values())
            if total_uses > 0:
                report["summary"]["web_search_usage_rate"] = total_web / total_uses
                
        # Add prompt details
        for prompt_id, metrics in self.prompt_performance.items():
            report["prompt_details"][prompt_id] = {
                "performance": metrics,
                "health_status": self._calculate_health_status(metrics)
            }
            
        # Generate recommendations
        report["recommendations"] = self._generate_recommendations()
        
        return report
        
    def _calculate_health_status(self, metrics: Dict) -> str:
        """Calculate health status for a prompt."""
        if metrics["total_uses"] < 10:
            return "insufficient_data"
            
        failure_rate = metrics["failure_count"] / metrics["total_uses"]
        
        if metrics["avg_quality"] >= 0.8 and failure_rate < 0.05:
            return "excellent"
        elif metrics["avg_quality"] >= 0.6 and failure_rate < 0.1:
            return "good"
        elif metrics["avg_quality"] >= 0.4 and failure_rate < 0.2:
            return "fair"
        else:
            return "needs_improvement"
            
    def _generate_recommendations(self) -> List[str]:
        """Generate recommendations based on performance data."""
        recommendations = []
        
        for prompt_id, metrics in self.prompt_performance.items():
            if metrics["total_uses"] < 10:
                continue
                
            # Quality recommendations
            if metrics["avg_quality"] < 0.6:
                recommendations.append(
                    f"Prompt {prompt_id} has low quality score ({metrics['avg_quality']:.2f}). "
                    "Consider revising the prompt template."
                )
                
            # Performance recommendations
            if metrics["avg_processing_time"] > 10:
                recommendations.append(
                    f"Prompt {prompt_id} has high processing time ({metrics['avg_processing_time']:.1f}s). "
                    "Consider optimizing or using a faster model."
                )
                
            # Failure rate recommendations
            failure_rate = metrics["failure_count"] / metrics["total_uses"]
            if failure_rate > 0.1:
                recommendations.append(
                    f"Prompt {prompt_id} has high failure rate ({failure_rate:.1%}). "
                    "Review failed cases and adjust error handling."
                )
                
        return recommendations
        
    def add_user_feedback(self, document_id: str, prompt_id: str, rating: int, comment: Optional[str] = None):
        """Add user feedback for a specific prompt usage."""
        feedback_record = {
            "document_id": document_id,
            "prompt_id": prompt_id,
            "rating": rating,
            "comment": comment,
            "timestamp": datetime.now().isoformat()
        }
        
        # Update prompt performance with rating
        if prompt_id in self.prompt_performance:
            self.prompt_performance[prompt_id]["user_ratings"].append(rating)
            
        # Store feedback
        self._persist_feedback(feedback_record)
        
    def _persist_feedback(self, feedback: Dict):
        """Persist user feedback."""
        self.logger.info(f"Feedback stored: {feedback['rating']}/5 for prompt {feedback['prompt_id']}")
        
    def get_prompt_suggestions(self, content_type: str) -> List[Dict]:
        """Get prompt suggestions based on performance data."""
        suggestions = []
        
        # Find prompts used for this content type
        relevant_prompts = []
        for prompt_id, metrics in self.prompt_performance.items():
            if metrics["total_uses"] > 5:  # Minimum usage threshold
                relevant_prompts.append({
                    "prompt_id": prompt_id,
                    "quality": metrics["avg_quality"],
                    "speed": 1 / metrics["avg_processing_time"],  # Higher is better
                    "reliability": 1 - (metrics["failure_count"] / metrics["total_uses"])
                })
                
        # Sort by combined score
        relevant_prompts.sort(
            key=lambda p: p["quality"] * 0.5 + p["speed"] * 0.3 + p["reliability"] * 0.2,
            reverse=True
        )
        
        # Return top suggestions
        for prompt in relevant_prompts[:3]:
            suggestions.append({
                "prompt_id": prompt["prompt_id"],
                "recommendation_score": prompt["quality"] * 0.5 + prompt["speed"] * 0.3 + prompt["reliability"] * 0.2,
                "quality_score": prompt["quality"],
                "performance_score": prompt["speed"],
                "reliability_score": prompt["reliability"]
            })
            
        return suggestions