#!/usr/bin/env python3
"""
Daily Newsletter Generation Script

Generates and sends daily knowledge newsletters by:
1. Aggregating today's enriched content from Notion
2. Creating cross-analysis summary using GPT-4.1
3. Sending formatted HTML email via Gmail API
"""

import os
import json
import html
import time
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import base64

from notion_client import Client
from openai import OpenAI
from dotenv import load_dotenv

# Import existing utilities
from logger import setup_logger, track_performance
from api_resilience import with_notion_resilience
from gmail_auth import GmailAuthenticator

# Load environment variables
load_dotenv()

@dataclass
class ContentItem:
    """Represents a piece of content from Notion for newsletter inclusion."""
    title: str
    summary: str
    content_type: str
    vendor: Optional[str]
    source_type: str
    notion_url: str
    created_date: Optional[str]
    ai_primitives: List[str]

class NewsletterGenerator:
    """Handles daily newsletter generation and delivery."""
    
    def __init__(self):
        self.notion = Client(auth=os.environ.get("NOTION_TOKEN"))
        self.openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        self.sources_db_id = os.environ.get("NOTION_SOURCES_DB")
        self.newsletter_model = os.environ.get("MODEL_NEWSLETTER", "gpt-4.1")
        self.recipient = os.environ.get("NEWSLETTER_RECIPIENT")
        self.subject_prefix = os.environ.get("NEWSLETTER_SUBJECT_PREFIX", "Executive Intelligence Brief")
        
        # Gmail configuration
        self.gmail_credentials_path = os.environ.get("GMAIL_CREDENTIALS_PATH", "gmail_credentials/credentials.json")
        self.gmail_token_path = os.environ.get("GMAIL_TOKEN_PATH", "gmail_credentials/token.json")
        self.gmail_auth = None
        
        # Setup logging
        self.logger = setup_logger("daily_newsletter")
        
        if not all([self.sources_db_id, self.recipient]):
            raise ValueError("Missing required environment variables: NOTION_SOURCES_DB, NEWSLETTER_RECIPIENT")
    
    @with_notion_resilience(retries=3)
    def get_daily_content(self, target_date: date = None) -> List[ContentItem]:
        """
        Query Notion for content enriched on the target date.
        
        Args:
            target_date: Date to query for (defaults to today)
            
        Returns:
            List of ContentItem objects
        """
        if target_date is None:
            target_date = date.today()
            
        # Query for enriched content (simplified for initial testing)
        query = {
            "filter": {
                "property": "Status",
                "select": {
                    "equals": "Enriched"
                }
            },
            "sorts": [
                {
                    "timestamp": "last_edited_time",
                    "direction": "descending"
                }
            ],
            "page_size": 10  # Limit to recent items for testing
        }
        
        self.logger.info(f"Querying Notion for content enriched on {target_date}")
        
        try:
            response = self.notion.databases.query(
                database_id=self.sources_db_id,
                **query
            )
            
            content_items = []
            for page in response["results"]:
                # Extract properties
                props = page["properties"]
                
                # Get title
                title_prop = props.get("Title", {})
                title = ""
                if title_prop.get("title"):
                    title = "".join([t["plain_text"] for t in title_prop["title"]])
                
                # Get summary
                summary_prop = props.get("Summary", {})
                summary = summary_prop.get("rich_text", [{}])[0].get("plain_text", "")
                
                # Get content type
                content_type_prop = props.get("Content-Type", {})
                content_type = content_type_prop.get("select", {}).get("name", "Unknown")
                
                # Get vendor
                vendor_prop = props.get("Vendor", {})
                vendor = vendor_prop.get("select", {}).get("name") if vendor_prop.get("select") else None
                
                # Get source type
                source_type_prop = props.get("Source Type", {})
                source_type = source_type_prop.get("select", {}).get("name", "Unknown")
                
                # Get AI primitives
                ai_primitives_prop = props.get("AI-Primitive", {})
                ai_primitives = []
                if ai_primitives_prop.get("multi_select"):
                    ai_primitives = [item["name"] for item in ai_primitives_prop["multi_select"]]
                
                # Get created date
                created_date_prop = props.get("Created Date", {})
                created_date = created_date_prop.get("date", {}).get("start") if created_date_prop.get("date") else None
                
                # Generate Notion URL
                page_id = page["id"].replace("-", "")
                notion_url = f"https://www.notion.so/{page_id}"
                
                content_item = ContentItem(
                    title=title,
                    summary=summary,
                    content_type=content_type,
                    vendor=vendor,
                    source_type=source_type,
                    notion_url=notion_url,
                    created_date=created_date,
                    ai_primitives=ai_primitives
                )
                
                content_items.append(content_item)
            
            self.logger.info(f"Retrieved {len(content_items)} content items for {target_date}")
            return content_items
            
        except Exception as e:
            self.logger.error(f"Error querying Notion: {str(e)}")
            raise
    
    def format_content_for_analysis(self, content_items: List[ContentItem]) -> str:
        """Format content items for AI analysis."""
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
    
    def generate_cross_analysis(self, content_items: List[ContentItem]) -> str:
        """Generate cross-analysis summary using GPT-4.1."""
        if not content_items:
            return ""
        
        formatted_content = self.format_content_for_analysis(content_items)
        
        prompt = f"""You are a seasoned market research expert with 20+ years analyzing tech industry dynamics, AI/ML developments, and strategic business shifts. Your clients are C-suite executives who need sharp, opinionated analysis to make million-dollar decisions.

Analyze these {len(content_items)} intelligence sources and write an authoritative daily brief:

INTELLIGENCE SOURCES:
{formatted_content}

Write as an expert analyst with strong opinions and market intuition. Structure your analysis as:

## 🎯 MARKET REALITY CHECK
(2-3 sentences with your expert take on what's REALLY happening beneath the surface. Be direct and opinionated.)

## 📈 STRATEGIC PATTERN ANALYSIS  
(Identify 2-3 critical trends with your expert interpretation. What do patterns tell us that others miss? Be assertive about implications.)

## 💡 PROFESSIONAL ASSESSMENT
(Your seasoned judgment on the most significant developments. Call out what matters vs. what's noise. Include predictions based on your experience.)

## ⚠️ MARKET TENSIONS & CONTRADICTIONS
(Point out conflicts, inconsistencies, or concerning signals. What should executives be worried about? Only include if meaningful tensions exist.)

## 🎯 EXECUTIVE RECOMMENDATIONS
(Specific, actionable guidance for decision-makers. What should they do THIS WEEK? Be prescriptive and confident.)

TONE & STYLE:
- Write with the authority of someone who's seen multiple tech cycles
- Use phrases like "In my experience..." "What we're seeing here is..." "The reality is..."
- Be opinionated but substantiated - back claims with source evidence
- Call out hype vs. substance
- Include specific timeframes and urgency levels
- Make predictions and assessments based on pattern recognition
- Sound like you're briefing the CEO personally

CITATIONS: Include [Source X] for all claims but integrate them naturally into confident statements.

Remember: Your readers pay premium rates for your expertise. Give them insights they can't get from reading headlines themselves."""

        try:
            # Try OpenAI Responses API first (preferred)
            try:
                response = self.openai_client.chat.completions.create(
                    model=self.newsletter_model,
                    messages=[
                        {"role": "system", "content": "You are an expert analyst creating strategic intelligence briefings from diverse content sources."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_tokens=2000
                )
                analysis = response.choices[0].message.content.strip()
                self.logger.info(f"Generated cross-analysis using {self.newsletter_model}")
                return analysis
                
            except Exception as e:
                self.logger.warning(f"Responses API failed, falling back: {str(e)}")
                # Fallback to regular completion if needed
                response = self.openai_client.chat.completions.create(
                    model=self.newsletter_model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=2000
                )
                return response.choices[0].message.content.strip()
                
        except Exception as e:
            self.logger.error(f"Error generating cross-analysis: {str(e)}")
            raise
    
    def convert_citations_to_links(self, analysis: str, content_items: List[ContentItem]) -> str:
        """Convert [Source X] citations to clickable HTML links."""
        import re
        
        # Create mapping of source numbers to URLs and titles
        source_map = {}
        for i, item in enumerate(content_items, 1):
            source_map[i] = {
                'url': item.notion_url,
                'title': item.title[:50] + "..." if len(item.title) > 50 else item.title
            }
        
        # Replace [Source X] patterns with clickable links
        def replace_citation(match):
            source_num = int(match.group(1))
            if source_num in source_map:
                url = source_map[source_num]['url']
                title = source_map[source_num]['title']
                return f'<a href="{url}" class="citation" title="{html.escape(title)}" target="_blank">[Source {source_num}]</a>'
            else:
                return match.group(0)  # Return original if not found
        
        # Use regex to find and replace [Source X] patterns
        citation_pattern = r'\[Source (\d+)\]'
        result = re.sub(citation_pattern, replace_citation, analysis)
        
        return result
    
    def _generate_sources_list(self, content_items: List[ContentItem]) -> str:
        """Generate HTML list of all sources with clickable links."""
        sources_html = []
        
        for i, item in enumerate(content_items, 1):
            source_icon = {
                'PDF': '📄',
                'Website': '🌐', 
                'Email': '📧',
                'Unknown': '📝'
            }.get(item.source_type, '📝')
            
            vendor_info = f" • {item.vendor}" if item.vendor else ""
            
            source_html = f"""
                <div class="source-item">
                    {source_icon} <a href="{item.notion_url}" class="citation" target="_blank">
                        <strong>[Source {i}]</strong> {html.escape(item.title)}
                    </a>
                    <span class="source-meta">{item.content_type}{vendor_info}</span>
                </div>
            """
            sources_html.append(source_html)
        
        return "".join(sources_html)

    def create_html_email(self, analysis: str, content_items: List[ContentItem], target_date: date) -> str:
        """Create HTML email content for the newsletter."""
        
        # Convert citations to clickable links
        analysis_with_links = self.convert_citations_to_links(analysis, content_items)
        
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Knowledge Brief</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }}
        .container {{
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .header {{
            border-bottom: 3px solid #007acc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0;
            color: #007acc;
            font-size: 24px;
        }}
        .date {{
            color: #666;
            font-size: 14px;
            margin: 5px 0;
        }}
        .stats {{
            background-color: #f0f8ff;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #007acc;
        }}
        .analysis {{
            white-space: pre-line;
            margin: 20px 0;
        }}
        .analysis h2 {{
            color: #007acc;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }}
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #666;
            text-align: center;
        }}
        .citation {{
            color: #007acc;
            text-decoration: none;
            font-weight: 500;
        }}
        .citation:hover {{
            text-decoration: underline;
        }}
        .sources-section {{
            margin-top: 30px;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #dee2e6;
        }}
        .sources-section h3 {{
            margin: 0 0 15px 0;
            color: #007acc;
            font-size: 16px;
        }}
        .source-item {{
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
        }}
        .source-item:last-child {{
            border-bottom: none;
        }}
        .source-meta {{
            display: block;
            font-size: 12px;
            color: #666;
            margin-top: 3px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Executive Intelligence Brief</h1>
            <div class="date">{target_date.strftime("%B %d, %Y")} • Market Research Analysis</div>
        </div>
        
        <div class="stats">
            📊 <strong>Pipeline Stats:</strong> {stats_text}
        </div>
        
        <div class="analysis">{analysis_with_links}</div>
        
        <div class="sources-section">
            <h3>📚 Source References</h3>
            <div class="sources-list">
                {self._generate_sources_list(content_items)}
            </div>
        </div>
        
        <div class="footer">
            🔗 <a href="https://notion.so" class="citation">View source intelligence in Notion</a><br>
            Strategic Analysis by Knowledge Pipeline • {datetime.now().strftime("%Y-%m-%d %H:%M")}
        </div>
    </div>
</body>
</html>
"""
        return html_content
    
    def generate_newsletter(self, target_date: date = None) -> Optional[str]:
        """
        Generate complete newsletter for the target date.
        
        Args:
            target_date: Date to generate newsletter for (defaults to today)
            
        Returns:
            HTML email content or None if no content available
        """
        if target_date is None:
            target_date = date.today()
        
        start_time = time.time()
        self.logger.info("Starting newsletter generation")
        
        try:
            # Get daily content
            content_items = self.get_daily_content(target_date)
            
            if not content_items:
                self.logger.info(f"No content found for {target_date}, skipping newsletter")
                return None
            
            # Generate cross-analysis
            analysis = self.generate_cross_analysis(content_items)
            
            # Create HTML email
            html_content = self.create_html_email(analysis, content_items, target_date)
            
            duration = time.time() - start_time
            self.logger.info(f"Newsletter generated successfully for {target_date} in {duration:.2f}s")
            return html_content
            
        except Exception as e:
            duration = time.time() - start_time
            self.logger.error(f"Newsletter generation failed after {duration:.2f}s: {str(e)}")
            raise
    
    def send_newsletter(self, html_content: str, target_date: date = None) -> bool:
        """
        Send newsletter email via Gmail API.
        
        Args:
            html_content: HTML email content
            target_date: Date for subject line (defaults to today)
            
        Returns:
            True if sent successfully, False otherwise
        """
        if target_date is None:
            target_date = date.today()
        
        subject = f"{self.subject_prefix} - {target_date.strftime('%B %d, %Y')}"
        
        try:
            # Initialize Gmail authenticator if needed
            if not self.gmail_auth:
                self.gmail_auth = GmailAuthenticator(
                    credentials_path=self.gmail_credentials_path,
                    token_path=self.gmail_token_path
                )
            
            # Send email
            message_id = self.gmail_auth.send_email(
                to_email=self.recipient,
                subject=subject,
                html_content=html_content
            )
            
            if message_id:
                self.logger.info(f"Newsletter sent successfully: {subject}")
                self.logger.info(f"Recipient: {self.recipient}")
                self.logger.info(f"Message ID: {message_id}")
                return True
            else:
                self.logger.error(f"Failed to send newsletter: {subject}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error sending newsletter: {str(e)}")
            print(f"❌ Error sending newsletter: {str(e)}")
            return False


def main():
    """Main entry point for newsletter generation."""
    import sys
    
    # Check for test mode
    test_mode = "--test" in sys.argv or "--dry-run" in sys.argv
    if test_mode:
        print("🧪 Running in test mode - no emails will be sent")
    
    try:
        newsletter = NewsletterGenerator()
        
        # Generate newsletter for today
        html_content = newsletter.generate_newsletter()
        
        if html_content:
            if test_mode:
                # Test mode: just show what would be sent
                print("📧 Newsletter preview:")
                print("=" * 50)
                print(f"Subject: {newsletter.subject_prefix} - {date.today().strftime('%B %d, %Y')}")
                print(f"Recipient: {newsletter.recipient}")
                print(f"Content length: {len(html_content)} characters")
                print("=" * 50)
                
                # Save to file for inspection
                test_file = f"newsletter_test_{date.today().isoformat()}.html"
                with open(test_file, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                print(f"📄 Full newsletter saved to: {test_file}")
                print("✅ Newsletter test completed successfully!")
            else:
                # Send newsletter
                success = newsletter.send_newsletter(html_content)
                if success:
                    print("✅ Newsletter generated and sent successfully!")
                else:
                    print("❌ Newsletter generation completed but sending failed")
        else:
            print("ℹ️  No content available for today's newsletter")
            
    except Exception as e:
        print(f"❌ Error generating newsletter: {str(e)}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())