"""
Mock Notion Page Generator
Creates realistic Notion page mockups for testing and validation.
"""

import json
import random
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from .notion_aesthetic_validator import MockNotionPage


class NotionPageTemplates:
    """Collection of Notion page templates for different use cases"""

    # Functional emojis organized by category
    NAVIGATION_EMOJIS = ["📋", "🎯", "📊", "📈", "📉", "📝", "📁", "📄", "🔍", "⚙️"]
    STATUS_EMOJIS = ["✅", "⏳", "🔄", "❌", "⚠️", "🟢", "🟡", "🔴", "🔵", "⭐"]
    CONTENT_EMOJIS = ["💡", "📱", "💻", "🌐", "🔧", "🛠️", "🎨", "📚", "🔬", "🚀"]
    CALLOUT_EMOJIS = ["💡", "⚠️", "ℹ️", "✅", "❌", "🔥", "💰", "📊", "🎯", "🚨"]

    # Sample content for different industries
    TECH_CONTENT = {
        "project_names": ["API Integration", "Mobile App", "Dashboard", "Analytics Platform", "User Portal"],
        "features": ["Authentication", "Real-time sync", "Data visualization", "Mobile responsiveness", "API endpoints"],
        "technologies": ["React", "Node.js", "Python", "PostgreSQL", "Redis", "Docker", "AWS", "TypeScript"]
    }

    BUSINESS_CONTENT = {
        "project_names": ["Market Analysis", "Sales Strategy", "Customer Journey", "Revenue Planning", "Team Goals"],
        "objectives": ["Increase conversion", "Improve retention", "Expand market", "Optimize costs", "Enhance experience"],
        "metrics": ["Revenue", "Conversion Rate", "Customer Satisfaction", "Market Share", "ROI"]
    }

    DESIGN_CONTENT = {
        "project_names": ["Brand Guidelines", "UI System", "User Research", "Design Sprint", "Prototype Review"],
        "elements": ["Color palette", "Typography", "Components", "Layouts", "Interactions"],
        "tools": ["Figma", "Sketch", "Adobe XD", "Principle", "InVision"]
    }


