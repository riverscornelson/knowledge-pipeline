"""
Mobile vs Desktop Comparison Tool
Analyzes display differences between mobile and desktop Notion viewing.
"""

import json
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum

from .notion_aesthetic_validator import MockNotionPage, AestheticMetrics


class ViewportSize(Enum):
    """Common viewport sizes for testing"""
    MOBILE_SMALL = (320, 568)      # iPhone SE
    MOBILE_MEDIUM = (375, 667)     # iPhone 8
    MOBILE_LARGE = (414, 896)      # iPhone 11 Pro Max
    TABLET_PORTRAIT = (768, 1024)  # iPad Portrait
    TABLET_LANDSCAPE = (1024, 768) # iPad Landscape
    DESKTOP_SMALL = (1280, 720)    # Small Desktop
    DESKTOP_MEDIUM = (1440, 900)   # Medium Desktop
    DESKTOP_LARGE = (1920, 1080)   # Large Desktop


@dataclass
class ViewportMetrics:
    """Metrics for a specific viewport"""
    viewport_size: Tuple[int, int]
    readability_score: float
    usability_score: float
    visual_hierarchy_score: float
    content_accessibility: float
    interaction_efficiency: float
    scroll_behavior_score: float
    performance_impact: float


@dataclass
class ResponsiveAnalysis:
    """Complete responsive analysis across viewports"""
    page_title: str
    mobile_metrics: ViewportMetrics
    tablet_metrics: ViewportMetrics
    desktop_metrics: ViewportMetrics
    breakpoint_analysis: Dict[str, Any]
    responsive_score: float
    critical_issues: List[str]
    recommendations: List[str]


