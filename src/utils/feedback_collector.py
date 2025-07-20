"""
User feedback collection system for prompt quality improvement.
"""
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger


class FeedbackCollector:
    """Collect and manage user feedback on AI analysis quality."""
    
    def __init__(self, notion_client: NotionClient):
        """Initialize feedback collector."""
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # In-memory feedback store (in production, would use database)
        self.feedback_store = {}
        
    def add_feedback_buttons(self, block_id: str, prompt_id: str) -> List[Dict[str, Any]]:
        """Add inline feedback collection buttons to a Notion block."""
        feedback_blocks = []
        
        # Rating buttons callout
        feedback_blocks.append({
            "type": "callout",
            "callout": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": "Rate this analysis: "},
                        "annotations": {"bold": True}
                    },
                    {
                        "type": "text",
                        "text": {"content": "⭐ ⭐⭐ ⭐⭐⭐ ⭐⭐⭐⭐ ⭐⭐⭐⭐⭐"}
                    }
                ],
                "icon": {"emoji": "💭"},
                "color": "purple_background"
            }
        })
        
        # Comments section
        feedback_blocks.append({
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": "💬 Comments (optional): "},
                        "annotations": {"bold": True}
                    }
                ]
            }
        })
        
        # Empty paragraph for user input
        feedback_blocks.append({
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": "_Click here to add feedback..._"},
                        "annotations": {"italic": True, "color": "gray"}
                    }
                ]
            }
        })
        
        return feedback_blocks
        
    def extract_feedback_from_page(self, page_id: str) -> Optional[Dict[str, Any]]:
        """Extract user feedback from a Notion page."""
        try:
            blocks = self.notion_client.client.blocks.children.list(block_id=page_id)
            
            feedback_data = {
                "page_id": page_id,
                "ratings": [],
                "comments": [],
                "timestamp": datetime.now().isoformat()
            }
            
            # Look for feedback patterns in blocks
            for block in blocks['results']:
                feedback_data.update(self._extract_feedback_from_block(block))
                
            return feedback_data if feedback_data["ratings"] or feedback_data["comments"] else None
            
        except Exception as e:
            self.logger.error(f"Failed to extract feedback from page {page_id}: {e}")
            return None
            
    def _extract_feedback_from_block(self, block: Dict) -> Dict[str, Any]:
        """Extract feedback from a single block."""
        feedback = {"ratings": [], "comments": []}
        
        block_type = block.get("type")
        
        if block_type == "callout":
            # Look for star ratings in callout
            rich_text = block.get("callout", {}).get("rich_text", [])
            text_content = "".join(item.get("text", {}).get("content", "") for item in rich_text)
            
            # Count consecutive stars as rating
            star_count = self._count_consecutive_stars(text_content)
            if star_count > 0:
                feedback["ratings"].append(star_count)
                
        elif block_type == "paragraph":
            # Look for comment text
            rich_text = block.get("paragraph", {}).get("rich_text", [])
            text_content = "".join(item.get("text", {}).get("content", "") for item in rich_text)
            
            # Skip placeholder text
            if text_content and not text_content.startswith("_Click here"):
                # Look for comment indicators
                if any(indicator in text_content.lower() for indicator in ["comment:", "feedback:", "note:"]):
                    feedback["comments"].append(text_content)
                    
        return feedback
        
    def _count_consecutive_stars(self, text: str) -> int:
        """Count consecutive star emojis for rating."""
        import re
        
        # Look for consecutive star patterns
        star_matches = re.findall(r'⭐+', text)
        if star_matches:
            return len(max(star_matches, key=len))
        return 0
        
    def update_prompt_quality_score(self, prompt_id: str, feedback: Dict[str, Any]):
        """Update prompt quality score based on user feedback."""
        if prompt_id not in self.feedback_store:
            self.feedback_store[prompt_id] = {
                "total_ratings": 0,
                "rating_sum": 0,
                "rating_count": 0,
                "comments": [],
                "last_updated": None
            }
            
        prompt_feedback = self.feedback_store[prompt_id]
        
        # Process ratings
        for rating in feedback.get("ratings", []):
            if 1 <= rating <= 5:
                prompt_feedback["rating_sum"] += rating
                prompt_feedback["rating_count"] += 1
                
        # Store comments
        for comment in feedback.get("comments", []):
            prompt_feedback["comments"].append({
                "text": comment,
                "timestamp": feedback.get("timestamp"),
                "page_id": feedback.get("page_id")
            })
            
        prompt_feedback["last_updated"] = datetime.now().isoformat()
        
        # Calculate new average
        if prompt_feedback["rating_count"] > 0:
            prompt_feedback["average_rating"] = prompt_feedback["rating_sum"] / prompt_feedback["rating_count"]
            
        self.logger.info(f"Updated prompt {prompt_id} quality score: {prompt_feedback.get('average_rating', 0):.2f}")
        
    def get_prompt_feedback_summary(self, prompt_id: str) -> Dict[str, Any]:
        """Get feedback summary for a specific prompt."""
        if prompt_id not in self.feedback_store:
            return {
                "prompt_id": prompt_id,
                "average_rating": 0,
                "total_ratings": 0,
                "total_comments": 0,
                "recent_comments": []
            }
            
        feedback = self.feedback_store[prompt_id]
        
        return {
            "prompt_id": prompt_id,
            "average_rating": feedback.get("average_rating", 0),
            "total_ratings": feedback.get("rating_count", 0),
            "total_comments": len(feedback.get("comments", [])),
            "recent_comments": feedback.get("comments", [])[-5:],  # Last 5 comments
            "last_updated": feedback.get("last_updated")
        }
        
    def generate_feedback_report(self) -> Dict[str, Any]:
        """Generate comprehensive feedback report."""
        report = {
            "summary": {
                "total_prompts_with_feedback": len(self.feedback_store),
                "total_ratings": 0,
                "total_comments": 0,
                "average_rating_across_prompts": 0
            },
            "prompt_rankings": [],
            "improvement_suggestions": []
        }
        
        # Calculate summary metrics
        total_rating_sum = 0
        total_rating_count = 0
        
        for prompt_id, feedback in self.feedback_store.items():
            report["summary"]["total_ratings"] += feedback.get("rating_count", 0)
            report["summary"]["total_comments"] += len(feedback.get("comments", []))
            
            rating_sum = feedback.get("rating_sum", 0)
            rating_count = feedback.get("rating_count", 0)
            
            total_rating_sum += rating_sum
            total_rating_count += rating_count
            
            # Add to rankings
            report["prompt_rankings"].append({
                "prompt_id": prompt_id,
                "average_rating": feedback.get("average_rating", 0),
                "total_ratings": rating_count,
                "total_comments": len(feedback.get("comments", []))
            })
            
        # Calculate overall average
        if total_rating_count > 0:
            report["summary"]["average_rating_across_prompts"] = total_rating_sum / total_rating_count
            
        # Sort rankings by average rating
        report["prompt_rankings"].sort(key=lambda x: x["average_rating"], reverse=True)
        
        # Generate improvement suggestions
        report["improvement_suggestions"] = self._generate_improvement_suggestions()
        
        return report
        
    def _generate_improvement_suggestions(self) -> List[str]:
        """Generate suggestions based on feedback patterns."""
        suggestions = []
        
        if not self.feedback_store:
            return ["No feedback data available. Encourage users to rate AI analyses."]
            
        # Analyze ratings
        low_rated_prompts = []
        high_rated_prompts = []
        
        for prompt_id, feedback in self.feedback_store.items():
            avg_rating = feedback.get("average_rating", 0)
            rating_count = feedback.get("rating_count", 0)
            
            if rating_count >= 3:  # Minimum ratings for significance
                if avg_rating < 3:
                    low_rated_prompts.append((prompt_id, avg_rating))
                elif avg_rating >= 4:
                    high_rated_prompts.append((prompt_id, avg_rating))
                    
        # Suggestions for low-rated prompts
        if low_rated_prompts:
            suggestions.append(
                f"Review and improve {len(low_rated_prompts)} prompts with ratings below 3.0: "
                f"{', '.join(p[0] for p in low_rated_prompts[:3])}"
            )
            
        # Learn from high-rated prompts
        if high_rated_prompts:
            best_prompt = max(high_rated_prompts, key=lambda x: x[1])
            suggestions.append(
                f"Apply patterns from highest-rated prompt '{best_prompt[0]}' "
                f"(rating: {best_prompt[1]:.1f}) to other prompts"
            )
            
        # Comment analysis
        all_comments = []
        for feedback in self.feedback_store.values():
            all_comments.extend(feedback.get("comments", []))
            
        if all_comments:
            # Look for common themes in comments
            common_issues = self._analyze_comment_themes(all_comments)
            for issue in common_issues:
                suggestions.append(f"Address common feedback theme: {issue}")
                
        if not suggestions:
            suggestions.append("Feedback quality is good. Continue monitoring user satisfaction.")
            
        return suggestions
        
    def _analyze_comment_themes(self, comments: List[Dict]) -> List[str]:
        """Analyze comments for common themes."""
        # Simple keyword analysis (in production, would use NLP)
        themes = []
        
        comment_texts = [c.get("text", "").lower() for c in comments]
        all_text = " ".join(comment_texts)
        
        # Common feedback themes
        if "too long" in all_text or "lengthy" in all_text:
            themes.append("Content length - users prefer shorter analyses")
            
        if "unclear" in all_text or "confusing" in all_text:
            themes.append("Clarity - improve explanation quality")
            
        if "missing" in all_text or "incomplete" in all_text:
            themes.append("Completeness - ensure all aspects are covered")
            
        if "slow" in all_text or "takes time" in all_text:
            themes.append("Performance - optimize processing speed")
            
        if "accurate" in all_text or "correct" in all_text:
            themes.append("Accuracy - users appreciate precise analysis")
            
        return themes
        
    def schedule_feedback_collection(self, page_id: str, delay_hours: int = 24):
        """Schedule automatic feedback collection from a page."""
        # In production, this would use a task queue
        collection_time = datetime.now()
        
        self.logger.info(
            f"Scheduled feedback collection for page {page_id} "
            f"(would run after {delay_hours} hours)"
        )
        
        # Store scheduling info
        if "scheduled_collections" not in self.feedback_store:
            self.feedback_store["scheduled_collections"] = []
            
        self.feedback_store["scheduled_collections"].append({
            "page_id": page_id,
            "scheduled_time": collection_time.isoformat(),
            "delay_hours": delay_hours,
            "status": "scheduled"
        })
        
    def export_feedback_data(self) -> str:
        """Export all feedback data as JSON."""
        export_data = {
            "export_timestamp": datetime.now().isoformat(),
            "feedback_store": self.feedback_store,
            "summary": self.generate_feedback_report()["summary"]
        }
        
        return json.dumps(export_data, indent=2)
        
    def import_feedback_data(self, json_data: str):
        """Import feedback data from JSON."""
        try:
            import_data = json.loads(json_data)
            
            if "feedback_store" in import_data:
                # Merge with existing data
                for prompt_id, feedback in import_data["feedback_store"].items():
                    if prompt_id in self.feedback_store:
                        # Merge ratings and comments
                        existing = self.feedback_store[prompt_id]
                        existing["rating_sum"] += feedback.get("rating_sum", 0)
                        existing["rating_count"] += feedback.get("rating_count", 0)
                        existing["comments"].extend(feedback.get("comments", []))
                        
                        # Recalculate average
                        if existing["rating_count"] > 0:
                            existing["average_rating"] = existing["rating_sum"] / existing["rating_count"]
                    else:
                        self.feedback_store[prompt_id] = feedback
                        
            self.logger.info("Feedback data imported successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to import feedback data: {e}")
            raise