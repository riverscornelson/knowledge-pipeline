"""
Content summarization using OpenAI.
"""
from typing import Optional
from openai import OpenAI
from ..core.config import OpenAIConfig
from ..utils.logging import setup_logger


class ContentSummarizer:
    """Generates comprehensive summaries of content."""
    
    def __init__(self, config: OpenAIConfig):
        """Initialize summarizer with OpenAI configuration."""
        self.config = config
        self.client = OpenAI(api_key=config.api_key)
        self.logger = setup_logger(__name__)
        
    def generate_summary(self, content: str, title: str) -> str:
        """
        Generate a comprehensive summary of the content.
        
        Args:
            content: The full text content
            title: The document title
            
        Returns:
            Markdown-formatted summary
        """
        # Truncate content to fit API limits
        truncated_content = content[:8000]
        
        prompt = f"""
        Analyze this document and provide a comprehensive but concise summary.
        
        Document Title: {title}
        Content: {truncated_content}
        
        Provide:
        1. A detailed summary (150-200 words) covering key points and findings
        2. An executive summary (3-4 key takeaways as bullet points)
        
        Format as markdown with clear sections:
        
        ## Summary
        [Your detailed summary here]
        
        ## Key Takeaways
        - [Takeaway 1]
        - [Takeaway 2]
        - [Takeaway 3]
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_summary,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1000
            )
            
            summary = response.choices[0].message.content
            self.logger.info(f"Generated summary for: {title}")
            return summary
            
        except Exception as e:
            self.logger.error(f"Failed to generate summary: {e}")
            return f"## Summary\nFailed to generate summary due to an error.\n\n## Key Takeaways\n- Error occurred during processing"
    
    def generate_brief_summary(self, full_summary: str) -> str:
        """
        Extract a brief summary (under 200 chars) from the full summary.
        
        Args:
            full_summary: The full markdown summary
            
        Returns:
            Brief text summary for database property
        """
        try:
            # Extract first sentence after "## Summary"
            lines = full_summary.split('\n')
            in_summary = False
            
            for line in lines:
                if line.strip() == "## Summary":
                    in_summary = True
                    continue
                
                if in_summary and line.strip():
                    # Get first sentence
                    sentence = line.split('.')[0] + '.'
                    if len(sentence) <= 200:
                        return sentence
                    else:
                        return sentence[:197] + "..."
            
            # Fallback: just take first 200 chars
            clean_text = ' '.join(full_summary.split())
            return clean_text[:197] + "..." if len(clean_text) > 200 else clean_text
            
        except Exception as e:
            self.logger.error(f"Failed to extract brief summary: {e}")
            return "Summary extraction failed"