class MockNotionPageGenerator:
    """Generate realistic mock Notion pages for testing"""

    def __init__(self):
        self.templates = NotionPageTemplates()

    def generate_ideal_page(self, template_type: str = "tech") -> MockNotionPage:
        """Generate an ideally formatted page"""
        if template_type == "tech":
            return self._generate_tech_project_page()
        elif template_type == "business":
            return self._generate_business_strategy_page()
        elif template_type == "design":
            return self._generate_design_system_page()
        else:
            return self._generate_general_documentation_page()

    def generate_problematic_page(self) -> MockNotionPage:
        """Generate a page with common formatting problems"""
        blocks = [
            {
                "type": "heading_1",
                "content": "This is an extremely long heading that will definitely wrap poorly on mobile devices and create a terrible user experience for anyone trying to read it",
                "styling": {"emoji": None, "hierarchy_level": 1}
            },
            {
                "type": "paragraph",
                "content": "This is a massive wall of text that goes on and on without any proper formatting breaks or consideration for readability especially on mobile devices where users expect content to be scannable and digestible but instead they get this overwhelming block of text that makes their eyes glaze over and defeats the entire purpose of having well-structured documentation in the first place because nobody wants to read through this kind of poorly formatted content that shows no respect for the reader's time or cognitive load.",
                "styling": {"line_height": 1.0, "paragraph_spacing": 0}
            },
            {
                "type": "table",
                "content": {
                    "headers": ["Column 1", "Column 2", "Column 3", "Column 4", "Column 5", "Column 6", "Column 7", "Column 8"],
                    "rows": [
                        ["Very long data entry that wraps", "Another long entry", "Data3", "Data4", "Data5", "Data6", "Data7", "Data8"],
                        ["More data", "Even more data here", "D3", "D4", "D5", "D6", "D7", "D8"],
                        ["Row 3", "Row 3 col 2", "R3C3", "R3C4", "R3C5", "R3C6", "R3C7", "R3C8"]
                    ]
                },
                "styling": {"column_count": 8, "mobile_optimized": False}
            },
            {
                "type": "heading_3",
                "content": "Another Section",
                "styling": {"emoji": None, "hierarchy_level": 3}
            },
            {
                "type": "callout",
                "content": "This is a warning without any icon or proper styling to make it stand out",
                "styling": {"icon": None, "background_color": "gray"}
            },
            {
                "type": "code",
                "content": "function veryLongFunctionNameThatWillDefinitelyWrapAwkwardlyOnMobileDevices(parameterWithVeryLongNameThatMakesNoSense, anotherParameterWithEvenLongerName) {\n  return 'This code will be impossible to read on mobile';\n}",
                "styling": {"language": None, "wrap": False}
            },
            {
                "type": "paragraph",
                "content": "More text.",
                "styling": {}
            },
            {
                "type": "paragraph",
                "content": "Even more text right after with no spacing.",
                "styling": {}
            }
        ]

        return MockNotionPage(
            title="Problematic Page Example",
            blocks=blocks,
            properties={
                "mobile_optimized": False,
                "emoji_functional": False,
                "accessibility_compliant": False,
                "aesthetic_score": 0.2
            }
        )

    def _generate_tech_project_page(self) -> MockNotionPage:
        """Generate a tech project documentation page"""
        project_name = random.choice(self.templates.TECH_CONTENT["project_names"])

        blocks = [
            {
                "type": "heading_1",
                "content": f"📋 {project_name}",
                "styling": {"emoji": "📋", "hierarchy_level": 1}
            },
            {
                "type": "paragraph",
                "content": f"Comprehensive documentation for the {project_name.lower()} project, including technical specifications, implementation details, and deployment guidelines.",
                "styling": {"line_height": 1.5, "paragraph_spacing": 16}
            },
            {
                "type": "callout",
                "content": "💡 This project uses modern web technologies and follows industry best practices for scalability and maintainability.",
                "styling": {"icon": "💡", "background_color": "blue_light"}
            },
            {
                "type": "heading_2",
                "content": "🎯 Project Objectives",
                "styling": {"emoji": "🎯", "hierarchy_level": 2}
            },
            {
                "type": "bulleted_list_item",
                "content": "Implement secure user authentication system",
                "styling": {"indent_level": 0, "bullet_style": "•"}
            },
            {
                "type": "bulleted_list_item",
                "content": "Create responsive dashboard interface",
                "styling": {"indent_level": 0, "bullet_style": "•"}
            },
            {
                "type": "bulleted_list_item",
                "content": "Ensure 99.9% uptime and reliability",
                "styling": {"indent_level": 0, "bullet_style": "•"}
            },
            {
                "type": "heading_2",
                "content": "📊 Technical Stack",
                "styling": {"emoji": "📊", "hierarchy_level": 2}
            },
            {
                "type": "table",
                "content": {
                    "headers": ["Component", "Technology", "Purpose"],
                    "rows": [
                        ["Frontend", "React + TypeScript", "User interface"],
                        ["Backend", "Node.js + Express", "API server"],
                        ["Database", "PostgreSQL", "Data storage"],
                        ["Cache", "Redis", "Performance"]
                    ]
                },
                "styling": {"column_count": 3, "mobile_optimized": True}
            },
            {
                "type": "toggle",
                "content": "🔧 Technical Implementation",
                "children": [
                    {
                        "type": "code",
                        "content": "// Authentication middleware\nconst authenticate = (req, res, next) => {\n  const token = req.headers.authorization;\n  if (!token) {\n    return res.status(401).json({ error: 'No token' });\n  }\n  next();\n};",
                        "styling": {"language": "javascript", "wrap": True}
                    },
                    {
                        "type": "paragraph",
                        "content": "The authentication system uses JWT tokens with refresh token rotation for enhanced security."
                    }
                ],
                "styling": {"icon": "🔧", "default_open": False}
            },
            {
                "type": "divider",
                "content": "",
                "styling": {"margin": 24}
            },
            {
                "type": "heading_2",
                "content": "📱 Mobile Considerations",
                "styling": {"emoji": "📱", "hierarchy_level": 2}
            },
            {
                "type": "paragraph",
                "content": "All interfaces are designed mobile-first with responsive breakpoints and touch-friendly interactions.",
                "styling": {"mobile_optimized": True}
            }
        ]

        return MockNotionPage(
            title=f"{project_name} Documentation",
            blocks=blocks,
            properties={
                "mobile_optimized": True,
                "emoji_functional": True,
                "accessibility_compliant": True,
                "project_type": "technology",
                "aesthetic_score": 0.9
            }
        )

    def _generate_business_strategy_page(self) -> MockNotionPage:
        """Generate a business strategy page"""
        blocks = [
            {
                "type": "heading_1",
                "content": "📈 Q4 Growth Strategy",
                "styling": {"emoji": "📈", "hierarchy_level": 1}
            },
            {
                "type": "paragraph",
                "content": "Strategic plan for Q4 growth initiatives focusing on market expansion and customer acquisition.",
                "styling": {"line_height": 1.5, "paragraph_spacing": 16}
            },
            {
                "type": "callout",
                "content": "🎯 Target: 25% revenue growth and 15% new customer acquisition by end of Q4",
                "styling": {"icon": "🎯", "background_color": "green_light"}
            },
            {
                "type": "heading_2",
                "content": "💰 Revenue Targets",
                "styling": {"emoji": "💰", "hierarchy_level": 2}
            },
            {
                "type": "table",
                "content": {
                    "headers": ["Metric", "Current", "Target"],
                    "rows": [
                        ["Monthly Revenue", "$100K", "$125K"],
                        ["New Customers", "50/month", "58/month"],
                        ["Conversion Rate", "3.2%", "4.0%"]
                    ]
                },
                "styling": {"column_count": 3, "mobile_optimized": True}
            },
            {
                "type": "heading_2",
                "content": "🚀 Key Initiatives",
                "styling": {"emoji": "🚀", "hierarchy_level": 2}
            },
            {
                "type": "numbered_list_item",
                "content": "Launch enterprise sales program",
                "styling": {"indent_level": 0}
            },
            {
                "type": "numbered_list_item",
                "content": "Expand digital marketing channels",
                "styling": {"indent_level": 0}
            },
            {
                "type": "numbered_list_item",
                "content": "Improve customer onboarding experience",
                "styling": {"indent_level": 0}
            }
        ]

        return MockNotionPage(
            title="Q4 Growth Strategy",
            blocks=blocks,
            properties={
                "mobile_optimized": True,
                "emoji_functional": True,
                "accessibility_compliant": True,
                "project_type": "business"
            }
        )

    def _generate_design_system_page(self) -> MockNotionPage:
        """Generate a design system documentation page"""
        blocks = [
            {
                "type": "heading_1",
                "content": "🎨 Design System v2.0",
                "styling": {"emoji": "🎨", "hierarchy_level": 1}
            },
            {
                "type": "paragraph",
                "content": "Comprehensive design system including colors, typography, components, and usage guidelines.",
                "styling": {"line_height": 1.5, "paragraph_spacing": 16}
            },
            {
                "type": "heading_2",
                "content": "🌈 Color Palette",
                "styling": {"emoji": "🌈", "hierarchy_level": 2}
            },
            {
                "type": "table",
                "content": {
                    "headers": ["Color", "Hex", "Usage"],
                    "rows": [
                        ["Primary Blue", "#0066CC", "Main actions"],
                        ["Success Green", "#00AA44", "Success states"],
                        ["Warning Orange", "#FF8800", "Warnings"],
                        ["Error Red", "#CC0000", "Error states"]
                    ]
                },
                "styling": {"column_count": 3, "mobile_optimized": True}
            },
            {
                "type": "toggle",
                "content": "📝 Typography Scale",
                "children": [
                    {
                        "type": "bulleted_list_item",
                        "content": "H1: 32px, bold, line-height 1.2"
                    },
                    {
                        "type": "bulleted_list_item",
                        "content": "H2: 24px, bold, line-height 1.3"
                    },
                    {
                        "type": "bulleted_list_item",
                        "content": "Body: 16px, regular, line-height 1.5"
                    }
                ],
                "styling": {"icon": "📝", "default_open": False}
            }
        ]

        return MockNotionPage(
            title="Design System Documentation",
            blocks=blocks,
            properties={
                "mobile_optimized": True,
                "emoji_functional": True,
                "accessibility_compliant": True,
                "project_type": "design"
            }
        )

    def _generate_general_documentation_page(self) -> MockNotionPage:
        """Generate a general documentation page"""
        blocks = [
            {
                "type": "heading_1",
                "content": "📚 User Guide",
                "styling": {"emoji": "📚", "hierarchy_level": 1}
            },
            {
                "type": "paragraph",
                "content": "Complete guide for using our platform effectively and efficiently.",
                "styling": {"line_height": 1.5, "paragraph_spacing": 16}
            },
            {
                "type": "callout",
                "content": "ℹ️ This guide covers all essential features and common workflows",
                "styling": {"icon": "ℹ️", "background_color": "blue_light"}
            },
            {
                "type": "heading_2",
                "content": "🚀 Getting Started",
                "styling": {"emoji": "🚀", "hierarchy_level": 2}
            },
            {
                "type": "numbered_list_item",
                "content": "Create your account and verify email",
                "styling": {"indent_level": 0}
            },
            {
                "type": "numbered_list_item",
                "content": "Complete your profile setup",
                "styling": {"indent_level": 0}
            },
            {
                "type": "numbered_list_item",
                "content": "Explore the dashboard features",
                "styling": {"indent_level": 0}
            },
            {
                "type": "heading_2",
                "content": "⚙️ Configuration",
                "styling": {"emoji": "⚙️", "hierarchy_level": 2}
            },
            {
                "type": "toggle",
                "content": "🔧 Advanced Settings",
                "children": [
                    {
                        "type": "paragraph",
                        "content": "Advanced configuration options for power users."
                    }
                ],
                "styling": {"icon": "🔧", "default_open": False}
            }
        ]

        return MockNotionPage(
            title="User Guide",
            blocks=blocks,
            properties={
                "mobile_optimized": True,
                "emoji_functional": True,
                "accessibility_compliant": True,
                "project_type": "documentation"
            }
        )

    def generate_page_with_links(self) -> MockNotionPage:
        """Generate a page with various link types for testing"""
        blocks = [
            {
                "type": "heading_1",
                "content": "📁 Project Resources",
                "styling": {"emoji": "📁", "hierarchy_level": 1}
            },
            {
                "type": "paragraph",
                "content": "Centralized access to all project documents and resources.",
                "styling": {"line_height": 1.5, "paragraph_spacing": 16}
            },
            {
                "type": "heading_2",
                "content": "📄 Key Documents",
                "styling": {"emoji": "📄", "hierarchy_level": 2}
            },
            {
                "type": "callout",
                "content": "📄 [Project Requirements](https://drive.google.com/drive/folders/abc123) - Main requirements document",
                "styling": {"icon": "📄", "background_color": "blue_light", "links": [{"type": "drive", "prominent": True}]}
            },
            {
                "type": "bulleted_list_item",
                "content": "📊 [Data Analysis Spreadsheet](https://drive.google.com/spreadsheets/abc456)",
                "styling": {"links": [{"type": "drive", "prominent": True}]}
            },
            {
                "type": "bulleted_list_item",
                "content": "🎨 [Design Mockups](https://drive.google.com/drive/folders/design789)",
                "styling": {"links": [{"type": "drive", "prominent": True}]}
            },
            {
                "type": "heading_2",
                "content": "🌐 External Resources",
                "styling": {"emoji": "🌐", "hierarchy_level": 2}
            },
            {
                "type": "bulleted_list_item",
                "content": "API Documentation: [External API Docs](https://api.example.com/docs)",
                "styling": {"links": [{"type": "external", "prominent": False}]}
            },
            {
                "type": "bulleted_list_item",
                "content": "Framework Guide: [React Documentation](https://reactjs.org/docs)",
                "styling": {"links": [{"type": "external", "prominent": False}]}
            }
        ]

        return MockNotionPage(
            title="Project Resources Hub",
            blocks=blocks,
            properties={
                "has_drive_links": True,
                "mobile_optimized": True,
                "emoji_functional": True
            }
        )

    def generate_mobile_test_page(self) -> MockNotionPage:
        """Generate a page specifically for mobile testing"""
        blocks = [
            {
                "type": "heading_1",
                "content": "📱 Mobile Guide",
                "styling": {"emoji": "📱", "hierarchy_level": 1}
            },
            {
                "type": "paragraph",
                "content": "Optimized content for mobile viewing with proper formatting and readability.",
                "styling": {"line_height": 1.6, "paragraph_spacing": 20, "mobile_optimized": True}
            },
            {
                "type": "callout",
                "content": "💡 All content designed for mobile-first experience",
                "styling": {"icon": "💡", "background_color": "green_light"}
            },
            {
                "type": "heading_2",
                "content": "📋 Quick Actions",
                "styling": {"emoji": "📋", "hierarchy_level": 2}
            },
            {
                "type": "table",
                "content": {
                    "headers": ["Action", "Steps"],
                    "rows": [
                        ["Login", "Email + Password"],
                        ["Search", "Use search bar"],
                        ["Share", "Tap share button"]
                    ]
                },
                "styling": {"column_count": 2, "mobile_optimized": True}
            },
            {
                "type": "toggle",
                "content": "📖 Detailed Steps",
                "children": [
                    {
                        "type": "numbered_list_item",
                        "content": "Open the app"
                    },
                    {
                        "type": "numbered_list_item",
                        "content": "Navigate to settings"
                    },
                    {
                        "type": "numbered_list_item",
                        "content": "Configure preferences"
                    }
                ],
                "styling": {"icon": "📖", "default_open": False}
            }
        ]

        return MockNotionPage(
            title="Mobile User Guide",
            blocks=blocks,
            properties={
                "mobile_optimized": True,
                "emoji_functional": True,
                "accessibility_compliant": True,
                "target_device": "mobile"
            }
        )

    def generate_comprehensive_test_page(self) -> MockNotionPage:
        """Generate a page with all block types for comprehensive testing"""
        blocks = [
            # H1 with emoji
            {
                "type": "heading_1",
                "content": "🧪 Comprehensive Test Page",
                "styling": {"emoji": "🧪", "hierarchy_level": 1}
            },

            # Introduction paragraph
            {
                "type": "paragraph",
                "content": "This page contains all major Notion block types for comprehensive aesthetic testing.",
                "styling": {"line_height": 1.5, "paragraph_spacing": 16}
            },

            # Blue callout with info
            {
                "type": "callout",
                "content": "ℹ️ This page tests visual hierarchy, mobile responsiveness, and accessibility",
                "styling": {"icon": "ℹ️", "background_color": "blue_light"}
            },

            # H2 with navigation emoji
            {
                "type": "heading_2",
                "content": "📊 Data Overview",
                "styling": {"emoji": "📊", "hierarchy_level": 2}
            },

            # Mobile-optimized table
            {
                "type": "table",
                "content": {
                    "headers": ["Metric", "Value", "Status"],
                    "rows": [
                        ["Performance", "95%", "✅ Good"],
                        ["Mobile", "90%", "✅ Good"],
                        ["Accessibility", "88%", "⚠️ Review"]
                    ]
                },
                "styling": {"column_count": 3, "mobile_optimized": True}
            },

            # Bulleted list
            {
                "type": "bulleted_list_item",
                "content": "Visual hierarchy with proper emoji usage",
                "styling": {"indent_level": 0, "bullet_style": "•"}
            },
            {
                "type": "bulleted_list_item",
                "content": "Mobile-responsive table design",
                "styling": {"indent_level": 0, "bullet_style": "•"}
            },
            {
                "type": "bulleted_list_item",
                "content": "Accessibility compliance validation",
                "styling": {"indent_level": 0, "bullet_style": "•"}
            },

            # H3 subsection
            {
                "type": "heading_3",
                "content": "🔧 Technical Details",
                "styling": {"emoji": "🔧", "hierarchy_level": 3}
            },

            # Code block with proper formatting
            {
                "type": "code",
                "content": "// Sample validation code\nconst validatePage = (page) => {\n  return {\n    mobile: checkMobile(page),\n    accessibility: checkA11y(page)\n  };\n};",
                "styling": {"language": "javascript", "wrap": True}
            },

            # Visual break with divider
            {
                "type": "divider",
                "content": "",
                "styling": {"margin": 24}
            },

            # Toggle with nested content
            {
                "type": "toggle",
                "content": "🔍 Advanced Options",
                "children": [
                    {
                        "type": "paragraph",
                        "content": "Additional configuration options for power users."
                    },
                    {
                        "type": "numbered_list_item",
                        "content": "Enable debug mode"
                    },
                    {
                        "type": "numbered_list_item",
                        "content": "Configure custom metrics"
                    }
                ],
                "styling": {"icon": "🔍", "default_open": False}
            },

            # Warning callout
            {
                "type": "callout",
                "content": "⚠️ Remember to test on both mobile and desktop devices",
                "styling": {"icon": "⚠️", "background_color": "yellow_light"}
            }
        ]

        return MockNotionPage(
            title="Comprehensive Aesthetic Test Page",
            blocks=blocks,
            properties={
                "mobile_optimized": True,
                "emoji_functional": True,
                "accessibility_compliant": True,
                "test_type": "comprehensive",
                "block_count": len(blocks)
            }
        )

    def generate_page_variants(self, base_page: MockNotionPage, variant_type: str) -> MockNotionPage:
        """Generate variants of a page for comparative testing"""
        if variant_type == "no_emojis":
            return self._remove_emojis_variant(base_page)
        elif variant_type == "poor_mobile":
            return self._create_poor_mobile_variant(base_page)
        elif variant_type == "accessibility_issues":
            return self._create_accessibility_issues_variant(base_page)
        else:
            return base_page

    def _remove_emojis_variant(self, page: MockNotionPage) -> MockNotionPage:
        """Create variant without emojis"""
        import re
        emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'

        new_blocks = []
        for block in page.blocks:
            new_block = block.copy()
            content = new_block.get('content', '')
            if isinstance(content, str):
                new_block['content'] = re.sub(emoji_pattern + r'\s*', '', content)

            # Remove emoji styling
            if 'styling' in new_block:
                new_block['styling'] = {k: v for k, v in new_block['styling'].items()
                                      if k not in ['emoji', 'icon']}

            new_blocks.append(new_block)

        return MockNotionPage(
            title=page.title + " (No Emojis)",
            blocks=new_blocks,
            properties={**page.properties, "emoji_functional": False}
        )

    def _create_poor_mobile_variant(self, page: MockNotionPage) -> MockNotionPage:
        """Create variant with poor mobile optimization"""
        new_blocks = []
        for block in page.blocks:
            new_block = block.copy()

            # Make tables wider
            if block['type'] == 'table':
                content = new_block.get('content', {})
                headers = content.get('headers', [])
                if len(headers) <= 3:
                    # Add more columns
                    extra_headers = ["Extra Col 1", "Extra Col 2", "Extra Col 3"]
                    new_headers = headers + extra_headers[:5-len(headers)]
                    content['headers'] = new_headers

                    # Add data for new columns
                    rows = content.get('rows', [])
                    for row in rows:
                        while len(row) < len(new_headers):
                            row.append(f"Data {len(row)+1}")

                new_block['styling'] = {'column_count': len(new_headers), 'mobile_optimized': False}

            # Make headings longer
            elif block['type'].startswith('heading_'):
                content = new_block.get('content', '')
                if len(content) < 40:
                    new_block['content'] = content + " with Additional Text That Makes It Too Long for Mobile"

            new_blocks.append(new_block)

        return MockNotionPage(
            title=page.title + " (Poor Mobile)",
            blocks=new_blocks,
            properties={**page.properties, "mobile_optimized": False}
        )

    def _create_accessibility_issues_variant(self, page: MockNotionPage) -> MockNotionPage:
        """Create variant with accessibility issues"""
        new_blocks = []
        for block in page.blocks:
            new_block = block.copy()

            # Remove callout icons
            if block['type'] == 'callout':
                styling = new_block.get('styling', {})
                styling.pop('icon', None)
                new_block['styling'] = styling

                # Remove emoji from content
                content = new_block.get('content', '')
                import re
                emoji_pattern = r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF\U00002600-\U000027BF\U0001F900-\U0001F9FF]'
                new_block['content'] = re.sub(emoji_pattern + r'\s*', '', content)

            new_blocks.append(new_block)

        return MockNotionPage(
            title=page.title + " (A11y Issues)",
            blocks=new_blocks,
            properties={**page.properties, "accessibility_compliant": False}
        )

    def generate_test_suite_pages(self) -> Dict[str, MockNotionPage]:
        """Generate a complete suite of test pages"""
        return {
            "ideal_tech": self.generate_ideal_page("tech"),
            "ideal_business": self.generate_ideal_page("business"),
            "ideal_design": self.generate_ideal_page("design"),
            "problematic": self.generate_problematic_page(),
            "mobile_optimized": self.generate_mobile_test_page(),
            "comprehensive": self.generate_comprehensive_test_page(),
            "with_links": self.generate_page_with_links(),
            "no_emojis": self._remove_emojis_variant(self.generate_ideal_page("tech")),
            "poor_mobile": self._create_poor_mobile_variant(self.generate_ideal_page("tech")),
            "accessibility_issues": self._create_accessibility_issues_variant(self.generate_ideal_page("tech"))
        }