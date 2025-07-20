"""
Prompt Management API
=====================

RESTful API for managing prompts, viewing analytics, and handling feedback
in the prompt-aware content assembly system.
"""

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
from uuid import UUID
import os
from ..enrichment.prompt_aware_enrichment import PromptAwareEnrichmentPipeline
from ..core.config import PipelineConfig
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger


# Pydantic models for API

class PromptCreateRequest(BaseModel):
    """Request model for creating a new prompt."""
    name: str
    analyzer_type: str
    content_type: str
    system_prompt: str
    user_prompt_template: str
    temperature: float = 0.3
    web_search: bool = False
    quality_threshold: float = 0.7
    version: float = 1.0
    active: bool = True


class PromptUpdateRequest(BaseModel):
    """Request model for updating a prompt."""
    system_prompt: Optional[str] = None
    user_prompt_template: Optional[str] = None
    temperature: Optional[float] = None
    web_search: Optional[bool] = None
    quality_threshold: Optional[float] = None
    active: Optional[bool] = None
    performance_notes: Optional[str] = None


class FeedbackRequest(BaseModel):
    """Request model for submitting feedback."""
    page_id: str
    result_id: str
    rating: float = Field(ge=1, le=5)
    useful: bool
    acted_on: bool
    feedback_text: Optional[str] = None


class ABTestRequest(BaseModel):
    """Request model for creating an A/B test."""
    test_name: str
    analyzer_type: str
    content_type: str
    control_prompt_id: str
    variant_prompt_ids: List[str]
    traffic_split: Dict[str, float]  # e.g., {"control": 0.5, "variant_a": 0.5}
    success_metric: str = "quality_score"  # or "user_rating", "acted_on_rate"


class AnalyticsQuery(BaseModel):
    """Query parameters for analytics endpoints."""
    prompt_id: Optional[str] = None
    analyzer_type: Optional[str] = None
    content_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_quality: Optional[float] = None
    limit: int = 100


# FastAPI app initialization

app = FastAPI(
    title="Prompt Management API",
    description="API for managing AI prompts and collecting performance analytics",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
logger = setup_logger(__name__)
pipeline_config = PipelineConfig()
notion_client = NotionClient(pipeline_config.notion)
enrichment_pipeline = PromptAwareEnrichmentPipeline(pipeline_config, notion_client)


# API Endpoints

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Prompt Management API",
        "version": "1.0.0",
        "endpoints": {
            "prompts": "/prompts",
            "analytics": "/analytics",
            "feedback": "/feedback",
            "ab_tests": "/ab_tests"
        }
    }


# Prompt Management Endpoints

@app.get("/prompts")
async def list_prompts(
    active_only: bool = True,
    analyzer_type: Optional[str] = None,
    content_type: Optional[str] = None
):
    """List all prompts with optional filtering."""
    try:
        prompts = enrichment_pipeline._get_prompts_for_content_type(
            content_type or "general"
        )
        
        # Apply filters
        if analyzer_type:
            prompts = [p for p in prompts if p["analyzer_type"] == analyzer_type]
        
        if active_only:
            prompts = [p for p in prompts if p.get("active", True)]
        
        return {
            "count": len(prompts),
            "prompts": prompts
        }
    except Exception as e:
        logger.error(f"Failed to list prompts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/prompts/{prompt_id}")
