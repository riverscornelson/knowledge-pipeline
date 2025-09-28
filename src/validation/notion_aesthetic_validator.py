"""
Notion Aesthetic Validator
Core validation engine for Notion page aesthetics, mobile responsiveness, and accessibility.
"""

import json
import re
import math
from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, asdict, field
from enum import Enum
import colorsys


@dataclass
class MockNotionPage:
    """Mock representation of a Notion page for testing"""
    title: str
    blocks: List[Dict[str, Any]]
    properties: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def get_blocks_by_type(self, block_type: str) -> List[Dict[str, Any]]:
        """Get all blocks of a specific type"""
        return [block for block in self.blocks if block.get('type') == block_type]

    def count_blocks(self) -> int:
        """Count total number of blocks"""
        return len(self.blocks)

    def has_emoji_in_headings(self) -> bool:
        """Check if headings use emojis"""
        headings = self.get_blocks_by_type('heading_1') + \
                  self.get_blocks_by_type('heading_2') + \
                  self.get_blocks_by_type('heading_3')

        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        for heading in headings:
            if re.search(emoji_pattern, heading.get('content', '')):
                return True
        return False


@dataclass
class ValidationResult:
    """Result of validation analysis"""
    score: float
    issues: List[str]
    recommendations: List[str]
    details: Dict[str, Any]
    passed: bool


@dataclass
class AestheticMetrics:
    """Comprehensive aesthetic metrics"""
    visual_hierarchy_score: float = 0.0
    mobile_readability_score: float = 0.0
    scan_efficiency_score: float = 0.0
    accessibility_score: float = 0.0
    color_contrast_score: float = 0.0
    white_space_balance: float = 0.0
    emoji_functionality_score: float = 0.0
    table_mobile_compliance: bool = False
    content_density_score: float = 0.0
    overall_aesthetic_score: float = 0.0


class ColorContrastCalculator:
    """Calculate color contrast ratios for accessibility"""

    @staticmethod
    def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
        """Convert hex color to RGB"""
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

    @staticmethod
    def relative_luminance(rgb: Tuple[int, int, int]) -> float:
        """Calculate relative luminance"""
        def linear_rgb(c):
            c = c / 255.0
            return c / 12.92 if c <= 0.03928 else pow((c + 0.055) / 1.055, 2.4)

        r, g, b = rgb
        return 0.2126 * linear_rgb(r) + 0.7152 * linear_rgb(g) + 0.0722 * linear_rgb(b)

    @classmethod
    def contrast_ratio(cls, color1: str, color2: str) -> float:
        """Calculate contrast ratio between two colors"""
        rgb1 = cls.hex_to_rgb(color1)
        rgb2 = cls.hex_to_rgb(color2)

        l1 = cls.relative_luminance(rgb1)
        l2 = cls.relative_luminance(rgb2)

        lighter = max(l1, l2)
        darker = min(l1, l2)

        return (lighter + 0.05) / (darker + 0.05)


class VisualHierarchyAnalyzer:
    """Analyze visual hierarchy structure"""

    def analyze_hierarchy(self, page: MockNotionPage) -> float:
        """Analyze overall hierarchy score"""
        hierarchy_score = 0.0
        total_checks = 0

        # Check heading structure
        hierarchy_score += self._check_heading_structure(page) * 0.3
        total_checks += 0.3

        # Check emoji usage in headings
        hierarchy_score += self._check_emoji_hierarchy(page) * 0.2
        total_checks += 0.2

        # Check content organization
        hierarchy_score += self._check_content_organization(page) * 0.3
        total_checks += 0.3

        # Check visual balance
        hierarchy_score += self._check_visual_balance(page) * 0.2
        total_checks += 0.2

        return hierarchy_score / total_checks if total_checks > 0 else 0.0

    def _check_heading_structure(self, page: MockNotionPage) -> float:
        """Check proper heading hierarchy (H1 -> H2 -> H3)"""
        headings = []
        for block in page.blocks:
            if block['type'] in ['heading_1', 'heading_2', 'heading_3']:
                level = int(block['type'].split('_')[1])
                headings.append(level)

        if not headings:
            return 0.5  # No headings is neutral

        # Check for proper progression
        violations = 0
        for i in range(1, len(headings)):
            if headings[i] > headings[i-1] + 1:  # Skipping levels
                violations += 1

        # H1 should be first
        h1_penalty = 0 if headings[0] == 1 else 0.2

        structure_score = max(0, 1.0 - (violations / len(headings)) - h1_penalty)
        return structure_score

    def _check_emoji_hierarchy(self, page: MockNotionPage) -> float:
        """Check emoji usage for visual hierarchy"""
        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        headings = page.get_blocks_by_type('heading_1') + \
                  page.get_blocks_by_type('heading_2') + \
                  page.get_blocks_by_type('heading_3')

        if not headings:
            return 0.5

        emoji_count = 0
        for heading in headings:
            if re.search(emoji_pattern, heading.get('content', '')):
                emoji_count += 1

        emoji_ratio = emoji_count / len(headings)

        # Optimal ratio is 70-90%
        if 0.7 <= emoji_ratio <= 0.9:
            return 1.0
        elif 0.5 <= emoji_ratio < 0.7:
            return 0.8
        elif emoji_ratio > 0.9:
            return 0.7  # Too many emojis can be distracting
        else:
            return 0.4

    def _check_content_organization(self, page: MockNotionPage) -> float:
        """Check logical content organization"""
        blocks = page.blocks
        organization_score = 1.0

        # Check for proper spacing with dividers
        divider_count = len(page.get_blocks_by_type('divider'))
        if divider_count > 0:
            organization_score += 0.1

        # Check for balanced content types
        block_types = set(block['type'] for block in blocks)
        diversity_bonus = min(0.2, len(block_types) * 0.03)
        organization_score += diversity_bonus

        # Penalize if too many consecutive same types
        consecutive_penalty = 0
        for i in range(1, len(blocks)):
            if (blocks[i]['type'] == blocks[i-1]['type'] and
                blocks[i]['type'] in ['paragraph', 'bulleted_list_item']):
                consecutive_penalty += 0.05

        return max(0, organization_score - consecutive_penalty)

    def _check_visual_balance(self, page: MockNotionPage) -> float:
        """Check visual balance of content"""
        total_blocks = len(page.blocks)

        if total_blocks == 0:
            return 0.0

        # Ideal block count is 8-12
        if 8 <= total_blocks <= 12:
            block_score = 1.0
        elif 6 <= total_blocks < 8 or 12 < total_blocks <= 15:
            block_score = 0.8
        elif 4 <= total_blocks < 6 or 15 < total_blocks <= 20:
            block_score = 0.6
        else:
            block_score = 0.3

        return block_score

    def check_hierarchy_violations(self, page: MockNotionPage) -> List[str]:
        """Check for specific hierarchy violations"""
        violations = []

        # Check for missing H1
        h1_blocks = page.get_blocks_by_type('heading_1')
        if not h1_blocks:
            violations.append("Missing H1 heading for page title")

        # Check for skipped heading levels
        headings = []
        for block in page.blocks:
            if block['type'].startswith('heading_'):
                level = int(block['type'].split('_')[1])
                headings.append((level, block.get('content', '')))

        for i in range(1, len(headings)):
            current_level = headings[i][0]
            prev_level = headings[i-1][0]
            if current_level > prev_level + 1:
                violations.append(f"Skipped heading level from H{prev_level} to H{current_level}")

        return violations


