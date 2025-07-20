"""
Notion Database Schema for Prompt-Aware System
==============================================

This module defines the database schemas for the prompt management
and analytics system in Notion.
"""

from typing import Dict, Any, List
from enum import Enum


class PromptDatabaseSchema:
    """Schema for the Pipeline Prompts database in Notion."""
    
    @staticmethod
    def get_schema() -> Dict[str, Any]:
        """Get the complete schema for the prompts database."""
        return {
            "title": [
                {
                    "type": "text",
                    "text": {"content": "Pipeline Prompts"}
                }
            ],
            "description": [
                {
                    "type": "text", 
                    "text": {"content": "Centralized prompt management for the AI enrichment pipeline"}
                }
            ],
            "properties": {
                "Name": {
                    "title": {}
                },
                "Analyzer Type": {
                    "select": {
                        "options": [
                            {"name": "summarizer", "color": "blue"},
                            {"name": "insights", "color": "green"},
                            {"name": "classifier", "color": "yellow"},
                            {"name": "technical", "color": "purple"},
                            {"name": "strategic", "color": "red"},
                            {"name": "market", "color": "orange"},
                            {"name": "risks", "color": "pink"},
                            {"name": "opportunities", "color": "brown"}
                        ]
                    }
                },
                "Content Type": {
                    "select": {
                        "options": [
                            {"name": "general", "color": "default"},
                            {"name": "technical_paper", "color": "blue"},
                            {"name": "market_analysis", "color": "green"},
                            {"name": "product_announcement", "color": "yellow"},
                            {"name": "research_report", "color": "purple"},
                            {"name": "news_article", "color": "orange"},
                            {"name": "blog_post", "color": "pink"},
                            {"name": "whitepaper", "color": "red"}
                        ]
                    }
                },
                "System Prompt": {
                    "rich_text": {}
                },
                "User Prompt Template": {
                    "rich_text": {}
                },
                "Version": {
                    "number": {
                        "format": "number"
                    }
                },
                "Active": {
                    "checkbox": {}
                },
                "Temperature": {
                    "number": {
                        "format": "number"
                    }
                },
                "Web Search": {
                    "checkbox": {}
                },
                "Quality Threshold": {
                    "number": {
                        "format": "percent"
                    }
                },
                "Usage Count": {
                    "number": {
                        "format": "number"
                    }
                },
                "Average Quality Score": {
                    "number": {
                        "format": "percent"
                    }
                },
                "Average User Rating": {
                    "number": {
                        "format": "number"
                    }
                },
                "Last Used": {
                    "date": {}
                },
                "Created By": {
                    "created_by": {}
                },
                "Created": {
                    "created_time": {}
                },
                "Last Edited": {
                    "last_edited_time": {}
                },
                "A/B Test Group": {
                    "select": {
                        "options": [
                            {"name": "Control", "color": "gray"},
                            {"name": "Variant A", "color": "blue"},
                            {"name": "Variant B", "color": "green"},
                            {"name": "Variant C", "color": "yellow"}
                        ]
                    }
                },
                "Performance Notes": {
                    "rich_text": {}
                },
                "Related Prompts": {
                    "relation": {
                        "database_id": "{SELF}",  # Self-referential
                        "type": "dual_property",
                        "dual_property": {
                            "synced_property_id": "related_to",
                            "synced_property_name": "Related To"
                        }
                    }
                }
            }
        }


class PromptAnalyticsDatabaseSchema:
    """Schema for the Prompt Analytics database in Notion."""
    
    @staticmethod
    def get_schema() -> Dict[str, Any]:
        """Get the complete schema for the analytics database."""
        return {
            "title": [
                {
                    "type": "text",
                    "text": {"content": "Prompt Analytics"}
                }
            ],
            "description": [
                {
                    "type": "text",
                    "text": {"content": "Performance analytics and feedback for AI prompts"}
                }
            ],
            "properties": {
                "Analysis ID": {
                    "title": {}
                },
                "Prompt": {
                    "relation": {
                        "database_id": "{PROMPTS_DB_ID}",
                        "type": "single_property"
                    }
                },
                "Content Page": {
                    "relation": {
                        "database_id": "{CONTENT_DB_ID}",
                        "type": "single_property"
                    }
                },
                "Timestamp": {
                    "date": {}
                },
                "Quality Score": {
                    "number": {
                        "format": "percent"
                    }
                },
                "Confidence Score": {
                    "number": {
                        "format": "percent"
                    }
                },
                "Coherence Score": {
                    "number": {
                        "format": "percent"
                    }
                },
                "Actionability Score": {
                    "number": {
                        "format": "percent"
                    }
                },
                "User Rating": {
                    "select": {
                        "options": [
                            {"name": "⭐", "color": "red"},
                            {"name": "⭐⭐", "color": "orange"},
                            {"name": "⭐⭐⭐", "color": "yellow"},
                            {"name": "⭐⭐⭐⭐", "color": "blue"},
                            {"name": "⭐⭐⭐⭐⭐", "color": "green"}
                        ]
                    }
                },
                "Useful": {
                    "checkbox": {}
                },
                "Acted On": {
                    "checkbox": {}
                },
                "Generation Time (ms)": {
                    "number": {
                        "format": "number"
                    }
                },
                "Token Count": {
                    "number": {
                        "format": "number"
                    }
                },
                "Model Used": {
                    "select": {
                        "options": [
                            {"name": "gpt-4", "color": "blue"},
                            {"name": "gpt-4-turbo", "color": "green"},
                            {"name": "gpt-3.5-turbo", "color": "yellow"},
                            {"name": "claude-3", "color": "purple"},
                            {"name": "o3", "color": "red"}
                        ]
                    }
                },
                "Web Search Used": {
                    "checkbox": {}
                },
                "Citation Count": {
                    "number": {
                        "format": "number"
                    }
                },
                "Cross References": {
                    "number": {
                        "format": "number"
                    }
                },
                "A/B Test": {
                    "select": {
                        "options": [
                            {"name": "Control", "color": "gray"},
                            {"name": "Variant A", "color": "blue"},
                            {"name": "Variant B", "color": "green"}
                        ]
                    }
                },
                "User Feedback": {
                    "rich_text": {}
                },
                "Error": {
                    "rich_text": {}
                }
            }
        }


