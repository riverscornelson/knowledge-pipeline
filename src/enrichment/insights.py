"""
Key insights generation using OpenAI.
"""
from typing import List
from openai import OpenAI
from ..core.config import OpenAIConfig
from ..utils.logging import setup_logger


class InsightsGenerator:
    """Generates actionable insights from content."""
    
    def __init__(self, config: OpenAIConfig):
        """Initialize insights generator with OpenAI configuration."""
        self.config = config
        self.client = OpenAI(api_key=config.api_key)
        self.logger = setup_logger(__name__)
        
    def generate_insights(self, content: str, title: str) -> List[str]:
        """
        Generate key actionable insights from content.
        
        Args:
            content: The text content to analyze
            title: The document title
            
        Returns:
            List of key insights
        """
        # Truncate content for analysis
        truncated_content = content[:6000]
        
        prompt = f"""
        Analyze this document for strategic insights and actionable intelligence.
        
        Document Title: {title}
        Content: {truncated_content}
        
        Provide the 5 most important insights from this document.
        
        Requirements for each insight:
        - Must be specific and actionable
        - Focus on practical value and implications
        - Highlight opportunities, risks, or important trends
        - Be concise (1-2 sentences each)
        - Avoid generic observations
        
        Format your response as a numbered list:
        1. [First insight]
        2. [Second insight]
        3. [Third insight]
        4. [Fourth insight]
        5. [Fifth insight]
        
        Focus on insights that would be valuable for decision-making, strategy, or understanding market/technology trends.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_insights,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=800
            )
            
            insights_text = response.choices[0].message.content
            
            # Parse insights from numbered list
            insights = self._parse_insights(insights_text)
            
            self.logger.info(f"Generated {len(insights)} insights for: {title}")
            return insights
            
        except Exception as e:
            self.logger.error(f"Failed to generate insights: {e}")
            return ["Failed to generate insights due to an error"]
    
    def _parse_insights(self, insights_text: str) -> List[str]:
        """Parse insights from numbered list format."""
        insights = []
        lines = insights_text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            # Look for numbered items (1., 2., etc.)
            if line and line[0].isdigit() and '.' in line:
                # Extract the insight text after the number
                insight = line.split('.', 1)[1].strip()
                if insight:
                    insights.append(insight)
        
        # Fallback if parsing fails
        if not insights:
            self.logger.warning("Failed to parse numbered insights, using full text")
            insights = [insights_text]
        
        return insights[:5]  # Ensure max 5 insights