class MobileResponsivenessChecker:
    """Check mobile responsiveness and compatibility"""

    def analyze_mobile_compatibility(self, page: MockNotionPage) -> Dict[str, Any]:
        """Analyze overall mobile compatibility"""
        return {
            'readability_score': self._calculate_mobile_readability(page),
            'table_compliance': self._check_table_mobile_compliance(page),
            'horizontal_scroll_risk': self._assess_horizontal_scroll_risk(page),
            'touch_target_adequacy': self._check_touch_targets(page),
            'content_density': self._analyze_mobile_content_density(page)
        }

    def _calculate_mobile_readability(self, page: MockNotionPage) -> float:
        """Calculate mobile readability score"""
        readability_score = 1.0

        # Check paragraph length
        paragraphs = page.get_blocks_by_type('paragraph')
        for paragraph in paragraphs:
            content = paragraph.get('content', '')
            word_count = len(content.split())

            # Ideal mobile paragraph: 15-30 words
            if word_count > 50:
                readability_score -= 0.1
            elif word_count > 30:
                readability_score -= 0.05

        # Check heading length
        headings = page.get_blocks_by_type('heading_1') + \
                  page.get_blocks_by_type('heading_2') + \
                  page.get_blocks_by_type('heading_3')

        for heading in headings:
            content = heading.get('content', '')
            char_count = len(content)

            # Mobile headings should be under 40 characters
            if char_count > 60:
                readability_score -= 0.15
            elif char_count > 40:
                readability_score -= 0.08

        return max(0.0, readability_score)

    def _check_table_mobile_compliance(self, page: MockNotionPage) -> bool:
        """Check if tables are mobile-compliant"""
        tables = page.get_blocks_by_type('table')

        for table in tables:
            content = table.get('content', {})
            headers = content.get('headers', [])

            # Mobile tables should have 4 or fewer columns
            if len(headers) > 4:
                return False

        return True

    def _assess_horizontal_scroll_risk(self, page: MockNotionPage) -> float:
        """Assess risk of horizontal scrolling on mobile"""
        risk_score = 0.0

        # Check tables
        tables = page.get_blocks_by_type('table')
        for table in tables:
            content = table.get('content', {})
            headers = content.get('headers', [])
            column_count = len(headers)

            if column_count > 4:
                risk_score += 0.3
            elif column_count > 3:
                risk_score += 0.1

        # Check code blocks
        code_blocks = page.get_blocks_by_type('code')
        for code_block in code_blocks:
            content = code_block.get('content', '')
            lines = content.split('\n')

            for line in lines:
                if len(line) > 50:  # Long code lines
                    risk_score += 0.05

        # Check long URLs or text
        all_blocks = page.blocks
        for block in all_blocks:
            content = block.get('content', '')
            if isinstance(content, str):
                words = content.split()
                for word in words:
                    if len(word) > 30:  # Very long words/URLs
                        risk_score += 0.02

        return min(1.0, risk_score)

    def _check_touch_targets(self, page: MockNotionPage) -> float:
        """Check adequacy of touch targets"""
        # In Notion, this primarily applies to links and interactive elements
        score = 1.0

        # Check for adequate spacing between interactive elements
        interactive_blocks = (page.get_blocks_by_type('toggle') +
                            page.get_blocks_by_type('callout'))

        consecutive_interactive = 0
        prev_was_interactive = False

        for block in page.blocks:
            is_interactive = block['type'] in ['toggle', 'callout']

            if is_interactive and prev_was_interactive:
                consecutive_interactive += 1

            prev_was_interactive = is_interactive

        # Penalize consecutive interactive elements without spacing
        if consecutive_interactive > 2:
            score -= 0.2

        return max(0.0, score)

    def _analyze_mobile_content_density(self, page: MockNotionPage) -> float:
        """Analyze content density for mobile viewing"""
        total_blocks = len(page.blocks)

        if total_blocks == 0:
            return 1.0

        # Calculate text density
        text_blocks = (page.get_blocks_by_type('paragraph') +
                      page.get_blocks_by_type('bulleted_list_item') +
                      page.get_blocks_by_type('numbered_list_item'))

        text_ratio = len(text_blocks) / total_blocks

        # Optimal text ratio for mobile: 40-60%
        if 0.4 <= text_ratio <= 0.6:
            return 1.0
        elif 0.3 <= text_ratio < 0.4 or 0.6 < text_ratio <= 0.7:
            return 0.8
        else:
            return 0.6

    def check_mobile_violations(self, page: MockNotionPage) -> List[str]:
        """Check for specific mobile violations"""
        violations = []

        # Check table columns
        tables = page.get_blocks_by_type('table')
        for i, table in enumerate(tables):
            content = table.get('content', {})
            headers = content.get('headers', [])
            if len(headers) > 4:
                violations.append(f"Table {i+1} has {len(headers)} columns (max 4 for mobile)")

        # Check heading length
        headings = page.get_blocks_by_type('heading_1') + \
                  page.get_blocks_by_type('heading_2') + \
                  page.get_blocks_by_type('heading_3')

        for i, heading in enumerate(headings):
            content = heading.get('content', '')
            if len(content) > 40:
                violations.append(f"Heading {i+1} too long for mobile ({len(content)} chars)")

        return violations


