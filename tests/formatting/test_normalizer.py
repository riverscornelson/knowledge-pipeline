"""Tests for content normalizer."""

import pytest
from datetime import datetime

from src.formatting.normalizer import ContentNormalizer
from src.formatting.models import ActionPriority, ContentQuality


class TestContentNormalizer:
    """Test ContentNormalizer functionality."""
    
    def test_normalize_basic_content(self):
        """Test normalizing basic enrichment result."""
        enrichment_result = {
            "content_analysis": {
                "executive_summary": ["Point 1", "Point 2", "Point 3"],
                "key_insights": ["Insight 1", "Insight 2"],
                "action_items": ["Review report", "Update strategy"]
            },
            "metadata": {
                "content_type": "market_news",
                "quality_score": 0.85,
                "timestamp": datetime.now().isoformat(),
                "analyzer": "test_analyzer",
                "model": "gpt-4",
                "processing_time": 3.5,
                "tokens_used": 1200,
                "cost": 0.036
            }
        }
        
        source_metadata = {
            "id": "doc123",
            "title": "Market Report",
            "raw_content": "This is the raw content",
            "tags": ["market", "analysis"]
        }
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        assert content.content_type == "market_news"
        assert content.source_id == "doc123"
        assert content.source_title == "Market Report"
        assert content.quality_score == 0.85
        assert content.quality_level == ContentQuality.HIGH
        assert len(content.executive_summary) == 3
        assert len(content.key_insights) == 2
        assert len(content.action_items) == 2
        assert content.tags == ["market", "analysis"]
    
    def test_normalize_with_dict_insights(self):
        """Test normalizing insights provided as dictionaries."""
        enrichment_result = {
            "content_analysis": {
                "key_insights": [
                    {
                        "text": "Market is growing",
                        "confidence": 0.9,
                        "evidence": "Based on Q4 data",
                        "tags": ["growth", "market"]
                    },
                    {
                        "text": "Competition increasing",
                        "confidence": 0.7
                    }
                ]
            },
            "metadata": {
                "quality_score": 0.8
            }
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        assert len(content.key_insights) == 2
        assert content.key_insights[0].text == "Market is growing"
        assert content.key_insights[0].confidence == 0.9
        assert content.key_insights[0].supporting_evidence == "Based on Q4 data"
        assert content.key_insights[0].tags == ["growth", "market"]
        assert content.key_insights[1].confidence == 0.7
    
    def test_normalize_with_dict_actions(self):
        """Test normalizing action items provided as dictionaries."""
        enrichment_result = {
            "content_analysis": {
                "action_items": [
                    {
                        "text": "Immediate review needed",
                        "priority": "critical",
                        "assignee": "John Doe",
                        "context": "Market shift detected"
                    },
                    {
                        "text": "Update projections",
                        "priority": "high"
                    }
                ]
            },
            "metadata": {
                "quality_score": 0.8
            }
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        assert len(content.action_items) == 2
        assert content.action_items[0].text == "Immediate review needed"
        assert content.action_items[0].priority == ActionPriority.CRITICAL
        assert content.action_items[0].assignee == "John Doe"
        assert content.action_items[0].context == "Market shift detected"
    
    def test_priority_detection_from_text(self):
        """Test detecting priority from action text."""
        enrichment_result = {
            "content_analysis": {
                "action_items": [
                    "URGENT: Fix security issue",
                    "High priority: Review budget",
                    "Update documentation when possible",
                    "Minor: Fix typo in report"
                ]
            },
            "metadata": {"quality_score": 0.8}
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        assert content.action_items[0].priority == ActionPriority.CRITICAL
        assert content.action_items[1].priority == ActionPriority.HIGH
        assert content.action_items[2].priority == ActionPriority.MEDIUM
        assert content.action_items[3].priority == ActionPriority.LOW
    
    def test_normalize_with_alternative_section_names(self):
        """Test normalizing with alternative section names."""
        enrichment_result = {
            "content_analysis": {
                "summary": "This is a summary point",
                "insights": ["Key finding 1", "Key finding 2"],
                "next_steps": ["Action 1", "Action 2"],
                "analysis": "Detailed analysis here",
                "implications": "Strategic implications"
            },
            "metadata": {"quality_score": 0.75}
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should map alternative names
        assert len(content.executive_summary) > 0
        assert len(content.key_insights) == 2
        assert len(content.action_items) == 2
        
        # Other sections should be in raw_sections
        assert "analysis" in content.raw_sections
        assert "implications" in content.raw_sections
    
    def test_normalize_with_string_content(self):
        """Test normalizing when sections are strings instead of lists."""
        enrichment_result = {
            "content_analysis": {
                "executive_summary": "Point 1\nPoint 2\nPoint 3",
                "key_insights": "First insight\nSecond insight",
                "action_items": "Critical: Do this\nHigh: Do that"
            },
            "metadata": {"quality_score": 0.8}
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        assert len(content.executive_summary) == 3
        assert len(content.key_insights) == 2
        assert len(content.action_items) == 2
        assert content.action_items[0].priority == ActionPriority.CRITICAL
        assert content.action_items[1].priority == ActionPriority.HIGH
    
    def test_normalize_with_missing_sections(self):
        """Test normalizing with missing sections."""
        enrichment_result = {
            "content_analysis": {
                "some_custom_section": "Custom content"
            },
            "metadata": {"quality_score": 0.5}
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should have defaults
        assert len(content.executive_summary) >= 1
        assert len(content.key_insights) == 0
        assert len(content.action_items) == 0
        
        # Custom section in raw_sections
        assert "some_custom_section" in content.raw_sections
    
    def test_normalize_with_large_raw_content(self):
        """Test handling large raw content."""
        large_content = "x" * 20000  # 20KB
        
        enrichment_result = {
            "content_analysis": {},
            "metadata": {"quality_score": 0.5}
        }
        
        source_metadata = {
            "id": "test",
            "title": "Test",
            "raw_content": large_content
        }
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should not store large content directly
        assert content.raw_content is None
        assert content.raw_content_size_bytes == 20000
    
    def test_normalize_error_handling(self):
        """Test error handling during normalization."""
        # Invalid enrichment result
        enrichment_result = "not a dict"
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should return error content
        assert content.content_type == "error"
        assert content.quality_score == 0.0
        assert content.quality_level == ContentQuality.LOW
        assert "Error processing content" in content.executive_summary[0]
        assert content.processing_metrics.error_count == 1
    
    def test_prompt_info_extraction(self):
        """Test extraction of prompt information."""
        enrichment_result = {
            "content_analysis": {},
            "metadata": {
                "quality_score": 0.8,
                "prompt_info": {
                    "name": "market_analyzer_v2",
                    "version": "2.1",
                    "source": "notion"
                }
            }
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        assert content.attribution.prompt_name == "market_analyzer_v2"
        assert content.attribution.prompt_version == "2.1"
        assert content.attribution.prompt_source == "notion"
    
    def test_complex_nested_structures(self):
        """Test normalization of complex nested data structures."""
        enrichment_result = {
            "content_analysis": {
                "insights": [
                    {
                        "text": "Complex insight",
                        "nested": {
                            "confidence": 0.85,
                            "evidence": {
                                "sources": ["Study A", "Report B"],
                                "quality": "high"
                            }
                        },
                        "tags": {"primary": "market", "secondary": ["tech", "ai"]}
                    }
                ],
                "matrix_data": [
                    ["Q1", "Q2", "Q3", "Q4"],
                    [100, 120, 110, 140]
                ]
            },
            "metadata": {"quality_score": 0.8}
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should handle nested structures gracefully
        assert len(content.key_insights) > 0
        assert "matrix_data" in content.raw_sections
    
    def test_unicode_and_special_characters(self):
        """Test handling of unicode and special characters."""
        enrichment_result = {
            "content_analysis": {
                "executive_summary": "Analysis of €1.5M deal with 中国 partners",
                "key_insights": [
                    "Growth ↑ 25% YoY",
                    "Risk assessment: ⚠️ Medium",
                    "Market position: ★★★★☆"
                ],
                "special_chars": "Test\nwith\ttabs\rand\r\nspecial\x00chars"
            },
            "metadata": {"quality_score": 0.8}
        }
        
        source_metadata = {"id": "test", "title": "Test™"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should preserve unicode
        assert "€" in content.executive_summary[0]
        assert "中国" in content.executive_summary[0]
        assert "↑" in content.key_insights[0].text
        assert "⚠️" in content.key_insights[1].text
        assert "★" in content.key_insights[2].text
    
    def test_extreme_data_sizes(self):
        """Test handling of very large or very small data."""
        # Very large summary
        large_summary = [f"Point {i} with lots of detail" * 10 for i in range(100)]
        
        enrichment_result = {
            "content_analysis": {
                "executive_summary": large_summary,
                "tiny_section": "",
                "null_section": None
            },
            "metadata": {"quality_score": 0.7}
        }
        
        source_metadata = {
            "id": "test",
            "title": "Test",
            "raw_content": "x" * 10_000_000  # 10MB
        }
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should handle large data
        assert len(content.executive_summary) == 100
        assert content.raw_content_size_bytes == 10_000_000
        assert content.raw_content is None  # Too large to store
    
    def test_priority_detection_edge_cases(self):
        """Test priority detection with various formats."""
        enrichment_result = {
            "content_analysis": {
                "action_items": [
                    "!!!URGENT!!!: Do this now",
                    "Critical priority - Fix bug",
                    "HIGH PRIORITY ACTION REQUIRED",
                    "high: Review code",
                    "(Medium) Update docs",
                    "[LOW] Clean up tests",
                    "minor - fix typos",
                    "Just a regular task",
                    "⚡ ASAP: Emergency fix",
                    "🔴 Critical issue"
                ]
            },
            "metadata": {"quality_score": 0.8}
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Check various priority detections
        priorities = [item.priority for item in content.action_items]
        assert priorities[0] == ActionPriority.CRITICAL  # !!!URGENT!!!
        assert priorities[1] == ActionPriority.CRITICAL  # Critical priority
        assert priorities[2] == ActionPriority.HIGH  # HIGH PRIORITY
        assert priorities[3] == ActionPriority.HIGH  # high:
        assert priorities[4] == ActionPriority.MEDIUM  # (Medium)
        assert priorities[5] == ActionPriority.LOW  # [LOW]
        assert priorities[6] == ActionPriority.LOW  # minor
        assert priorities[7] == ActionPriority.MEDIUM  # default
        assert priorities[8] == ActionPriority.CRITICAL  # ASAP
        assert priorities[9] == ActionPriority.CRITICAL  # 🔴
    
    def test_metadata_extraction_variations(self):
        """Test metadata extraction from various structures."""
        enrichment_result = {
            "content_analysis": {},
            "metadata": {
                "quality_score": "0.85",  # String instead of float
                "processing_time": "5s",  # String with unit
                "tokens_used": "1,500",  # String with comma
                "cost": "$0.045",  # String with currency
                "confidence_score": 85,  # Int percentage
                "timestamp": 1642345678,  # Unix timestamp
                "prompt_info": {
                    "id": "prompt_123",
                    "name": None,  # Missing name
                    "version": 2  # Int version
                }
            }
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should handle type conversions
        assert isinstance(content.quality_score, float)
        assert content.quality_score == 0.85
    
    def test_malformed_enrichment_structures(self):
        """Test handling of malformed enrichment results."""
        test_cases = [
            # Missing content_analysis
            {"metadata": {"quality_score": 0.5}},
            
            # content_analysis not a dict
            {"content_analysis": "string instead of dict", "metadata": {}},
            
            # Deeply nested None values
            {"content_analysis": {"section": {"subsection": None}}, "metadata": {}},
            
            # Circular reference (handled by JSON serialization)
            {"content_analysis": {"self_ref": "..."}, "metadata": {}}
        ]
        
        source_metadata = {"id": "test", "title": "Test"}
        
        for enrichment_result in test_cases:
            content = ContentNormalizer.normalize(enrichment_result, source_metadata)
            
            # Should not crash and return valid content
            assert content is not None
            assert isinstance(content.executive_summary, list)
            assert content.quality_score >= 0.0
    
    def test_section_name_variations(self):
        """Test handling of various section name formats."""
        enrichment_result = {
            "content_analysis": {
                "Executive Summary": "Title case",
                "EXECUTIVE_SUMMARY": "Upper snake",
                "executive-summary": "Kebab case",
                "executiveSummary": "Camel case",
                "key insights": ["Space separated"],
                "KEY_INSIGHTS": ["Upper version"],
                "Action Items": ["Title case actions"],
                "actionItems": ["Camel case actions"],
                "next_steps": "Alternative name",
                "NextSteps": "Pascal case"
            },
            "metadata": {"quality_score": 0.8}
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should handle various naming conventions
        assert len(content.executive_summary) > 0
        assert len(content.key_insights) > 0
        assert len(content.action_items) > 0
    
    def test_timestamp_handling(self):
        """Test various timestamp formats."""
        from datetime import datetime, timezone
        
        enrichment_result = {
            "content_analysis": {},
            "metadata": {
                "quality_score": 0.8,
                "timestamps": {
                    "iso": "2024-01-15T10:30:00Z",
                    "iso_with_ms": "2024-01-15T10:30:00.123Z",
                    "unix": 1705318200,
                    "unix_ms": 1705318200123,
                    "date_only": "2024-01-15",
                    "datetime_obj": datetime.now()
                }
            }
        }
        
        source_metadata = {"id": "test", "title": "Test"}
        
        content = ContentNormalizer.normalize(enrichment_result, source_metadata)
        
        # Should handle various timestamp formats without crashing
        assert content is not None
        assert "timestamps" in content.raw_sections