async def get_prompt(prompt_id: str):
    """Get a specific prompt by ID."""
    try:
        # Fetch from Notion
        prompt_page = notion_client.client.pages.retrieve(page_id=prompt_id)
        
        # Parse properties
        props = prompt_page["properties"]
        prompt_data = {
            "id": prompt_id,
            "name": enrichment_pipeline._get_property_value(props.get("Name")),
            "analyzer_type": enrichment_pipeline._get_property_value(props.get("Analyzer Type")),
            "content_type": enrichment_pipeline._get_property_value(props.get("Content Type")),
            "system_prompt": enrichment_pipeline._get_property_value(props.get("System Prompt")),
            "user_prompt_template": enrichment_pipeline._get_property_value(props.get("User Prompt Template")),
            "version": enrichment_pipeline._get_property_value(props.get("Version"), 1.0),
            "active": enrichment_pipeline._get_property_value(props.get("Active"), True),
            "temperature": enrichment_pipeline._get_property_value(props.get("Temperature"), 0.3),
            "web_search": enrichment_pipeline._get_property_value(props.get("Web Search"), False),
            "quality_threshold": enrichment_pipeline._get_property_value(props.get("Quality Threshold"), 0.7),
            "usage_count": enrichment_pipeline._get_property_value(props.get("Usage Count"), 0),
            "average_quality_score": enrichment_pipeline._get_property_value(props.get("Average Quality Score"), 0),
            "average_user_rating": enrichment_pipeline._get_property_value(props.get("Average User Rating"), 0),
            "last_used": enrichment_pipeline._get_property_value(props.get("Last Used")),
            "created": prompt_page["created_time"],
            "last_edited": prompt_page["last_edited_time"]
        }
        
        return prompt_data
        
    except Exception as e:
        logger.error(f"Failed to get prompt {prompt_id}: {e}")
        raise HTTPException(status_code=404, detail="Prompt not found")


@app.post("/prompts")
async def create_prompt(request: PromptCreateRequest):
    """Create a new prompt."""
    try:
        # Create in Notion
        properties = {
            "Name": {"title": [{"text": {"content": request.name}}]},
            "Analyzer Type": {"select": {"name": request.analyzer_type}},
            "Content Type": {"select": {"name": request.content_type}},
            "System Prompt": {"rich_text": [{"text": {"content": request.system_prompt}}]},
            "User Prompt Template": {"rich_text": [{"text": {"content": request.user_prompt_template}}]},
            "Version": {"number": request.version},
            "Active": {"checkbox": request.active},
            "Temperature": {"number": request.temperature},
            "Web Search": {"checkbox": request.web_search},
            "Quality Threshold": {"number": request.quality_threshold},
            "Usage Count": {"number": 0},
            "Average Quality Score": {"number": 0},
            "Average User Rating": {"number": 0}
        }
        
        response = notion_client.client.pages.create(
            parent={"database_id": enrichment_pipeline.prompt_db_id},
            properties=properties
        )
        
        return {
            "id": response["id"],
            "message": "Prompt created successfully",
            "url": f"https://notion.so/{response['id'].replace('-', '')}"
        }
        
    except Exception as e:
        logger.error(f"Failed to create prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/prompts/{prompt_id}")
async def update_prompt(prompt_id: str, request: PromptUpdateRequest):
    """Update an existing prompt."""
    try:
        # Build update properties
        properties = {}
        
        if request.system_prompt is not None:
            properties["System Prompt"] = {"rich_text": [{"text": {"content": request.system_prompt}}]}
        if request.user_prompt_template is not None:
            properties["User Prompt Template"] = {"rich_text": [{"text": {"content": request.user_prompt_template}}]}
        if request.temperature is not None:
            properties["Temperature"] = {"number": request.temperature}
        if request.web_search is not None:
            properties["Web Search"] = {"checkbox": request.web_search}
        if request.quality_threshold is not None:
            properties["Quality Threshold"] = {"number": request.quality_threshold}
        if request.active is not None:
            properties["Active"] = {"checkbox": request.active}
        if request.performance_notes is not None:
            properties["Performance Notes"] = {"rich_text": [{"text": {"content": request.performance_notes}}]}
        
        # Update version
        current = await get_prompt(prompt_id)
        properties["Version"] = {"number": current["version"] + 0.1}
        
        notion_client.client.pages.update(
            page_id=prompt_id,
            properties=properties
        )
        
        return {"message": "Prompt updated successfully", "new_version": current["version"] + 0.1}
        
    except Exception as e:
        logger.error(f"Failed to update prompt {prompt_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/prompts/{prompt_id}/duplicate")
