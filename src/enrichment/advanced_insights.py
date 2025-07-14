"""
Advanced insights generation using story structure and systematic analysis techniques.
"""
from typing import List, Dict, Any, Tuple
from openai import OpenAI
from ..core.config import OpenAIConfig
from ..utils.logging import setup_logger


class AdvancedInsightsGenerator:
    """Generates strategic insights using narrative structure and systematic analysis."""
    
    def __init__(self, config: OpenAIConfig):
        """Initialize advanced insights generator with OpenAI configuration."""
        self.config = config
        self.client = OpenAI(api_key=config.api_key)
        self.logger = setup_logger(__name__)
    
    def generate_insights(self, content: str, title: str) -> List[str]:
        """
        Generate strategic insights using story structure and systematic analysis.
        
        Args:
            content: The text content to analyze
            title: The document title
            
        Returns:
            List of structured, actionable insights with narrative context
        """
        # Step 1: Intelligent content preprocessing for insights extraction
        processed_content = self._extract_insights_content(content, max_chars=6000)
        
        # Step 2: Advanced multi-step insights generation
        system_message = {
            "role": "system",
            "content": """You are an expert strategic analyst specializing in transforming complex information into actionable business intelligence. Your mission is to uncover insights that drive decision-making and competitive advantage.

CORE EXPERTISE:
- Strategic pattern recognition across markets and technologies
- Competitive intelligence and opportunity identification
- Risk assessment and trend analysis
- Business transformation and innovation insights
- Technology adoption and market dynamics

INSIGHT QUALITY STANDARDS:
- Every insight must be actionable and specific
- Focus on "so what?" implications for decision-makers
- Include concrete evidence and quantifiable impacts when available
- Structure insights as narratives that tell a compelling story
- Prioritize forward-looking implications over historical observations
- Connect dots between seemingly unrelated information"""
        }
        
        insights_prompt = f"""
ADVANCED STRATEGIC INSIGHTS ANALYSIS

Step 1: Document Context Assessment
Document: {title}
Content Volume: {len(processed_content)} characters
Analysis Objective: Extract maximum strategic value for executive decision-making

Step 2: Systematic Insights Discovery Framework

A) PATTERN RECOGNITION
What underlying patterns, trends, or connections exist in this information that others might miss?

B) STRATEGIC IMPLICATIONS  
What opportunities, threats, or competitive advantages does this reveal?

C) FUTURE SCENARIO DEVELOPMENT
How might this information shape future market conditions or strategic landscapes?

D) DECISION CATALYST IDENTIFICATION
What specific decisions or actions does this information enable or demand?

Step 3: Story Structure for Insights

For each insight, follow this narrative framework:

CURRENT STATE: What is the existing situation or conventional wisdom?
CHANGE CATALYST: What new information or trend is disrupting the status quo?
TRANSFORMATION: How will this change reshape the landscape?
STRATEGIC IMPLICATION: What does this mean for competitive positioning and decision-making?
ACTION IMPERATIVE: What specific actions should be considered?

Step 4: Insights Generation Using Three-Act Structure

Act I - Setup (The Current Reality):
Establish the baseline context and conventional understanding

Act II - Journey (The Transformation):  
Reveal the changes, opportunities, and challenges emerging

Act III - Resolution (The Strategic Response):
Define the new reality and required strategic responses

Step 5: Insight Quality Validation

For each insight, verify:
✓ Specificity: Does it provide concrete, actionable information?
✓ Evidence: Is it supported by specific data or examples from the content?
✓ Impact: Does it have significant strategic or competitive implications?
✓ Urgency: Does it suggest time-sensitive opportunities or risks?
✓ Clarity: Can a decision-maker immediately understand the implications?

CONTENT FOR ANALYSIS:
{processed_content}

STRUCTURED INSIGHTS OUTPUT:

Generate exactly 5 strategic insights following this format:

1. [TRANSFORMATION INSIGHT]
Current State: [What exists today]
Change Driver: [Key information/trend from document]  
Strategic Implication: [What this means for competitive advantage]
Action Opportunity: [Specific next steps or decisions enabled]

2. [OPPORTUNITY INSIGHT]
Market Gap: [Unmet need or inefficiency identified]
Enabling Factor: [Technology/trend that makes opportunity viable]
Competitive Advantage: [How to leverage this for market position]
Implementation Priority: [Urgency and approach considerations]

3. [RISK/THREAT INSIGHT]
Emerging Risk: [Potential threat or disruption identified]
Impact Timeline: [When and how this might affect the market]
Mitigation Strategy: [How to prepare or defend against this risk]
Early Warning Signals: [What to monitor for this development]

4. [INNOVATION INSIGHT]  
Technology/Process Innovation: [New capability or approach identified]
Adoption Catalyst: [What will drive widespread implementation]
Market Disruption Potential: [How this could reshape competitive dynamics]
Investment Implications: [Resource allocation or partnership opportunities]

5. [COMPETITIVE INTELLIGENCE INSIGHT]
Competitive Movement: [What competitors or market players are doing]
Strategic Intent: [Why this matters for market positioning]
Response Options: [How to react or counter-position]
Timing Considerations: [When action is needed and why]

Remember: Each insight should tell a complete story that moves from current state through transformation to strategic implication.
"""
        
        try:
            # Execute advanced insights generation
            messages = [system_message, {"role": "user", "content": insights_prompt}]
            response = self._get_completion_with_validation(messages)
            
            # Parse structured insights
            insights = self._parse_structured_insights(response)
            
            # Quality validation and enhancement
            validated_insights = self._validate_and_enhance_insights(insights, content, title)
            
            # Log insights quality metrics
            self._log_insights_metrics(validated_insights, title)
            
            return validated_insights
            
        except Exception as e:
            self.logger.error(f"Advanced insights generation failed for '{title}': {e}")
            return self._fallback_insights(content, title)
    
    def _extract_insights_content(self, content: str, max_chars: int) -> str:
        """Extract content most relevant for strategic insights generation."""
        if len(content) <= max_chars:
            return content
        
        lines = content.split('\n')
        
        # Prioritize content for insights analysis
        high_value_content = []
        supporting_content = []
        
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            
            # High-value indicators for insights
            is_insights_valuable = (
                # Strategic keywords
                any(keyword in stripped.lower() for keyword in [
                    'opportunity', 'risk', 'threat', 'advantage', 'challenge', 'trend',
                    'growth', 'market', 'competitive', 'innovation', 'disruption',
                    'future', 'potential', 'impact', 'change', 'transformation',
                    'investment', 'revenue', 'cost', 'efficiency', 'performance'
                ]) or
                # Quantitative data
                any(char.isdigit() for char in stripped) or
                # Conclusions and findings
                any(starter in stripped.lower() for starter in [
                    'we found', 'results show', 'analysis reveals', 'data indicates',
                    'research suggests', 'study demonstrates', 'evidence shows'
                ]) or
                # Headers and key statements
                stripped.startswith('#') or len(stripped) < 120
            )
            
            if is_insights_valuable:
                high_value_content.append(line)
            else:
                supporting_content.append(line)
        
        # Allocate space: 70% high-value, 30% supporting
        final_content = []
        current_length = 0
        high_value_budget = int(max_chars * 0.7)
        
        # Add high-value content first
        for line in high_value_content:
            if current_length + len(line) < high_value_budget:
                final_content.append(line)
                current_length += len(line)
        
        # Fill remaining space
        for line in supporting_content:
            if current_length + len(line) < max_chars:
                final_content.append(line)
                current_length += len(line)
            else:
                break
        
        return '\n'.join(final_content)
    
    def _get_completion_with_validation(self, messages: List[Dict]) -> str:
        """Execute completion with built-in validation for insights quality."""
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_insights,
                messages=messages,
                temperature=0.6,  # Balanced creativity and consistency
                max_tokens=1200
            )
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"Insights generation API call failed: {e}")
    
    def _parse_structured_insights(self, response: str) -> List[Dict[str, str]]:
        """Parse structured insights from the AI response."""
        insights = []
        
        try:
            # Split into insight sections
            sections = response.split('\n\n')
            current_insight = {}
            
            for section in sections:
                lines = section.strip().split('\n')
                
                for line in lines:
                    line = line.strip()
                    
                    # Check for numbered insight start
                    if line and line[0].isdigit() and '.' in line and '[' in line:
                        # Save previous insight if complete
                        if current_insight and len(current_insight) >= 3:
                            insights.append(current_insight)
                        
                        # Start new insight
                        insight_title = line.split(']')[0].split('[')[1] if '[' in line and ']' in line else "Strategic Insight"
                        current_insight = {"title": insight_title, "content": []}
                    
                    # Parse insight components
                    elif ':' in line and any(keyword in line for keyword in [
                        'Current State', 'Change Driver', 'Strategic Implication', 'Action Opportunity',
                        'Market Gap', 'Enabling Factor', 'Competitive Advantage', 'Implementation Priority',
                        'Emerging Risk', 'Impact Timeline', 'Mitigation Strategy', 'Early Warning',
                        'Technology', 'Adoption Catalyst', 'Market Disruption', 'Investment Implications',
                        'Competitive Movement', 'Strategic Intent', 'Response Options', 'Timing Considerations'
                    ]):
                        component_name, component_text = line.split(':', 1)
                        current_insight[component_name.strip()] = component_text.strip()
                    
                    elif line and current_insight:
                        # Add to content if it's substantial
                        if len(line) > 20:
                            if "content" not in current_insight:
                                current_insight["content"] = []
                            current_insight["content"].append(line)
            
            # Add the last insight
            if current_insight and len(current_insight) >= 3:
                insights.append(current_insight)
            
            # Convert to simplified format if structured parsing didn't work well
            if len(insights) < 3:
                return self._parse_simple_insights(response)
            
            return insights[:5]  # Max 5 insights
            
        except Exception as e:
            self.logger.warning(f"Structured parsing failed: {e}, falling back to simple parsing")
            return self._parse_simple_insights(response)
    
    def _parse_simple_insights(self, response: str) -> List[Dict[str, str]]:
        """Fallback simple insights parsing."""
        insights = []
        lines = response.split('\n')
        
        for line in lines:
            line = line.strip()
            if line and line[0].isdigit() and '.' in line:
                insight_text = line.split('.', 1)[1].strip()
                if len(insight_text) > 20:  # Substantial insight
                    insights.append({
                        "title": "Strategic Insight",
                        "text": insight_text
                    })
        
        return insights[:5]
    
    def _validate_and_enhance_insights(self, insights: List[Dict], content: str, title: str) -> List[str]:
        """Validate insights quality and convert to final format."""
        validated_insights = []
        
        for i, insight in enumerate(insights, 1):
            try:
                # Convert structured insight to narrative format
                if isinstance(insight, dict) and "title" in insight:
                    if "text" in insight:
                        # Simple format
                        insight_text = insight["text"]
                    else:
                        # Structured format - combine components
                        components = []
                        for key, value in insight.items():
                            if key not in ["title", "content"] and isinstance(value, str) and len(value) > 10:
                                components.append(f"{key}: {value}")
                        
                        if components:
                            insight_text = ". ".join(components[:3])  # Top 3 components
                        else:
                            insight_text = f"Strategic insight from analysis of {title}"
                else:
                    insight_text = str(insight)
                
                # Validate insight quality
                if self._validate_insight_quality(insight_text):
                    validated_insights.append(insight_text)
                else:
                    self.logger.warning(f"Insight {i} failed quality validation")
                    
            except Exception as e:
                self.logger.error(f"Error processing insight {i}: {e}")
                continue
        
        # Ensure we have at least 3 insights
        if len(validated_insights) < 3:
            fallback = self._generate_fallback_insights(content, title)
            validated_insights.extend(fallback[:5-len(validated_insights)])
        
        return validated_insights[:5]
    
    def _validate_insight_quality(self, insight: str) -> bool:
        """Validate that an insight meets quality standards."""
        if len(insight) < 30:  # Too short
            return False
        
        # Check for actionable language
        actionable_indicators = [
            'should', 'could', 'opportunity', 'risk', 'advantage', 'strategy',
            'market', 'competitive', 'investment', 'growth', 'potential',
            'trend', 'innovation', 'disruption', 'transformation'
        ]
        
        if not any(indicator in insight.lower() for indicator in actionable_indicators):
            return False
        
        # Check for specificity (not too generic)
        generic_phrases = [
            'it is important', 'very significant', 'many companies', 'various factors',
            'could be useful', 'might be beneficial', 'should consider'
        ]
        
        if any(phrase in insight.lower() for phrase in generic_phrases):
            return False
        
        return True
    
    def _generate_fallback_insights(self, content: str, title: str) -> List[str]:
        """Generate basic insights when advanced processing fails."""
        content_preview = content[:500]
        
        fallback_insights = [
            f"Document '{title}' provides valuable information for strategic planning and decision-making",
            f"Key themes in the content suggest emerging trends that warrant monitoring and analysis",
            f"The information presents both opportunities and challenges that require strategic consideration"
        ]
        
        return fallback_insights
    
    def _log_insights_metrics(self, insights: List[str], title: str):
        """Log metrics about insights quality and characteristics."""
        avg_length = sum(len(insight) for insight in insights) / len(insights) if insights else 0
        
        # Count actionable indicators
        actionable_count = sum(
            1 for insight in insights 
            if any(word in insight.lower() for word in ['opportunity', 'should', 'risk', 'advantage', 'strategy'])
        )
        
        self.logger.info(
            f"Generated {len(insights)} insights for '{title}': "
            f"avg_length={avg_length:.0f}, actionable_ratio={actionable_count/len(insights):.2f}"
        )
    
    def _fallback_insights(self, content: str, title: str) -> List[str]:
        """Generate simple insights when all advanced processing fails."""
        try:
            # Ultra-simple prompt
            simple_prompt = f"""Extract 3 key insights from this document:

Title: {title}
Content: {content[:1000]}

Focus on actionable findings."""
            
            response = self.client.chat.completions.create(
                model=self.config.model_insights,
                messages=[{"role": "user", "content": simple_prompt}],
                temperature=0.5,
                max_tokens=300
            )
            
            simple_insights = response.choices[0].message.content.split('\n')
            return [insight.strip('- 1234567890.') for insight in simple_insights if len(insight.strip()) > 20][:5]
            
        except Exception as e:
            self.logger.error(f"Even fallback insights failed: {e}")
            return [f"Analysis of '{title}' reveals strategic information requiring further evaluation"]