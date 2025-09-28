"""
Optimized Notion formatter for the unified analysis pipeline.
Enforces strict 15-block limit, prioritizes executive content, and eliminates raw content storage.
"""
import re
import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from utils.logging import setup_logger
from core.notion_client import NotionClient


@dataclass
class OptimizedAnalysisResult:
    """Optimized analysis result from unified analyzer."""
    content: str
    content_type: str
    quality_score: float
    processing_time: float
    web_search_used: bool
    drive_link: str
    metadata: Dict[str, Any]


class OptimizedNotionFormatter:
    """
    High-performance Notion formatter optimized for executive consumption.

    Key optimizations:
    - Strict 15-block maximum
    - Executive-first content hierarchy
    - No raw content storage (Drive links only)
    - <30s processing time
    - 8.5/10 quality threshold enforcement
    """

    def __init__(self, notion_client: NotionClient):
        """Initialize the optimized formatter."""
        self.notion = notion_client
        self.logger = setup_logger(__name__)

        # Performance constraints
        self.MAX_BLOCKS = 15
        self.QUALITY_THRESHOLD = 8.5
        self.MAX_PROCESSING_TIME = 30

        # Content prioritization weights
        self.BLOCK_PRIORITIES = {
            "executive_summary": 1.0,
            "classification": 0.9,
            "strategic_insights": 0.8,
            "references": 0.7,
            "metadata": 0.3
        }

        # Quality indicators
        self.quality_indicators = {
            "excellent": "⭐",  # 9.0+
            "good": "✅",       # 8.5-8.9
            "acceptable": "✓", # 8.0-8.4
            "poor": "⚠️"       # <8.0
        }

    def format_unified_analysis(self, result: OptimizedAnalysisResult) -> List[Dict[str, Any]]:
        """
        Format unified analysis result into optimized Notion blocks.

        Args:
            result: Unified analysis result with all components

        Returns:
            List of Notion blocks (max 15)
        """
        start_time = datetime.now()

        # Parse the unified analysis content
        sections = self._parse_unified_content(result.content)

        # Quality gate check
        if result.quality_score < self.QUALITY_THRESHOLD:
            self.logger.warning(f"Quality score {result.quality_score} below threshold {self.QUALITY_THRESHOLD}")
            return self._create_quality_warning_blocks(result)

        # Generate blocks with strict prioritization
        blocks = []
        remaining_blocks = self.MAX_BLOCKS

        # 1. Quality header (1 block) - REQUIRED
        blocks.append(self._create_quality_header(result))
        remaining_blocks -= 1

        # 2. Executive summary (3-4 blocks) - HIGH PRIORITY
        if remaining_blocks > 0 and "executive_summary" in sections:
            summary_blocks = self._create_executive_summary_blocks(
                sections["executive_summary"],
                max_blocks=min(4, remaining_blocks)
            )
            blocks.extend(summary_blocks)
            remaining_blocks -= len(summary_blocks)

        # 3. Classification metadata (1-2 blocks) - MEDIUM PRIORITY
        if remaining_blocks > 0 and "classification" in sections:
            classification_blocks = self._create_classification_blocks(
                sections["classification"],
                max_blocks=min(2, remaining_blocks)
            )
            blocks.extend(classification_blocks)
            remaining_blocks -= len(classification_blocks)

        # 4. Strategic insights (6-8 blocks) - HIGH PRIORITY
        if remaining_blocks > 0 and "strategic_insights" in sections:
            insights_blocks = self._create_strategic_insights_blocks(
                sections["strategic_insights"],
                max_blocks=remaining_blocks - 2  # Save 2 for references
            )
            blocks.extend(insights_blocks)
            remaining_blocks -= len(insights_blocks)

        # 5. References (1-2 blocks) - REQUIRED for Drive link
        if remaining_blocks > 0:
            ref_blocks = self._create_references_blocks(
                result.drive_link,
                sections.get("references", ""),
                max_blocks=remaining_blocks
            )
            blocks.extend(ref_blocks)
            remaining_blocks -= len(ref_blocks)

        # Performance logging
        processing_time = (datetime.now() - start_time).total_seconds()
        self.logger.info(f"Formatted {len(blocks)} blocks in {processing_time:.2f}s")

        # Validate block count
        if len(blocks) > self.MAX_BLOCKS:
            self.logger.error(f"Block count {len(blocks)} exceeds maximum {self.MAX_BLOCKS}")
            blocks = blocks[:self.MAX_BLOCKS]

        return blocks

    def _parse_unified_content(self, content: str) -> Dict[str, str]:
        """Parse unified analysis content into structured sections."""
        sections = {}

        # DEBUG: Log what we're trying to parse
        self.logger.info(f"Parsing content of length: {len(content)}")
        if len(content) < 500:
            self.logger.warning(f"Content seems too short: {content}")
        else:
            self.logger.debug(f"Content preview: {content[:300]}...")

        # Executive Summary
        summary_match = re.search(
            r'### 📋 EXECUTIVE SUMMARY.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if summary_match:
            sections["executive_summary"] = summary_match.group(1).strip()

        # Classification & Metadata
        classification_match = re.search(
            r'### 🎯 CLASSIFICATION & METADATA.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if classification_match:
            sections["classification"] = classification_match.group(1).strip()

        # Strategic Insights
        insights_match = re.search(
            r'### 💡 STRATEGIC INSIGHTS.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if insights_match:
            sections["strategic_insights"] = insights_match.group(1).strip()

        # Key References
        references_match = re.search(
            r'### 🔗 KEY REFERENCES.*?\n(.*?)(?=###|\Z)',
            content,
            re.DOTALL
        )
        if references_match:
            sections["references"] = references_match.group(1).strip()

        return sections

    def _create_quality_header(self, result: OptimizedAnalysisResult) -> Dict[str, Any]:
        """Create quality header block."""
        quality_indicator = self._get_quality_indicator(result.quality_score)
        processing_status = "⚡ Fast" if result.processing_time < 20 else "⏱️ Standard"

        header_text = (
            f"{quality_indicator} Quality: {result.quality_score:.1f}/10 | "
            f"{processing_status} ({result.processing_time:.1f}s) | "
            f"{'🌐 Web Enhanced' if result.web_search_used else '📄 Document Only'}"
        )

        return {
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": header_text}
                }],
                "icon": {"type": "emoji", "emoji": "📊"},
                "color": "blue_background"
            }
        }

    def _create_executive_summary_blocks(self, summary_content: str, max_blocks: int) -> List[Dict[str, Any]]:
        """Create executive summary blocks with maximum efficiency."""
        blocks = []

        # Header
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": "📋 Executive Summary"},
                    "annotations": {"bold": True}
                }]
            }
        })

        # Parse bullet points from summary
        bullet_points = self._extract_bullet_points(summary_content)

        if bullet_points and len(blocks) < max_blocks:
            # Create callout with all bullet points
            bullet_text = "\n".join(f"• {point}" for point in bullet_points[:4])  # Max 4 points

            blocks.append({
                "type": "callout",
                "callout": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": bullet_text}
                    }],
                    "icon": {"type": "emoji", "emoji": "🎯"},
                    "color": "green_background"
                }
            })

        return blocks[:max_blocks]

    def _create_classification_blocks(self, classification_content: str, max_blocks: int) -> List[Dict[str, Any]]:
        """Create compact classification blocks."""
        blocks = []

        # Parse classification data
        classification_data = self._parse_classification_data(classification_content)

        if classification_data:
            # Create inline metadata block
            metadata_text = (
                f"**Content Type**: {classification_data.get('content_type', 'Unknown')} | "
                f"**AI Primitives**: {', '.join(classification_data.get('ai_primitives', [])[:3])} | "
                f"**Quality Score**: {classification_data.get('quality_score', 'N/A')}"
            )

            blocks.append({
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": metadata_text}
                    }]
                }
            })

        return blocks[:max_blocks]

    def _create_strategic_insights_blocks(self, insights_content: str, max_blocks: int) -> List[Dict[str, Any]]:
        """Create strategic insights with maximum impact."""
        blocks = []

        # Header
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": "💡 Strategic Insights"},
                    "annotations": {"bold": True}
                }]
            }
        })

        # Parse individual insights
        insights = self._parse_strategic_insights(insights_content)

        # Create toggle blocks for insights (more compact)
        for i, insight in enumerate(insights[:4]):  # Max 4 insights
            if len(blocks) >= max_blocks:
                break

            # Create toggle with insight title and content
            blocks.append({
                "type": "toggle",
                "toggle": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": insight.get("title", f"Insight {i+1}")},
                        "annotations": {"bold": True}
                    }],
                    "children": [{
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{
                                "type": "text",
                                "text": {"content": insight.get("content", "")}
                            }]
                        }
                    }]
                }
            })

        return blocks[:max_blocks]

    def _create_references_blocks(self, drive_link: str, references_content: str, max_blocks: int) -> List[Dict[str, Any]]:
        """Create references with Drive link (no raw content)."""
        blocks = []

        # Drive link is REQUIRED
        drive_text = f"📎 **Original Document**: [View in Drive]({drive_link})"

        # Add external references if available
        external_refs = self._extract_external_references(references_content)
        if external_refs:
            ref_links = " | ".join([f"[{ref['title']}]({ref['url']})" for ref in external_refs[:3]])
            drive_text += f"\n🌐 **Related Sources**: {ref_links}"

        blocks.append({
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": drive_text}
                }]
            }
        })

        return blocks[:max_blocks]

    def _create_quality_warning_blocks(self, result: OptimizedAnalysisResult) -> List[Dict[str, Any]]:
        """Create warning blocks for low-quality content."""
        return [{
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {
                        "content": f"⚠️ Quality Alert: Content quality score {result.quality_score:.1f} below threshold {self.QUALITY_THRESHOLD}. Consider manual review."
                    }
                }],
                "icon": {"type": "emoji", "emoji": "⚠️"},
                "color": "red_background"
            }
        }, {
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"📎 Original Document: [View in Drive]({result.drive_link})"}
                }]
            }
        }]

    def _get_quality_indicator(self, score: float) -> str:
        """Get quality indicator emoji."""
        if score >= 9.0:
            return self.quality_indicators["excellent"]
        elif score >= 8.5:
            return self.quality_indicators["good"]
        elif score >= 8.0:
            return self.quality_indicators["acceptable"]
        else:
            return self.quality_indicators["poor"]

    def _extract_bullet_points(self, content: str) -> List[str]:
        """Extract bullet points from content."""
        points = []

        # Look for lines starting with bullet indicators
        for line in content.split('\n'):
            line = line.strip()
            if re.match(r'^[•\-\*]', line):
                # Clean up the bullet point
                clean_point = re.sub(r'^[•\-\*]\s*', '', line)
                if len(clean_point) > 10:  # Filter out very short points
                    points.append(clean_point)
            elif line.startswith('**') and line.endswith('**'):
                # Bold headers as bullet points
                clean_point = line.strip('*')
                points.append(clean_point)

        return points[:4]  # Max 4 bullet points for executive summary

    def _parse_classification_data(self, content: str) -> Dict[str, Any]:
        """Parse classification data from content."""
        data = {}

        # Extract content type
        content_type_match = re.search(r'\*\*Content Type\*\*:\s*([^\n]+)', content)
        if content_type_match:
            data["content_type"] = content_type_match.group(1).strip()

        # Extract AI primitives
        primitives_match = re.search(r'\*\*AI Primitives\*\*:\s*([^\n]+)', content)
        if primitives_match:
            primitives_text = primitives_match.group(1).strip()
            # Parse list of primitives
            data["ai_primitives"] = [p.strip() for p in primitives_text.split(',')]

        # Extract quality score
        quality_match = re.search(r'\*\*Quality Score\*\*:\s*([0-9.]+)', content)
        if quality_match:
            data["quality_score"] = quality_match.group(1)

        return data

    def _parse_strategic_insights(self, content: str) -> List[Dict[str, str]]:
        """Parse strategic insights from content."""
        insights = []

        # Look for insight patterns
        insight_pattern = r'\*\*🚀?\s*([^*]+)\*\*:\s*([^\n]+(?:\n[^*\n]+)*)'
        matches = re.finditer(insight_pattern, content)

        for match in matches:
            title = match.group(1).strip()
            content_text = match.group(2).strip()

            insights.append({
                "title": title,
                "content": content_text
            })

        # Fallback: look for numbered insights
        if not insights:
            lines = content.split('\n')
            current_insight = None

            for line in lines:
                line = line.strip()
                if re.match(r'^\d+\.', line):
                    if current_insight:
                        insights.append(current_insight)
                    current_insight = {
                        "title": re.sub(r'^\d+\.\s*', '', line),
                        "content": ""
                    }
                elif current_insight and line:
                    current_insight["content"] += line + " "

            if current_insight:
                insights.append(current_insight)

        return insights[:5]  # Max 5 insights

    def _extract_external_references(self, content: str) -> List[Dict[str, str]]:
        """Extract external references from content."""
        refs = []

        # Look for URL patterns
        url_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
        matches = re.finditer(url_pattern, content)

        for match in matches:
            title = match.group(1).strip()
            url = match.group(2).strip()

            # Skip Drive links (we handle those separately)
            if 'drive.google.com' not in url.lower():
                refs.append({
                    "title": title,
                    "url": url
                })

        return refs[:3]  # Max 3 external references

    def validate_output_constraints(self, blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate that output meets optimization constraints."""
        validation = {
            "block_count": len(blocks),
            "block_limit_ok": len(blocks) <= self.MAX_BLOCKS,
            "has_drive_link": False,
            "has_executive_summary": False,
            "executive_priority": False
        }

        # Check for required components
        for i, block in enumerate(blocks):
            block_type = block.get("type")

            # Check for Drive link
            if block_type in ["paragraph", "callout"]:
                text_content = self._extract_text_from_block(block)
                if "drive.google.com" in text_content.lower() or "view in drive" in text_content.lower():
                    validation["has_drive_link"] = True

            # Check for executive summary (should be in first 5 blocks)
            if i < 5 and block_type == "heading_2":
                text_content = self._extract_text_from_block(block)
                if "executive summary" in text_content.lower():
                    validation["has_executive_summary"] = True
                    validation["executive_priority"] = i < 3

        return validation

    def _extract_text_from_block(self, block: Dict[str, Any]) -> str:
        """Extract text content from a Notion block."""
        block_type = block.get("type")
        if block_type in block:
            rich_text = block[block_type].get("rich_text", [])
            if rich_text:
                return " ".join([rt.get("text", {}).get("content", "") for rt in rich_text])
        return ""


class OptimizedFormatterValidator:
    """Validator for optimized formatter output."""

    def __init__(self):
        self.logger = setup_logger(__name__)

    def validate_optimization_compliance(self,
                                       blocks: List[Dict[str, Any]],
                                       processing_time: float,
                                       quality_score: float) -> Dict[str, Any]:
        """Validate that the output meets all optimization requirements."""

        compliance = {
            "block_count_ok": len(blocks) <= 15,
            "processing_time_ok": processing_time < 30,
            "quality_score_ok": quality_score >= 8.5,
            "has_required_components": self._check_required_components(blocks),
            "drive_link_only": self._verify_no_raw_content(blocks),
            "executive_prioritized": self._check_executive_priority(blocks)
        }

        compliance["overall_compliant"] = all(compliance.values())

        # Log compliance details
        if not compliance["overall_compliant"]:
            self.logger.warning("Optimization compliance issues detected:")
            for check, passed in compliance.items():
                if not passed:
                    self.logger.warning(f"  - {check}: FAILED")

        return compliance

    def _check_required_components(self, blocks: List[Dict[str, Any]]) -> bool:
        """Check for required components in output."""
        has_executive = False
        has_drive_link = False

        for block in blocks:
            text = self._extract_all_text(block)
            if "executive summary" in text.lower():
                has_executive = True
            if "drive.google.com" in text.lower() or "view in drive" in text.lower():
                has_drive_link = True

        return has_executive and has_drive_link

    def _verify_no_raw_content(self, blocks: List[Dict[str, Any]]) -> bool:
        """Verify no raw content is stored - only Drive links."""
        for block in blocks:
            # Check for code blocks that might contain raw content
            if block.get("type") == "code":
                content = block.get("code", {}).get("rich_text", [])
                if content and len(content[0].get("text", {}).get("content", "")) > 500:
                    return False  # Likely raw content

        return True

    def _check_executive_priority(self, blocks: List[Dict[str, Any]]) -> bool:
        """Check that executive content appears early."""
        for i, block in enumerate(blocks[:5]):  # Check first 5 blocks
            text = self._extract_all_text(block)
            if "executive summary" in text.lower():
                return i < 3  # Should be in first 3 blocks

        return False

    def _extract_all_text(self, block: Dict[str, Any]) -> str:
        """Extract all text from a block recursively."""
        text_parts = []

        def extract_rich_text(rich_text_list):
            for rt in rich_text_list:
                if "text" in rt:
                    text_parts.append(rt["text"].get("content", ""))

        block_type = block.get("type")
        if block_type in block:
            block_content = block[block_type]

            # Extract from rich_text
            if "rich_text" in block_content:
                extract_rich_text(block_content["rich_text"])

            # Extract from children (for toggles, etc.)
            if "children" in block_content:
                for child in block_content["children"]:
                    text_parts.append(self._extract_all_text(child))

        return " ".join(text_parts)