class MobileDesktopComparator:
    """Compare Notion page display between mobile and desktop"""

    def __init__(self):
        self.viewport_configs = {
            'mobile': ViewportSize.MOBILE_MEDIUM.value,
            'tablet': ViewportSize.TABLET_PORTRAIT.value,
            'desktop': ViewportSize.DESKTOP_MEDIUM.value
        }

    def analyze_responsive_behavior(self, page: MockNotionPage) -> ResponsiveAnalysis:
        """Analyze page behavior across different viewport sizes"""

        # Analyze each viewport
        mobile_metrics = self._analyze_viewport(page, 'mobile')
        tablet_metrics = self._analyze_viewport(page, 'tablet')
        desktop_metrics = self._analyze_viewport(page, 'desktop')

        # Identify breakpoint issues
        breakpoint_analysis = self._analyze_breakpoints(page)

        # Calculate overall responsive score
        responsive_score = self._calculate_responsive_score(
            mobile_metrics, tablet_metrics, desktop_metrics
        )

        # Identify critical issues
        critical_issues = self._identify_critical_issues(
            page, mobile_metrics, tablet_metrics, desktop_metrics
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(
            critical_issues, mobile_metrics, desktop_metrics
        )

        return ResponsiveAnalysis(
            page_title=page.title,
            mobile_metrics=mobile_metrics,
            tablet_metrics=tablet_metrics,
            desktop_metrics=desktop_metrics,
            breakpoint_analysis=breakpoint_analysis,
            responsive_score=responsive_score,
            critical_issues=critical_issues,
            recommendations=recommendations
        )

    def _analyze_viewport(self, page: MockNotionPage, viewport_type: str) -> ViewportMetrics:
        """Analyze page for specific viewport"""
        viewport_size = self.viewport_configs[viewport_type]
        width, height = viewport_size

        # Calculate viewport-specific metrics
        readability_score = self._calculate_readability(page, viewport_type)
        usability_score = self._calculate_usability(page, viewport_type)
        visual_hierarchy_score = self._calculate_visual_hierarchy(page, viewport_type)
        content_accessibility = self._calculate_content_accessibility(page, viewport_type)
        interaction_efficiency = self._calculate_interaction_efficiency(page, viewport_type)
        scroll_behavior_score = self._calculate_scroll_behavior(page, viewport_type)
        performance_impact = self._calculate_performance_impact(page, viewport_type)

        return ViewportMetrics(
            viewport_size=viewport_size,
            readability_score=readability_score,
            usability_score=usability_score,
            visual_hierarchy_score=visual_hierarchy_score,
            content_accessibility=content_accessibility,
            interaction_efficiency=interaction_efficiency,
            scroll_behavior_score=scroll_behavior_score,
            performance_impact=performance_impact
        )

    def _calculate_readability(self, page: MockNotionPage, viewport_type: str) -> float:
        """Calculate readability score for viewport"""
        score = 1.0

        if viewport_type == 'mobile':
            # Mobile-specific readability factors

            # Check heading lengths
            headings = (page.get_blocks_by_type('heading_1') +
                       page.get_blocks_by_type('heading_2') +
                       page.get_blocks_by_type('heading_3'))

            for heading in headings:
                content = heading.get('content', '')
                char_count = len(content)

                if char_count > 40:
                    score -= 0.15
                elif char_count > 30:
                    score -= 0.05

            # Check paragraph lengths
            paragraphs = page.get_blocks_by_type('paragraph')
            for paragraph in paragraphs:
                content = paragraph.get('content', '')
                word_count = len(content.split())

                if word_count > 50:
                    score -= 0.1
                elif word_count > 30:
                    score -= 0.05

            # Check table complexity
            tables = page.get_blocks_by_type('table')
            for table in tables:
                headers = table.get('content', {}).get('headers', [])
                if len(headers) > 3:
                    score -= 0.2
                elif len(headers) > 2:
                    score -= 0.1

        elif viewport_type == 'tablet':
            # Tablet has more tolerance for content
            tables = page.get_blocks_by_type('table')
            for table in tables:
                headers = table.get('content', {}).get('headers', [])
                if len(headers) > 5:
                    score -= 0.1

        # Desktop has highest tolerance
        # Most desktop penalties are minimal

        return max(0.0, score)

    def _calculate_usability(self, page: MockNotionPage, viewport_type: str) -> float:
        """Calculate usability score for viewport"""
        score = 1.0

        if viewport_type == 'mobile':
            # Check touch target adequacy
            interactive_blocks = (page.get_blocks_by_type('toggle') +
                                page.get_blocks_by_type('callout'))

            # Consecutive interactive elements reduce usability
            consecutive_count = 0
            prev_interactive = False

            for block in page.blocks:
                is_interactive = block['type'] in ['toggle', 'callout']
                if is_interactive and prev_interactive:
                    consecutive_count += 1
                prev_interactive = is_interactive

            if consecutive_count > 2:
                score -= 0.2

            # Check for adequate spacing
            total_blocks = len(page.blocks)
            dividers = page.get_blocks_by_type('divider')
            spacing_ratio = len(dividers) / total_blocks if total_blocks > 0 else 0

            if spacing_ratio < 0.05:  # Less than 5% spacing
                score -= 0.15

        return max(0.0, score)

    def _calculate_visual_hierarchy(self, page: MockNotionPage, viewport_type: str) -> float:
        """Calculate visual hierarchy effectiveness for viewport"""
        score = 1.0

        # Emoji usage is more critical on mobile for navigation
        if viewport_type == 'mobile':
            headings = (page.get_blocks_by_type('heading_1') +
                       page.get_blocks_by_type('heading_2') +
                       page.get_blocks_by_type('heading_3'))

            if headings:
                emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'
                import re

                emoji_headings = 0
                for heading in headings:
                    if re.search(emoji_pattern, heading.get('content', '')):
                        emoji_headings += 1

                emoji_ratio = emoji_headings / len(headings)
                if emoji_ratio < 0.7:
                    score -= 0.3  # Higher penalty on mobile

        # Check heading distribution
        total_blocks = len(page.blocks)
        headings = (page.get_blocks_by_type('heading_1') +
                   page.get_blocks_by_type('heading_2') +
                   page.get_blocks_by_type('heading_3'))

        if total_blocks > 0:
            heading_ratio = len(headings) / total_blocks

            if viewport_type == 'mobile':
                # Mobile needs more frequent headings for scanning
                if heading_ratio < 0.2:
                    score -= 0.2
            else:
                # Desktop can handle more content between headings
                if heading_ratio < 0.15:
                    score -= 0.1

        return max(0.0, score)

    def _calculate_content_accessibility(self, page: MockNotionPage, viewport_type: str) -> float:
        """Calculate content accessibility for viewport"""
        score = 1.0

        # Mobile has stricter accessibility requirements
        if viewport_type == 'mobile':
            # Check for adequate content chunking
            paragraphs = page.get_blocks_by_type('paragraph')
            long_paragraphs = sum(1 for p in paragraphs
                                if len(p.get('content', '')) > 200)

            if paragraphs and long_paragraphs > 0:
                long_ratio = long_paragraphs / len(paragraphs)
                score -= long_ratio * 0.3

            # Check for adequate visual breaks
            total_blocks = len(page.blocks)
            visual_breaks = (len(page.get_blocks_by_type('callout')) +
                           len(page.get_blocks_by_type('toggle')) +
                           len(page.get_blocks_by_type('divider')))

            if total_blocks > 6:  # Only for longer content
                break_ratio = visual_breaks / total_blocks
                if break_ratio < 0.2:
                    score -= 0.2

        return max(0.0, score)

    def _calculate_interaction_efficiency(self, page: MockNotionPage, viewport_type: str) -> float:
        """Calculate interaction efficiency for viewport"""
        score = 1.0

        if viewport_type == 'mobile':
            # Check toggle usability
            toggles = page.get_blocks_by_type('toggle')
            for toggle in toggles:
                children = toggle.get('children', [])
                if len(children) > 3:
                    score -= 0.1  # Too much nested content on mobile

            # Check table interaction
            tables = page.get_blocks_by_type('table')
            for table in tables:
                headers = table.get('content', {}).get('headers', [])
                if len(headers) > 3:
                    score -= 0.15  # Hard to interact with on mobile

        return max(0.0, score)

    def _calculate_scroll_behavior(self, page: MockNotionPage, viewport_type: str) -> float:
        """Calculate scroll behavior score"""
        score = 1.0
        total_blocks = len(page.blocks)

        if viewport_type == 'mobile':
            # Mobile users expect shorter pages
            if total_blocks > 12:
                score -= 0.2
            elif total_blocks > 15:
                score -= 0.3

            # Check for horizontal scroll risks
            tables = page.get_blocks_by_type('table')
            for table in tables:
                headers = table.get('content', {}).get('headers', [])
                if len(headers) > 3:
                    score -= 0.2  # Horizontal scroll risk

            # Check for wide content
            code_blocks = page.get_blocks_by_type('code')
            for code_block in code_blocks:
                content = code_block.get('content', '')
                lines = content.split('\n')
                long_lines = sum(1 for line in lines if len(line) > 40)
                if long_lines > 0:
                    score -= 0.1

        elif viewport_type == 'tablet':
            # Tablet has moderate tolerance
            if total_blocks > 20:
                score -= 0.1

        # Desktop can handle longer content
        return max(0.0, score)

    def _calculate_performance_impact(self, page: MockNotionPage, viewport_type: str) -> float:
        """Calculate performance impact for viewport"""
        score = 1.0

        # Mobile has stricter performance requirements
        if viewport_type == 'mobile':
            total_blocks = len(page.blocks)

            # Block count impact
            if total_blocks > 15:
                score -= 0.3
            elif total_blocks > 12:
                score -= 0.2

            # Complex elements impact
            tables = page.get_blocks_by_type('table')
            complex_tables = sum(1 for t in tables
                               if len(t.get('content', {}).get('headers', [])) > 3)
            score -= complex_tables * 0.1

            # Toggle complexity
            toggles = page.get_blocks_by_type('toggle')
            complex_toggles = sum(1 for t in toggles
                                if len(t.get('children', [])) > 3)
            score -= complex_toggles * 0.05

        return max(0.0, score)

    def _analyze_breakpoints(self, page: MockNotionPage) -> Dict[str, Any]:
        """Analyze breakpoint behavior"""
        return {
            'mobile_320px': self._check_breakpoint(page, 320),
            'mobile_375px': self._check_breakpoint(page, 375),
            'tablet_768px': self._check_breakpoint(page, 768),
            'desktop_1024px': self._check_breakpoint(page, 1024),
            'critical_breakpoints': self._identify_critical_breakpoints(page)
        }

    def _check_breakpoint(self, page: MockNotionPage, width: int) -> Dict[str, Any]:
        """Check specific breakpoint issues"""
        issues = []

        # Check table behavior at breakpoint
        tables = page.get_blocks_by_type('table')
        for i, table in enumerate(tables):
            headers = table.get('content', {}).get('headers', [])
            estimated_width = len(headers) * 120  # Rough estimate

            if estimated_width > width:
                issues.append(f"Table {i+1} may overflow at {width}px")

        # Check heading wrapping
        headings = (page.get_blocks_by_type('heading_1') +
                   page.get_blocks_by_type('heading_2') +
                   page.get_blocks_by_type('heading_3'))

        for i, heading in enumerate(headings):
            content = heading.get('content', '')
            estimated_width = len(content) * 12  # Rough character width

            if estimated_width > width:
                issues.append(f"Heading {i+1} may wrap awkwardly at {width}px")

        return {
            'width': width,
            'issues': issues,
            'overflow_risk': len(issues) > 0
        }

    def _identify_critical_breakpoints(self, page: MockNotionPage) -> List[int]:
        """Identify critical breakpoints where layout changes significantly"""
        critical_points = []

        # Check where tables become problematic
        tables = page.get_blocks_by_type('table')
        max_table_width = 0

        for table in tables:
            headers = table.get('content', {}).get('headers', [])
            table_width = len(headers) * 120
            max_table_width = max(max_table_width, table_width)

        if max_table_width > 375:  # Standard mobile width
            critical_points.append(375)
        if max_table_width > 768:  # Tablet width
            critical_points.append(768)

        return sorted(set(critical_points))

    def _calculate_responsive_score(self, mobile: ViewportMetrics,
                                  tablet: ViewportMetrics,
                                  desktop: ViewportMetrics) -> float:
        """Calculate overall responsive score"""
        # Weight mobile performance heavily
        mobile_weight = 0.5
        tablet_weight = 0.3
        desktop_weight = 0.2

        mobile_avg = (mobile.readability_score + mobile.usability_score +
                     mobile.visual_hierarchy_score + mobile.content_accessibility +
                     mobile.interaction_efficiency) / 5

        tablet_avg = (tablet.readability_score + tablet.usability_score +
                     tablet.visual_hierarchy_score + tablet.content_accessibility +
                     tablet.interaction_efficiency) / 5

        desktop_avg = (desktop.readability_score + desktop.usability_score +
                      desktop.visual_hierarchy_score + desktop.content_accessibility +
                      desktop.interaction_efficiency) / 5

        return (mobile_avg * mobile_weight +
                tablet_avg * tablet_weight +
                desktop_avg * desktop_weight)

    def _identify_critical_issues(self, page: MockNotionPage,
                                mobile: ViewportMetrics,
                                tablet: ViewportMetrics,
                                desktop: ViewportMetrics) -> List[str]:
        """Identify critical responsive issues"""
        issues = []

        # Mobile-specific issues
        if mobile.readability_score < 0.6:
            issues.append("Poor mobile readability - check heading and paragraph lengths")

        if mobile.usability_score < 0.6:
            issues.append("Mobile usability issues - check touch targets and spacing")

        if mobile.interaction_efficiency < 0.6:
            issues.append("Mobile interaction problems - simplify tables and toggles")

        # Table-specific issues
        tables = page.get_blocks_by_type('table')
        for i, table in enumerate(tables):
            headers = table.get('content', {}).get('headers', [])
            if len(headers) > 4:
                issues.append(f"Table {i+1} has too many columns for mobile ({len(headers)} columns)")

        # Heading length issues
        headings = (page.get_blocks_by_type('heading_1') +
                   page.get_blocks_by_type('heading_2') +
                   page.get_blocks_by_type('heading_3'))

        for i, heading in enumerate(headings):
            content = heading.get('content', '')
            if len(content) > 40:
                issues.append(f"Heading {i+1} too long for mobile ({len(content)} characters)")

        # Performance issues
        if mobile.performance_impact < 0.6:
            issues.append("Mobile performance concerns - reduce page complexity")

        return issues

    def _generate_recommendations(self, issues: List[str],
                                mobile: ViewportMetrics,
                                desktop: ViewportMetrics) -> List[str]:
        """Generate specific recommendations"""
        recommendations = []

        # Address specific issues
        if any("table" in issue.lower() for issue in issues):
            recommendations.append("Redesign tables to use maximum 3 columns for mobile")
            recommendations.append("Consider using callout blocks instead of wide tables")

        if any("heading" in issue.lower() for issue in issues):
            recommendations.append("Shorten headings to under 40 characters")
            recommendations.append("Use descriptive but concise heading text")

        if mobile.readability_score < 0.7:
            recommendations.append("Break up long paragraphs into shorter chunks")
            recommendations.append("Add more visual breaks with dividers or callouts")

        if mobile.visual_hierarchy_score < 0.7:
            recommendations.append("Add functional emojis to 70%+ of headings")
            recommendations.append("Increase heading frequency for better mobile scanning")

        if mobile.interaction_efficiency < 0.7:
            recommendations.append("Simplify toggle content for mobile users")
            recommendations.append("Ensure adequate spacing between interactive elements")

        # Performance recommendations
        if mobile.performance_impact < 0.7:
            recommendations.append("Reduce total block count to under 12 for optimal mobile performance")
            recommendations.append("Consider breaking long pages into multiple sections")

        # General mobile-first recommendations
        if mobile.usability_score < desktop.usability_score - 0.2:
            recommendations.append("Adopt mobile-first design approach")
            recommendations.append("Test all changes on actual mobile devices")

        return recommendations

    def generate_comparison_report(self, analysis: ResponsiveAnalysis) -> str:
        """Generate detailed comparison report"""
        report = f"""
# Mobile vs Desktop Comparison Report: {analysis.page_title}

## Executive Summary
**Overall Responsive Score**: {analysis.responsive_score:.1%}

### Device Performance Summary
| Device | Readability | Usability | Visual Hierarchy | Accessibility | Interaction |
|--------|-------------|-----------|------------------|---------------|-------------|
| Mobile | {analysis.mobile_metrics.readability_score:.1%} | {analysis.mobile_metrics.usability_score:.1%} | {analysis.mobile_metrics.visual_hierarchy_score:.1%} | {analysis.mobile_metrics.content_accessibility:.1%} | {analysis.mobile_metrics.interaction_efficiency:.1%} |
| Tablet | {analysis.tablet_metrics.readability_score:.1%} | {analysis.tablet_metrics.usability_score:.1%} | {analysis.tablet_metrics.visual_hierarchy_score:.1%} | {analysis.tablet_metrics.content_accessibility:.1%} | {analysis.tablet_metrics.interaction_efficiency:.1%} |
| Desktop | {analysis.desktop_metrics.readability_score:.1%} | {analysis.desktop_metrics.usability_score:.1%} | {analysis.desktop_metrics.visual_hierarchy_score:.1%} | {analysis.desktop_metrics.content_accessibility:.1%} | {analysis.desktop_metrics.interaction_efficiency:.1%} |

## Critical Issues
"""

        for issue in analysis.critical_issues:
            report += f"- ❌ {issue}\n"

        report += "\n## Recommendations\n"
        for rec in analysis.recommendations:
            report += f"- 🔧 {rec}\n"

        report += f"""
## Breakpoint Analysis
"""

        for breakpoint, data in analysis.breakpoint_analysis.items():
            if isinstance(data, dict) and 'issues' in data:
                if data['issues']:
                    report += f"\n### {breakpoint}\n"
                    for issue in data['issues']:
                        report += f"- ⚠️ {issue}\n"

        return report

    def export_metrics(self, analysis: ResponsiveAnalysis) -> Dict[str, Any]:
        """Export metrics for further analysis"""
        return {
            'summary': {
                'page_title': analysis.page_title,
                'responsive_score': analysis.responsive_score,
                'critical_issues_count': len(analysis.critical_issues),
                'recommendations_count': len(analysis.recommendations)
            },
            'mobile_metrics': asdict(analysis.mobile_metrics),
            'tablet_metrics': asdict(analysis.tablet_metrics),
            'desktop_metrics': asdict(analysis.desktop_metrics),
            'breakpoint_analysis': analysis.breakpoint_analysis,
            'issues': analysis.critical_issues,
            'recommendations': analysis.recommendations
        }