class AccessibilityValidator:
    """Validate accessibility compliance"""

    def validate_accessibility(self, page: MockNotionPage) -> float:
        """Calculate overall accessibility score"""
        scores = []

        scores.append(self._check_color_contrast(page))
        scores.append(self._check_semantic_structure(page))
        scores.append(self._check_alt_text_coverage(page))
        scores.append(self._check_keyboard_navigation(page))
        scores.append(self._check_reading_order(page))

        return sum(scores) / len(scores) if scores else 0.0

    def _check_color_contrast(self, page: MockNotionPage) -> float:
        """Check color contrast ratios"""
        # Default Notion colors for assessment
        color_combinations = [
            ('#000000', '#FFFFFF'),  # Default text
            ('#37352F', '#FFFFFF'),  # Default Notion text
            ('#0969DA', '#FFFFFF'),  # Blue links
            ('#CF222E', '#FFFFFF'),  # Red callouts
        ]

        contrast_scores = []
        calculator = ColorContrastCalculator()

        for fg, bg in color_combinations:
            ratio = calculator.contrast_ratio(fg, bg)
            # WCAG AA requires 4.5:1 for normal text, 3:1 for large text
            if ratio >= 4.5:
                contrast_scores.append(1.0)
            elif ratio >= 3.0:
                contrast_scores.append(0.7)
            else:
                contrast_scores.append(0.3)

        return sum(contrast_scores) / len(contrast_scores)

    def _check_semantic_structure(self, page: MockNotionPage) -> float:
        """Check semantic structure for screen readers"""
        score = 1.0

        # Check for proper heading hierarchy
        hierarchy_analyzer = VisualHierarchyAnalyzer()
        violations = hierarchy_analyzer.check_hierarchy_violations(page)
        score -= len(violations) * 0.2

        # Check for list structure
        lists = (page.get_blocks_by_type('bulleted_list_item') +
                page.get_blocks_by_type('numbered_list_item'))

        if lists:
            score += 0.1  # Bonus for using semantic lists

        return max(0.0, score)

    def _check_alt_text_coverage(self, page: MockNotionPage) -> float:
        """Check alt text coverage for images and media"""
        # In Notion context, this applies to emojis and icons serving functional purposes
        functional_emojis = 0
        total_emojis = 0

        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        for block in page.blocks:
            content = str(block.get('content', ''))
            emojis = re.findall(emoji_pattern, content)
            total_emojis += len(emojis)

            # Check if emojis are in headings (functional)
            if block['type'].startswith('heading_') and emojis:
                functional_emojis += len(emojis)

            # Check callout icons (functional)
            if block['type'] == 'callout' and emojis:
                functional_emojis += len(emojis)

        if total_emojis == 0:
            return 1.0  # No emojis to evaluate

        functional_ratio = functional_emojis / total_emojis
        return functional_ratio

    def _check_keyboard_navigation(self, page: MockNotionPage) -> float:
        """Check keyboard navigation support"""
        # Notion inherently supports keyboard navigation
        # Check for logical tab order based on content structure

        interactive_elements = (page.get_blocks_by_type('toggle') +
                              page.get_blocks_by_type('callout'))

        # Award points for having navigable elements
        if interactive_elements:
            return 1.0
        else:
            return 0.8  # Static content is still navigable

    def _check_reading_order(self, page: MockNotionPage) -> float:
        """Check logical reading order"""
        score = 1.0

        # Check if headings come before related content
        for i, block in enumerate(page.blocks[:-1]):
            if block['type'].startswith('heading_'):
                next_block = page.blocks[i + 1]

                # Heading followed by another heading of same/higher level is OK
                if (next_block['type'].startswith('heading_') and
                    not self._is_lower_heading_level(block['type'], next_block['type'])):
                    continue

                # Heading should be followed by content or lower-level heading
                if not (next_block['type'] in ['paragraph', 'bulleted_list_item',
                                             'numbered_list_item', 'callout', 'toggle'] or
                       self._is_lower_heading_level(block['type'], next_block['type'])):
                    score -= 0.1

        return max(0.0, score)

    def _is_lower_heading_level(self, heading1: str, heading2: str) -> bool:
        """Check if heading2 is lower level than heading1"""
        if not (heading1.startswith('heading_') and heading2.startswith('heading_')):
            return False

        level1 = int(heading1.split('_')[1])
        level2 = int(heading2.split('_')[1])

        return level2 > level1

    def generate_accessibility_report(self, page: MockNotionPage) -> Dict[str, Any]:
        """Generate comprehensive accessibility report"""
        return {
            'color_contrast_score': self._check_color_contrast(page),
            'semantic_structure': self._check_semantic_structure(page) > 0.8,
            'alt_text_coverage': self._check_alt_text_coverage(page) > 0.7,
            'keyboard_navigation': self._check_keyboard_navigation(page) > 0.8,
            'reading_order': self._check_reading_order(page) > 0.8,
            'overall_compliant': self.validate_accessibility(page) > 0.8
        }