async def duplicate_prompt(prompt_id: str, new_name: str = Body(...)):
    """Create a copy of an existing prompt."""
    try:
        # Get original prompt
        original = await get_prompt(prompt_id)
        
        # Create new prompt
        create_request = PromptCreateRequest(
            name=new_name,
            analyzer_type=original["analyzer_type"],
            content_type=original["content_type"],
            system_prompt=original["system_prompt"],
            user_prompt_template=original["user_prompt_template"],
            temperature=original["temperature"],
            web_search=original["web_search"],
            quality_threshold=original["quality_threshold"],
            version=1.0,
            active=False  # Start inactive
        )
        
        return await create_prompt(create_request)
        
    except Exception as e:
        logger.error(f"Failed to duplicate prompt {prompt_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Analytics Endpoints

@app.get("/analytics/summary")
async def get_analytics_summary():
    """Get overall analytics summary."""
    try:
        metrics = enrichment_pipeline.prompt_metrics
        
        total_analyses = sum(m.total_uses for m in metrics.values())
        avg_quality = sum(m.average_quality for m in metrics.values()) / len(metrics) if metrics else 0
        avg_rating = sum(m.average_rating for m in metrics.values() if m.rating_count > 0) / len([m for m in metrics.values() if m.rating_count > 0]) if any(m.rating_count > 0 for m in metrics.values()) else 0
        
        return {
            "total_prompts": len(metrics),
            "total_analyses": total_analyses,
            "average_quality_score": avg_quality,
            "average_user_rating": avg_rating,
            "prompts_by_quality": _group_prompts_by_quality(metrics),
            "most_used_prompts": _get_most_used_prompts(metrics, limit=5),
            "best_performing_prompts": _get_best_performing_prompts(metrics, limit=5)
        }
        
    except Exception as e:
        logger.error(f"Failed to get analytics summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/analytics/prompt/{prompt_id}")
async def get_prompt_analytics(prompt_id: str):
    """Get detailed analytics for a specific prompt."""
    try:
        if prompt_id not in enrichment_pipeline.prompt_metrics:
            raise HTTPException(status_code=404, detail="No analytics data for this prompt")
        
        metrics = enrichment_pipeline.prompt_metrics[prompt_id]
        
        return {
            "prompt_id": prompt_id,
            "total_uses": metrics.total_uses,
            "average_quality": metrics.average_quality,
            "average_rating": metrics.average_rating,
            "rating_count": metrics.rating_count,
            "performance": {
                "avg_generation_time": sum(metrics.generation_times) / len(metrics.generation_times) if metrics.generation_times else 0,
                "avg_token_usage": sum(metrics.token_usage) / len(metrics.token_usage) if metrics.token_usage else 0,
                "avg_coherence": sum(metrics.coherence_scores) / len(metrics.coherence_scores) if metrics.coherence_scores else 0,
                "avg_actionability": sum(metrics.actionability_scores) / len(metrics.actionability_scores) if metrics.actionability_scores else 0
            },
            "conversion_rate": metrics.conversion_rate,
            "ab_test_group": metrics.ab_test_group
        }
        
    except Exception as e:
        logger.error(f"Failed to get prompt analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analytics/query")
async def query_analytics(query: AnalyticsQuery):
    """Query analytics with filters."""
    try:
        # This would query the Notion analytics database
        # Simplified implementation for now
        results = []
        
        # Add filtering logic here based on query parameters
        
        return {
            "count": len(results),
            "results": results,
            "query": query.dict()
        }
        
    except Exception as e:
        logger.error(f"Failed to query analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Feedback Endpoints

@app.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    """Submit user feedback for an analysis."""
    try:
        enrichment_pipeline.collect_user_feedback(
            page_id=feedback.page_id,
            result_id=feedback.result_id,
            rating=feedback.rating,
            usefulness=feedback.useful,
            acted_on=feedback.acted_on
        )
        
        # Store detailed feedback if provided
        if feedback.feedback_text:
            # Store in analytics database
            pass
        
        return {"message": "Feedback submitted successfully"}
        
    except Exception as e:
        logger.error(f"Failed to submit feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# A/B Testing Endpoints

@app.post("/ab_tests")
async def create_ab_test(test: ABTestRequest):
    """Create a new A/B test."""
    try:
        test_id = f"test_{datetime.now().timestamp()}"
        
        enrichment_pipeline.ab_tests[test_id] = {
            "name": test.test_name,
            "analyzer_type": test.analyzer_type,
            "content_type": test.content_type,
            "control": test.control_prompt_id,
            "variants": test.variant_prompt_ids,
            "traffic_split": test.traffic_split,
            "success_metric": test.success_metric,
            "created": datetime.now(),
            "active": True,
            "results": {}
        }
        
        enrichment_pipeline.active_tests.add(test_id)
        
        return {
            "test_id": test_id,
            "message": "A/B test created successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to create A/B test: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ab_tests/{test_id}/results")
async def get_ab_test_results(test_id: str):
    """Get results for an A/B test."""
    try:
        if test_id not in enrichment_pipeline.ab_tests:
            raise HTTPException(status_code=404, detail="A/B test not found")
        
        test = enrichment_pipeline.ab_tests[test_id]
        
        # Calculate results based on success metric
        results = _calculate_ab_test_results(test, enrichment_pipeline.prompt_metrics)
        
        return {
            "test_id": test_id,
            "test_name": test["name"],
            "status": "active" if test["active"] else "completed",
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Failed to get A/B test results: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Helper functions

def _group_prompts_by_quality(metrics: Dict[str, Any]) -> Dict[str, int]:
    """Group prompts by quality score ranges."""
    groups = {"excellent": 0, "good": 0, "average": 0, "poor": 0}
    
    for m in metrics.values():
        if m.average_quality >= 0.8:
            groups["excellent"] += 1
        elif m.average_quality >= 0.6:
            groups["good"] += 1
        elif m.average_quality >= 0.4:
            groups["average"] += 1
        else:
            groups["poor"] += 1
    
    return groups


def _get_most_used_prompts(metrics: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
    """Get the most frequently used prompts."""
    sorted_prompts = sorted(
        [(pid, m) for pid, m in metrics.items()],
        key=lambda x: x[1].total_uses,
        reverse=True
    )
    
    return [
        {
            "prompt_id": pid,
            "usage_count": m.total_uses,
            "average_quality": m.average_quality
        }
        for pid, m in sorted_prompts[:limit]
    ]


def _get_best_performing_prompts(metrics: Dict[str, Any], limit: int = 5) -> List[Dict[str, Any]]:
    """Get the highest quality prompts."""
    sorted_prompts = sorted(
        [(pid, m) for pid, m in metrics.items() if m.total_uses > 5],  # Min usage threshold
        key=lambda x: x[1].average_quality,
        reverse=True
    )
    
    return [
        {
            "prompt_id": pid,
            "average_quality": m.average_quality,
            "usage_count": m.total_uses,
            "average_rating": m.average_rating
        }
        for pid, m in sorted_prompts[:limit]
    ]


def _calculate_ab_test_results(test: Dict[str, Any], metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate A/B test results based on success metric."""
    results = {}
    
    # Get metrics for control and variants
    control_metrics = metrics.get(test["control"])
    variant_metrics = [metrics.get(vid) for vid in test["variants"]]
    
    if not control_metrics:
        return {"error": "No data for control group"}
    
    # Calculate based on success metric
    if test["success_metric"] == "quality_score":
        results["control"] = {
            "average_quality": control_metrics.average_quality,
            "sample_size": control_metrics.total_uses
        }
        
        for i, vm in enumerate(variant_metrics):
            if vm:
                results[f"variant_{i}"] = {
                    "average_quality": vm.average_quality,
                    "sample_size": vm.total_uses,
                    "improvement": ((vm.average_quality - control_metrics.average_quality) / control_metrics.average_quality) * 100
                }
    
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)