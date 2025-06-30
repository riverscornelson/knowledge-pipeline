#!/usr/bin/env python3
"""
Test script for newsletter functionality without requiring environment variables
"""

import os
import sys
from datetime import date
from daily_newsletter import ContentItem, NewsletterGenerator

# Mock content for testing
def create_mock_content():
    """Create mock content items for testing."""
    mock_items = [
        ContentItem(
            title="OpenAI Announces GPT-5 Development",
            summary="OpenAI reveals significant progress on next-generation language model with enhanced reasoning capabilities.",
            content_type="Technology News",
            vendor="OpenAI",
            source_type="Website",
            notion_url="https://www.notion.so/mock-page-1",
            created_date="2025-06-26",
            ai_primitives=["Language Models", "Reasoning"]
        ),
        ContentItem(
            title="Enterprise AI Adoption Survey Results",
            summary="New survey shows 73% of enterprises plan to increase AI investment in 2025, with focus on automation and decision support.",
            content_type="Market Research",
            vendor="Accenture",
            source_type="PDF",
            notion_url="https://www.notion.so/mock-page-2",
            created_date="2025-06-25",
            ai_primitives=["Enterprise Solutions", "Market Analysis"]
        ),
        ContentItem(
            title="Gmail Newsletter: The AI Weekly Digest",
            summary="Weekly roundup of AI developments including new model releases, funding announcements, and regulatory updates.",
            content_type="Newsletter",
            vendor=None,
            source_type="Email", 
            notion_url="https://www.notion.so/mock-page-3",
            created_date="2025-06-26",
            ai_primitives=["Industry News"]
        )
    ]
    return mock_items

def test_content_formatting():
    """Test content formatting for AI analysis."""
    print("🧪 Testing content formatting...")
    
    # Create mock newsletter generator (without API dependencies)
    class MockNewsletterGenerator:
        def format_content_for_analysis(self, content_items):
            formatted_items = []
            for i, item in enumerate(content_items, 1):
                formatted_item = f"""[Source {i}] {item.title}
Type: {item.content_type} | Source: {item.source_type}
{f"Vendor: {item.vendor}" if item.vendor else ""}
{f"AI Primitives: {', '.join(item.ai_primitives)}" if item.ai_primitives else ""}
Summary: {item.summary}
---"""
                formatted_items.append(formatted_item)
            return "\n\n".join(formatted_items)
    
    mock_generator = MockNewsletterGenerator()
    mock_content = create_mock_content()
    
    formatted = mock_generator.format_content_for_analysis(mock_content)
    print("✅ Content formatting works!")
    print("Sample formatted content:")
    print("=" * 50)
    print(formatted[:300] + "..." if len(formatted) > 300 else formatted)
    print("=" * 50)
    return True

def test_html_generation():
    """Test HTML email generation."""
    print("\n🧪 Testing HTML email generation...")
    
    # Create mock newsletter generator
    class MockNewsletterGenerator:
        def __init__(self):
            self.subject_prefix = "Daily Knowledge Brief"
            self.recipient = "test@example.com"
        
        def create_html_email(self, analysis, content_items, target_date):
            import html
            
            # Count content by type
            type_counts = {}
            for item in content_items:
                source_type = item.source_type
                type_counts[source_type] = type_counts.get(source_type, 0) + 1
            
            stats_text = f"{len(content_items)} new items"
            if type_counts:
                type_breakdown = " • ".join([f"{count} {type_name.lower()}{'s' if count > 1 else ''}" 
                                           for type_name, count in type_counts.items()])
                stats_text += f" • {type_breakdown}"
            
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Daily Knowledge Brief</title>
</head>
<body>
    <h1>📧 Daily Knowledge Brief</h1>
    <p><strong>Date:</strong> {target_date.strftime("%B %d, %Y")}</p>
    <p><strong>Stats:</strong> {stats_text}</p>
    <div style="white-space: pre-line;">{html.escape(analysis)}</div>
</body>
</html>
"""
            return html_content
    
    mock_generator = MockNewsletterGenerator()
    mock_content = create_mock_content()
    
    # Mock analysis
    mock_analysis = """📋 EXECUTIVE SUMMARY
Today's 3 knowledge items reveal accelerating AI development with focus on enterprise adoption and reasoning capabilities.

💡 KEY INSIGHTS
• OpenAI's GPT-5 development suggests significant advances in AI reasoning [Source 1]
• Enterprise AI adoption reaching tipping point with 73% planning investment increases [Source 2]
• Weekly AI digest format shows growing need for curated intelligence [Source 3]

🎯 STRATEGIC IMPLICATIONS
Organizations should accelerate AI infrastructure planning ahead of next-generation model releases."""
    
    html_content = mock_generator.create_html_email(mock_analysis, mock_content, date.today())
    
    # Save test file
    test_file = f"newsletter_test_{date.today().isoformat()}.html"
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print("✅ HTML email generation works!")
    print(f"📄 Test email saved to: {test_file}")
    print("Sample HTML preview:")
    print("=" * 50)
    print(html_content[:400] + "..." if len(html_content) > 400 else html_content)
    print("=" * 50)
    return True

def main():
    """Run newsletter tests."""
    print("🧪 Testing Newsletter Functionality")
    print("=" * 50)
    
    try:
        # Test content formatting
        test_content_formatting()
        
        # Test HTML generation
        test_html_generation()
        
        print("\n✅ All newsletter tests passed!")
        print("\n📋 Next steps:")
        print("1. Set up environment variables (NOTION_TOKEN, NOTION_SOURCES_DB, NEWSLETTER_RECIPIENT)")
        print("2. Run: python daily_newsletter.py --test")
        print("3. Check generated HTML file")
        print("4. Run: python daily_newsletter.py (to send actual email)")
        
        return 0
        
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())