class NotionAestheticValidator:
    """Main validator for Notion page aesthetics"""

    def __init__(self):
        self.hierarchy_analyzer = VisualHierarchyAnalyzer()
        self.mobile_checker = MobileResponsivenessChecker()
        self.accessibility_validator = AccessibilityValidator()

    def validate_emoji_functionality(self, page: MockNotionPage) -> float:
        """Validate emoji usage for functional navigation"""
        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        functional_score = 0.0
        total_checks = 0

        # Check headings for emojis
        headings = (page.get_blocks_by_type('heading_1') +
                   page.get_blocks_by_type('heading_2') +
                   page.get_blocks_by_type('heading_3'))

        if headings:
            emoji_headings = 0
            for heading in headings:
                if re.search(emoji_pattern, heading.get('content', '')):
                    emoji_headings += 1

            heading_ratio = emoji_headings / len(headings)
            functional_score += heading_ratio * 0.5
            total_checks += 0.5

        # Check callouts for appropriate icons
        callouts = page.get_blocks_by_type('callout')
        if callouts:
            icon_callouts = 0
            for callout in callouts:
                styling = callout.get('styling', {})
                if styling.get('icon') or re.search(emoji_pattern, callout.get('content', '')):
                    icon_callouts += 1

            callout_ratio = icon_callouts / len(callouts)
            functional_score += callout_ratio * 0.3
            total_checks += 0.3

        # Check toggles for icons
        toggles = page.get_blocks_by_type('toggle')
        if toggles:
            icon_toggles = 0
            for toggle in toggles:
                if re.search(emoji_pattern, toggle.get('content', '')):
                    icon_toggles += 1

            toggle_ratio = icon_toggles / len(toggles)
            functional_score += toggle_ratio * 0.2
            total_checks += 0.2

        return functional_score / total_checks if total_checks > 0 else 0.8

    def analyze_emoji_usage(self, page: MockNotionPage) -> Dict[str, Any]:
        """Analyze emoji usage patterns"""
        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        total_emojis = 0
        functional_emojis = 0
        emoji_blocks = 0

        for block in page.blocks:
            content = str(block.get('content', ''))
            emojis_in_block = re.findall(emoji_pattern, content)

            if emojis_in_block:
                emoji_blocks += 1
                total_emojis += len(emojis_in_block)

                # Count functional emojis (in headings, callouts, toggles)
                if block['type'] in ['heading_1', 'heading_2', 'heading_3', 'callout', 'toggle']:
                    functional_emojis += len(emojis_in_block)

        total_blocks = len(page.blocks)
        coverage_percentage = (emoji_blocks / total_blocks * 100) if total_blocks > 0 else 0
        functional_percentage = (functional_emojis / total_emojis * 100) if total_emojis > 0 else 0

        return {
            'total_emojis': total_emojis,
            'functional_emojis': functional_emojis,
            'coverage_percentage': coverage_percentage,
            'functional_percentage': functional_percentage,
            'consistent_placement': functional_percentage > 70,
            'functional_purpose': functional_emojis > 0,
            'optimal_usage': 60 <= coverage_percentage <= 80
        }

    def validate_table_formatting(self, page: MockNotionPage) -> float:
        """Validate table formatting and mobile compliance"""
        tables = page.get_blocks_by_type('table')

        if not tables:
            return 1.0  # No tables to validate

        total_score = 0.0

        for table in tables:
            table_score = 1.0
            content = table.get('content', {})
            headers = content.get('headers', [])
            rows = content.get('rows', [])

            # Column count penalty
            column_count = len(headers)
            if column_count > 4:
                table_score -= 0.4  # Major penalty for mobile
            elif column_count > 3:
                table_score -= 0.2

            # Header quality
            if not headers:
                table_score -= 0.3
            else:
                # Check header length
                avg_header_length = sum(len(str(h)) for h in headers) / len(headers)
                if avg_header_length > 15:
                    table_score -= 0.1

            # Data consistency
            if rows:
                for row in rows:
                    if len(row) != column_count:
                        table_score -= 0.1
                        break

            # Mobile optimization check
            styling = table.get('styling', {})
            if styling.get('mobile_optimized', False):
                table_score += 0.1

            total_score += max(0.0, table_score)

        return total_score / len(tables)

    def check_table_column_limits(self, page: MockNotionPage) -> Dict[str, Any]:
        """Check table column limits for mobile compliance"""
        tables = page.get_blocks_by_type('table')

        if not tables:
            return {
                'mobile_compliant': True,
                'max_columns': 0,
                'violations': []
            }

        max_columns = 0
        violations = []

        for i, table in enumerate(tables):
            content = table.get('content', {})
            headers = content.get('headers', [])
            column_count = len(headers)

            max_columns = max(max_columns, column_count)

            if column_count > 4:
                violations.append(f"Table {i+1}: {column_count} columns (max 4 recommended)")

        return {
            'mobile_compliant': max_columns <= 4,
            'max_columns': max_columns,
            'violations': violations
        }

    def validate_callout_blocks(self, page: MockNotionPage) -> float:
        """Validate callout block formatting"""
        callouts = page.get_blocks_by_type('callout')

        if not callouts:
            return 1.0

        total_score = 0.0
        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        for callout in callouts:
            callout_score = 1.0
            content = callout.get('content', '')
            styling = callout.get('styling', {})

            # Check for icon presence
            has_emoji = bool(re.search(emoji_pattern, content))
            has_icon = bool(styling.get('icon'))

            if not (has_emoji or has_icon):
                callout_score -= 0.3

            # Check content length (callouts should be concise)
            if len(content) > 200:
                callout_score -= 0.2
            elif len(content) < 10:
                callout_score -= 0.1

            # Check background color appropriateness
            bg_color = styling.get('background_color', '')
            if bg_color in ['red', 'yellow', 'blue_light', 'green_light']:
                callout_score += 0.1

            total_score += max(0.0, callout_score)

        return total_score / len(callouts)

    def validate_toggle_blocks(self, page: MockNotionPage) -> float:
        """Validate toggle block formatting"""
        toggles = page.get_blocks_by_type('toggle')

        if not toggles:
            return 1.0

        total_score = 0.0
        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        for toggle in toggles:
            toggle_score = 1.0
            content = toggle.get('content', '')
            children = toggle.get('children', [])

            # Check for emoji in toggle title
            if re.search(emoji_pattern, content):
                toggle_score += 0.2

            # Check toggle title length
            if len(content) > 60:
                toggle_score -= 0.2

            # Check for content in children
            if not children:
                toggle_score -= 0.3
            elif len(children) > 5:
                toggle_score -= 0.1  # Too much nested content

            total_score += max(0.0, toggle_score)

        return total_score / len(toggles)

    def analyze_callout_effectiveness(self, page: MockNotionPage) -> Dict[str, Any]:
        """Analyze callout block effectiveness"""
        callouts = page.get_blocks_by_type('callout')

        if not callouts:
            return {
                'has_appropriate_icons': True,
                'proper_contrast': True,
                'concise_content': True,
                'effective_placement': True
            }

        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        has_icons = 0
        proper_length = 0
        good_contrast = 0

        for callout in callouts:
            content = callout.get('content', '')
            styling = callout.get('styling', {})

            # Check for icons
            if (re.search(emoji_pattern, content) or styling.get('icon')):
                has_icons += 1

            # Check content length
            if 10 <= len(content) <= 200:
                proper_length += 1

            # Check contrast (simplified)
            bg_color = styling.get('background_color', '')
            if bg_color in ['blue_light', 'yellow_light', 'green_light', 'red_light']:
                good_contrast += 1

        total_callouts = len(callouts)

        return {
            'has_appropriate_icons': has_icons / total_callouts > 0.7,
            'proper_contrast': good_contrast / total_callouts > 0.8,
            'concise_content': proper_length / total_callouts > 0.8,
            'effective_placement': True  # Simplified for now
        }

    def validate_code_blocks(self, page: MockNotionPage) -> float:
        """Validate code block formatting"""
        code_blocks = page.get_blocks_by_type('code')

        if not code_blocks:
            return 1.0

        total_score = 0.0

        for code_block in code_blocks:
            code_score = 1.0
            content = code_block.get('content', '')
            styling = code_block.get('styling', {})

            # Check for language specification
            if styling.get('language'):
                code_score += 0.2

            # Check line length for mobile
            lines = content.split('\n')
            long_lines = sum(1 for line in lines if len(line) > 50)
            if long_lines > 0:
                code_score -= min(0.3, long_lines * 0.1)

            # Check for proper wrapping setting
            if styling.get('wrap', False):
                code_score += 0.1

            total_score += max(0.0, code_score)

        return total_score / len(code_blocks)

    def analyze_code_formatting(self, page: MockNotionPage) -> Dict[str, Any]:
        """Analyze code block formatting details"""
        code_blocks = page.get_blocks_by_type('code')

        if not code_blocks:
            return {
                'syntax_highlighting': True,
                'proper_wrapping': True,
                'mobile_readable': True,
                'appropriate_length': True
            }

        has_language = 0
        has_wrapping = 0
        mobile_friendly = 0
        appropriate_length = 0

        for code_block in code_blocks:
            content = code_block.get('content', '')
            styling = code_block.get('styling', {})

            # Check language specification
            if styling.get('language'):
                has_language += 1

            # Check wrapping
            if styling.get('wrap', False):
                has_wrapping += 1

            # Check mobile friendliness
            lines = content.split('\n')
            long_lines = sum(1 for line in lines if len(line) > 50)
            if long_lines <= len(lines) * 0.3:  # 30% or fewer long lines
                mobile_friendly += 1

            # Check length appropriateness
            if 1 <= len(lines) <= 20:
                appropriate_length += 1

        total_blocks = len(code_blocks)

        return {
            'syntax_highlighting': has_language / total_blocks > 0.7,
            'proper_wrapping': has_wrapping / total_blocks > 0.5,
            'mobile_readable': mobile_friendly / total_blocks > 0.7,
            'appropriate_length': appropriate_length / total_blocks > 0.8
        }

    def analyze_content_density(self, page: MockNotionPage) -> float:
        """Analyze content density score"""
        total_blocks = len(page.blocks)

        if total_blocks == 0:
            return 0.0

        # Calculate different content types
        text_blocks = len(page.get_blocks_by_type('paragraph'))
        heading_blocks = (len(page.get_blocks_by_type('heading_1')) +
                         len(page.get_blocks_by_type('heading_2')) +
                         len(page.get_blocks_by_type('heading_3')))
        list_blocks = (len(page.get_blocks_by_type('bulleted_list_item')) +
                      len(page.get_blocks_by_type('numbered_list_item')))
        visual_blocks = (len(page.get_blocks_by_type('callout')) +
                        len(page.get_blocks_by_type('toggle')) +
                        len(page.get_blocks_by_type('table')))
        spacing_blocks = len(page.get_blocks_by_type('divider'))

        # Calculate ratios
        text_ratio = text_blocks / total_blocks
        heading_ratio = heading_blocks / total_blocks
        visual_ratio = visual_blocks / total_blocks
        spacing_ratio = spacing_blocks / total_blocks

        # Optimal ratios for good density
        density_score = 1.0

        # Text should be 30-50% of content
        if text_ratio < 0.2 or text_ratio > 0.6:
            density_score -= 0.2

        # Headings should be 10-25% of content
        if heading_ratio < 0.1 or heading_ratio > 0.3:
            density_score -= 0.1

        # Visual elements should be 15-35% of content
        if visual_ratio < 0.1 or visual_ratio > 0.4:
            density_score -= 0.1

        # Some spacing is good (5-15%)
        if spacing_ratio > 0.2:
            density_score -= 0.1
        elif spacing_ratio > 0.05:
            density_score += 0.1

        return max(0.0, density_score)

    def analyze_whitespace_balance(self, page: MockNotionPage) -> float:
        """Analyze whitespace and visual balance"""
        total_blocks = len(page.blocks)

        if total_blocks == 0:
            return 1.0

        balance_score = 1.0

        # Check for dividers (explicit whitespace)
        dividers = page.get_blocks_by_type('divider')
        divider_ratio = len(dividers) / total_blocks

        if divider_ratio > 0.15:
            balance_score -= 0.2  # Too many dividers
        elif divider_ratio > 0.05:
            balance_score += 0.1  # Good spacing

        # Check for balanced content blocks
        consecutive_text = 0
        max_consecutive_text = 0

        for block in page.blocks:
            if block['type'] in ['paragraph', 'bulleted_list_item', 'numbered_list_item']:
                consecutive_text += 1
                max_consecutive_text = max(max_consecutive_text, consecutive_text)
            else:
                consecutive_text = 0

        # Penalize too many consecutive text blocks
        if max_consecutive_text > 4:
            balance_score -= 0.2

        # Check for visual break elements
        visual_breaks = (len(page.get_blocks_by_type('callout')) +
                        len(page.get_blocks_by_type('toggle')) +
                        len(page.get_blocks_by_type('table')) +
                        len(dividers))

        visual_ratio = visual_breaks / total_blocks

        # Optimal visual break ratio: 20-40%
        if 0.2 <= visual_ratio <= 0.4:
            balance_score += 0.1

        return max(0.0, balance_score)

    def analyze_scan_efficiency(self, page: MockNotionPage) -> float:
        """Analyze visual scanning efficiency"""
        scan_score = 1.0

        # Check heading distribution
        headings = (page.get_blocks_by_type('heading_1') +
                   page.get_blocks_by_type('heading_2') +
                   page.get_blocks_by_type('heading_3'))

        total_blocks = len(page.blocks)

        if total_blocks > 0:
            heading_ratio = len(headings) / total_blocks

            # Optimal heading ratio: 15-30%
            if 0.15 <= heading_ratio <= 0.3:
                scan_score += 0.2
            elif heading_ratio < 0.1:
                scan_score -= 0.3  # Hard to scan without headings

        # Check emoji usage for scanning
        emoji_score = self.validate_emoji_functionality(page)
        scan_score += emoji_score * 0.3

        # Check content chunk sizes
        content_blocks = (page.get_blocks_by_type('paragraph') +
                         page.get_blocks_by_type('bulleted_list_item') +
                         page.get_blocks_by_type('numbered_list_item'))

        if content_blocks:
            avg_content_length = sum(len(block.get('content', '')) for block in content_blocks) / len(content_blocks)

            # Optimal content length for scanning: 50-150 characters
            if 50 <= avg_content_length <= 150:
                scan_score += 0.1
            elif avg_content_length > 300:
                scan_score -= 0.2

        return max(0.0, min(1.0, scan_score))

    def generate_scan_analysis(self, page: MockNotionPage) -> Dict[str, Any]:
        """Generate detailed scan analysis"""
        total_blocks = len(page.blocks)

        # Calculate cognitive load factors
        headings = (page.get_blocks_by_type('heading_1') +
                   page.get_blocks_by_type('heading_2') +
                   page.get_blocks_by_type('heading_3'))

        # Long paragraphs increase cognitive load
        paragraphs = page.get_blocks_by_type('paragraph')
        long_paragraphs = sum(1 for p in paragraphs if len(p.get('content', '')) > 200)

        cognitive_load = 0.0
        if paragraphs:
            cognitive_load += (long_paragraphs / len(paragraphs)) * 0.5

        # Complex tables increase cognitive load
        tables = page.get_blocks_by_type('table')
        complex_tables = sum(1 for t in tables
                           if len(t.get('content', {}).get('headers', [])) > 3)
        if tables:
            cognitive_load += (complex_tables / len(tables)) * 0.3

        # Navigation clarity based on structure
        navigation_clarity = 0.8  # Base score

        if headings and total_blocks > 0:
            heading_ratio = len(headings) / total_blocks
            if heading_ratio >= 0.15:
                navigation_clarity += 0.2

        emoji_functionality = self.validate_emoji_functionality(page)
        navigation_clarity += emoji_functionality * 0.2

        return {
            'cognitive_load': min(1.0, cognitive_load),
            'navigation_clarity': min(1.0, navigation_clarity),
            'heading_distribution': len(headings) / total_blocks if total_blocks > 0 else 0,
            'content_chunk_size': 'optimal',  # Simplified
            'visual_hierarchy_strength': self.hierarchy_analyzer.analyze_hierarchy(page)
        }

    def validate_link_formatting(self, page: MockNotionPage) -> float:
        """Validate link formatting"""
        # Simplified link validation for Notion context
        link_score = 1.0

        # Check for Drive links in content
        drive_links = 0
        total_content_blocks = 0

        for block in page.blocks:
            content = str(block.get('content', ''))
            total_content_blocks += 1

            if 'drive.google.com' in content:
                drive_links += 1

                # Check for emoji before Drive links
                if '📄' in content or '📁' in content:
                    link_score += 0.1

        return min(1.0, link_score)

    def analyze_drive_link_prominence(self, page: MockNotionPage) -> Dict[str, Any]:
        """Analyze Drive link prominence"""
        drive_links_found = 0
        prominent_drive_links = 0

        for block in page.blocks:
            content = str(block.get('content', ''))

            if 'drive.google.com' in content:
                drive_links_found += 1

                # Check for prominence indicators
                if ('📄' in content or '📁' in content or
                    block['type'] in ['heading_2', 'heading_3', 'callout']):
                    prominent_drive_links += 1

        return {
            'total_drive_links': drive_links_found,
            'prominent_links': prominent_drive_links,
            'prominent_placement': prominent_drive_links / drive_links_found > 0.7 if drive_links_found > 0 else True,
            'clear_labeling': True  # Simplified
        }

    def analyze_performance_impact(self, page: MockNotionPage) -> float:
        """Analyze page performance impact"""
        performance_score = 1.0
        total_blocks = len(page.blocks)

        # Block count impact
        if total_blocks > 15:
            performance_score -= 0.2
        elif total_blocks > 20:
            performance_score -= 0.4

        # Complex elements impact
        tables = page.get_blocks_by_type('table')
        for table in tables:
            headers = table.get('content', {}).get('headers', [])
            if len(headers) > 4:
                performance_score -= 0.1

        # Toggle complexity
        toggles = page.get_blocks_by_type('toggle')
        for toggle in toggles:
            children = toggle.get('children', [])
            if len(children) > 3:
                performance_score -= 0.05

        return max(0.0, performance_score)

    def generate_performance_analysis(self, page: MockNotionPage) -> Dict[str, Any]:
        """Generate performance analysis"""
        total_blocks = len(page.blocks)

        # Calculate complexity score
        complexity_factors = []

        # Block count complexity
        complexity_factors.append(min(1.0, total_blocks / 20))

        # Table complexity
        tables = page.get_blocks_by_type('table')
        if tables:
            avg_columns = sum(len(t.get('content', {}).get('headers', [])) for t in tables) / len(tables)
            complexity_factors.append(min(1.0, avg_columns / 6))

        # Toggle nesting complexity
        toggles = page.get_blocks_by_type('toggle')
        if toggles:
            avg_children = sum(len(t.get('children', [])) for t in toggles) / len(toggles)
            complexity_factors.append(min(1.0, avg_children / 5))

        complexity_score = sum(complexity_factors) / len(complexity_factors) if complexity_factors else 0.2

        # Render weight calculation
        render_weight = 0.0
        render_weight += len(tables) * 0.1
        render_weight += len(toggles) * 0.05
        render_weight += len(page.get_blocks_by_type('callout')) * 0.03
        render_weight += total_blocks * 0.01

        return {
            'complexity_score': complexity_score,
            'render_weight': min(1.0, render_weight),
            'block_count_impact': total_blocks / 15,  # Normalized to 15 blocks
            'optimization_opportunities': self._identify_optimization_opportunities(page)
        }

    def _identify_optimization_opportunities(self, page: MockNotionPage) -> List[str]:
        """Identify optimization opportunities"""
        opportunities = []

        # Check for oversized tables
        tables = page.get_blocks_by_type('table')
        for i, table in enumerate(tables):
            headers = table.get('content', {}).get('headers', [])
            if len(headers) > 4:
                opportunities.append(f"Reduce table {i+1} columns for mobile optimization")

        # Check for excessive toggles
        toggles = page.get_blocks_by_type('toggle')
        if len(toggles) > 5:
            opportunities.append("Consider consolidating toggle blocks")

        # Check for long content blocks
        paragraphs = page.get_blocks_by_type('paragraph')
        long_paragraphs = [i for i, p in enumerate(paragraphs)
                          if len(p.get('content', '')) > 300]
        if long_paragraphs:
            opportunities.append(f"Break up long paragraphs (blocks {long_paragraphs})")

        return opportunities

    def analyze_block_structure(self, page: MockNotionPage) -> Dict[str, Any]:
        """Analyze 12-block limit compliance and structure"""
        total_blocks = len(page.blocks)
        block_types = [block['type'] for block in page.blocks]
        unique_types = set(block_types)

        # Calculate block diversity
        diversity_score = len(unique_types) / max(1, len(block_types))

        # Check logical flow
        logical_flow = self._assess_logical_flow(page)

        return {
            'total_blocks': total_blocks,
            'within_12_block_limit': total_blocks <= 12,
            'block_diversity': diversity_score,
            'unique_block_types': len(unique_types),
            'logical_flow': logical_flow,
            'block_type_distribution': {block_type: block_types.count(block_type)
                                     for block_type in unique_types}
        }

    def _assess_logical_flow(self, page: MockNotionPage) -> bool:
        """Assess if content has logical flow"""
        # Simplified logical flow assessment
        blocks = page.blocks

        # Check if page starts with heading
        if not blocks:
            return True

        first_block = blocks[0]
        if first_block['type'] != 'heading_1':
            return False

        # Check for reasonable heading distribution
        headings = [i for i, block in enumerate(blocks)
                   if block['type'].startswith('heading_')]

        if not headings:
            return False

        # Headings should be reasonably distributed
        if len(headings) >= 2:
            avg_gap = len(blocks) / len(headings)
            if avg_gap > 8:  # Too much content between headings
                return False

        return True

    def generate_comprehensive_metrics(self, page: MockNotionPage) -> AestheticMetrics:
        """Generate comprehensive aesthetic metrics"""
        # Calculate all component scores
        visual_hierarchy_score = self.hierarchy_analyzer.analyze_hierarchy(page)
        mobile_metrics = self.mobile_checker.analyze_mobile_compatibility(page)
        mobile_readability_score = mobile_metrics['readability_score']
        scan_efficiency_score = self.analyze_scan_efficiency(page)
        accessibility_score = self.accessibility_validator.validate_accessibility(page)

        # Additional scores
        emoji_functionality_score = self.validate_emoji_functionality(page)
        content_density_score = self.analyze_content_density(page)
        white_space_balance = self.analyze_whitespace_balance(page)
        table_mobile_compliance = mobile_metrics['table_compliance']

        # Color contrast (simplified)
        color_contrast_score = self.accessibility_validator._check_color_contrast(page)

        # Calculate overall score
        scores = [
            visual_hierarchy_score * 0.2,
            mobile_readability_score * 0.2,
            scan_efficiency_score * 0.15,
            accessibility_score * 0.15,
            emoji_functionality_score * 0.1,
            content_density_score * 0.1,
            white_space_balance * 0.1
        ]

        overall_aesthetic_score = sum(scores)

        return AestheticMetrics(
            visual_hierarchy_score=visual_hierarchy_score,
            mobile_readability_score=mobile_readability_score,
            scan_efficiency_score=scan_efficiency_score,
            accessibility_score=accessibility_score,
            color_contrast_score=color_contrast_score,
            white_space_balance=white_space_balance,
            emoji_functionality_score=emoji_functionality_score,
            table_mobile_compliance=table_mobile_compliance,
            content_density_score=content_density_score,
            overall_aesthetic_score=overall_aesthetic_score
        )