class FeedbackCollectionSchema:
    """Schema for feedback collection in content pages."""
    
    @staticmethod
    def get_feedback_properties() -> Dict[str, Any]:
        """Get properties to add to content pages for feedback."""
        return {
            "AI Quality Ratings": {
                "rich_text": {}  # JSON string of ratings per analyzer
            },
            "Most Useful Section": {
                "select": {
                    "options": [
                        {"name": "Summary", "color": "blue"},
                        {"name": "Key Insights", "color": "green"},
                        {"name": "Action Items", "color": "yellow"},
                        {"name": "Classification", "color": "purple"},
                        {"name": "Cross-Analysis", "color": "orange"}
                    ]
                }
            },
            "Actions Taken": {
                "multi_select": {
                    "options": [
                        {"name": "Shared with team", "color": "blue"},
                        {"name": "Created tasks", "color": "green"},
                        {"name": "Made decision", "color": "yellow"},
                        {"name": "Further research", "color": "purple"},
                        {"name": "Updated strategy", "color": "red"}
                    ]
                }
            },
            "Improvement Suggestions": {
                "rich_text": {}
            },
            "Prompt Feedback Submitted": {
                "checkbox": {}
            }
        }


class PromptLibraryViews:
    """Predefined views for the prompt databases."""
    
    @staticmethod
    def get_prompt_views() -> List[Dict[str, Any]]:
        """Get view configurations for the prompts database."""
        return [
            {
                "name": "Active Prompts",
                "type": "table",
                "filter": {
                    "property": "Active",
                    "checkbox": {"equals": True}
                },
                "sorts": [
                    {"property": "Analyzer Type", "direction": "ascending"},
                    {"property": "Content Type", "direction": "ascending"}
                ]
            },
            {
                "name": "High Performers",
                "type": "gallery",
                "filter": {
                    "and": [
                        {"property": "Active", "checkbox": {"equals": True}},
                        {"property": "Average Quality Score", "number": {"greater_than": 0.8}}
                    ]
                },
                "sorts": [
                    {"property": "Average Quality Score", "direction": "descending"}
                ]
            },
            {
                "name": "A/B Tests",
                "type": "board",
                "group_by": "A/B Test Group",
                "filter": {
                    "property": "A/B Test Group",
                    "select": {"is_not_empty": True}
                }
            },
            {
                "name": "Recently Updated",
                "type": "timeline",
                "timeline_show_property": "Last Edited",
                "sorts": [
                    {"property": "Last Edited", "direction": "descending"}
                ]
            }
        ]
    
    @staticmethod
    def get_analytics_views() -> List[Dict[str, Any]]:
        """Get view configurations for the analytics database."""
        return [
            {
                "name": "Recent Analyses",
                "type": "table",
                "sorts": [
                    {"property": "Timestamp", "direction": "descending"}
                ],
                "limit": 100
            },
            {
                "name": "Quality Distribution",
                "type": "board",
                "group_by": "User Rating",
                "sorts": [
                    {"property": "Quality Score", "direction": "descending"}
                ]
            },
            {
                "name": "Performance Metrics",
                "type": "gallery",
                "filter": {
                    "property": "Generation Time (ms)",
                    "number": {"greater_than": 0}
                },
                "sorts": [
                    {"property": "Generation Time (ms)", "direction": "ascending"}
                ]
            },
            {
                "name": "Failed Analyses",
                "type": "table",
                "filter": {
                    "property": "Error",
                    "rich_text": {"is_not_empty": True}
                }
            }
        ]