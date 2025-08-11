"""
Enhanced insights generator with full advanced capabilities, prompt configuration and web search support.
"""
from typing import Optional, List, Dict, Any
from core.config import PipelineConfig
from core.prompt_config import PromptConfig
from .base_analyzer import BaseAnalyzer
from utils.logging import setup_logger


class EnhancedInsightsGenerator(BaseAnalyzer):
    """Enhanced insights generator with full advanced analysis capabilities and configuration support."""
    
    @property
    def analyzer_name(self) -> str:
        """Override to match the config file which uses 'insights'."""
        return "insights"
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        """Initialize enhanced insights generator.
        
        Args:
            config: Pipeline configuration
            prompt_config: Optional prompt configuration
        """
        super().__init__(config, prompt_config)
        self.logger = setup_logger(__name__)
    
    def generate_insights(self, content: str, title: str, content_type: Optional[str] = None) -> List[str]:
        """Generate insights with optional web search and content-type awareness.
        
        Args:
            content: The content to analyze
            title: Document title
            content_type: Optional content type for specialized prompts
            
        Returns:
            List of insight strings
        """
        # Use the new analyze method
        result = self.analyze(content, title, content_type)
        
        if result.get("success"):
            # Parse insights from the analysis
            insights_text = result["analysis"]
            
            # Check if we got structured insights and parse accordingly
            if "TRANSFORMATION INSIGHT" in insights_text or "### Immediate Actions" in insights_text:
                return self._parse_structured_insights(insights_text)
            else:
                # Simple parsing - split by newlines and filter
                insights = [
                    line.strip().lstrip("•-*123456789. ")
                    for line in insights_text.split("\n")
                    if line.strip() and not line.strip().startswith("#") and len(line.strip()) > 20
                ]
                return insights[:5]  # Return top 5 insights
        else:
            # Generate fallback insights
            return self._fallback_insights(content, title)
    
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build the user prompt for insights generation."""
        # Intelligent content preprocessing for insights
        preprocessing_config = config.get('preprocessing', {})
        max_chars = preprocessing_config.get('max_chars', 50000)
        processed_content = self._extract_insights_content(content, max_chars)
        
        # Use methodology from config
        methodology = config.get('methodology', 'story_structure')
        
        if methodology == 'story_structure':
            return self._build_story_structure_prompt(processed_content, title, config)
        else:
            return self._build_standard_insights_prompt(processed_content, title, config)
    
    def _build_story_structure_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build advanced story structure insights prompt."""
        insight_types = config.get('insight_types', 5)
        
        prompt = f"""
ADVANCED STRATEGIC INSIGHTS ANALYSIS

Step 1: Document Context Assessment
Document: {title}
Content Volume: {len(content)} characters
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
{content}

STRUCTURED INSIGHTS OUTPUT:

Generate exactly {insight_types} strategic insights following this format:

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
        return prompt
    
    def _build_standard_insights_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build standard structured insights prompt."""
        prompt = f"""
# Strategic Insights Analysis

**Document**: {title}

**Content**:
{content}

---

Generate strategic insights organized into the following sections. Use proper markdown headers (###) for each section:

### Immediate Actions
What should be done right now? List 2-3 concrete, actionable steps.

### Strategic Opportunities  
What long-term advantages are revealed? List 2-3 strategic opportunities.

### Risk Factors
What threats or challenges are identified? List 2-3 key risks.

### Market Implications
How does this affect the competitive landscape? List 2-3 market impacts.

### Innovation Potential
What new possibilities does this enable? List 2-3 innovation opportunities.

For each section, provide bullet points that are:
- Specific and concrete (not vague)
- Action-oriented (starts with a verb)
- Strategic (not just a summary of facts)
- Relevant to business/technical decision-making
- Maximum 2 sentences per point
"""
        return prompt
    
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
    
    def _parse_structured_insights(self, response: str) -> List[str]:
        """Parse structured insights from the AI response."""
        insights = []
        
        try:
            # First try to parse story structure format
            if "TRANSFORMATION INSIGHT" in response or "OPPORTUNITY INSIGHT" in response:
                insights = self._parse_story_structure_insights(response)
            elif "### Immediate Actions" in response or "### Strategic Opportunities" in response:
                insights = self._parse_markdown_section_insights(response)
            else:
                # Fallback to simple parsing
                insights = self._parse_simple_insights(response)
            
            # Validate and enhance insights
            validated_insights = self._validate_and_enhance_insights(insights)
            
            return validated_insights[:5]  # Max 5 insights
            
        except Exception as e:
            self.logger.warning(f"Structured parsing failed: {e}, falling back to simple parsing")
            return self._parse_simple_insights(response)
    
    def _parse_story_structure_insights(self, response: str) -> List[str]:
        """Parse story structure format insights."""
        insights = []
        
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
                        insights.append(self._format_story_insight(current_insight))
                    
                    # Start new insight
                    insight_title = line.split(']')[0].split('[')[1] if '[' in line and ']' in line else "Strategic Insight"
                    current_insight = {"title": insight_title, "components": {}}
                
                # Parse insight components
                elif ':' in line and any(keyword in line for keyword in [
                    'Current State', 'Change Driver', 'Strategic Implication', 'Action Opportunity',
                    'Market Gap', 'Enabling Factor', 'Competitive Advantage', 'Implementation Priority',
                    'Emerging Risk', 'Impact Timeline', 'Mitigation Strategy', 'Early Warning',
                    'Technology', 'Adoption Catalyst', 'Market Disruption', 'Investment Implications',
                    'Competitive Movement', 'Strategic Intent', 'Response Options', 'Timing Considerations'
                ]):
                    component_name, component_text = line.split(':', 1)
                    current_insight["components"][component_name.strip()] = component_text.strip()
        
        # Add the last insight
        if current_insight and len(current_insight.get("components", {})) >= 2:
            insights.append(self._format_story_insight(current_insight))
        
        return insights
    
    def _parse_markdown_section_insights(self, response: str) -> List[str]:
        """Parse markdown section format insights."""
        insights = []
        current_section = None
        
        lines = response.split('\n')
        for line in lines:
            line = line.strip()
            
            # Check for section headers
            if line.startswith('### '):
                current_section = line.replace('### ', '')
                continue
            
            # Extract bullet points
            if line and (line.startswith('•') or line.startswith('-') or line.startswith('*')):
                bullet_text = line.lstrip('•-* ').strip()
                if len(bullet_text) > 20 and current_section:
                    insights.append(f"{current_section}: {bullet_text}")
        
        return insights
    
    def _parse_simple_insights(self, response: str) -> List[str]:
        """Fallback simple insights parsing."""
        insights = []
        lines = response.split('\n')
        
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() and '.' in line):
                insight_text = line.split('.', 1)[1].strip()
                if len(insight_text) > 20:  # Substantial insight
                    insights.append(insight_text)
            elif line and (line.startswith('•') or line.startswith('-') or line.startswith('*')):
                insight_text = line.lstrip('•-* ').strip()
                if len(insight_text) > 20:
                    insights.append(insight_text)
        
        return insights[:5]
    
    def _format_story_insight(self, insight_dict: Dict) -> str:
        """Format a story structure insight into readable text."""
        title = insight_dict.get("title", "Strategic Insight")
        components = insight_dict.get("components", {})
        
        # Select top 2-3 most important components
        key_components = []
        for key, value in components.items():
            if key in ["Strategic Implication", "Action Opportunity", "Competitive Advantage", "Implementation Priority"]:
                key_components.append(f"{key}: {value}")
        
        # If no key components, use any available
        if not key_components:
            key_components = [f"{k}: {v}" for k, v in list(components.items())[:2]]
        
        if key_components:
            return f"{title} - {'. '.join(key_components[:2])}"
        else:
            return f"{title} insight from document analysis"
    
    def _validate_and_enhance_insights(self, insights: List[str]) -> List[str]:
        """Validate insights quality and convert to final format."""
        validated_insights = []
        
        for i, insight in enumerate(insights, 1):
            try:
                # Validate insight quality
                if self._validate_insight_quality(insight):
                    validated_insights.append(insight)
                else:
                    self.logger.warning(f"Insight {i} failed quality validation: {insight[:50]}...")
                    
            except Exception as e:
                self.logger.error(f"Error processing insight {i}: {e}")
                continue
        
        # Ensure we have at least 3 insights
        if len(validated_insights) < 3:
            fallback = self._generate_fallback_insights()
            validated_insights.extend(fallback[:5-len(validated_insights)])
        
        return validated_insights
    
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
    
    def _generate_fallback_insights(self) -> List[str]:
        """Generate basic insights when advanced processing fails."""
        fallback_insights = [
            "Document provides valuable information for strategic planning and decision-making",
            "Key themes suggest emerging trends that warrant monitoring and analysis",
            "Information presents both opportunities and challenges requiring strategic consideration"
        ]
        
        return fallback_insights
    
    def _fallback_insights(self, content: str, title: str) -> List[str]:
        """Generate simple insights when all advanced processing fails."""
        try:
            # Ultra-simple prompt
            simple_prompt = f"""Extract 3 key insights from this document:

Title: {title}
Content: {content[:1000]}

Focus on actionable findings."""
            
            completion = self.client.chat.completions.create(
                model=self.config.openai.model_insights,
                messages=[{"role": "user", "content": simple_prompt}],
                temperature=0.5,
                max_tokens=300
            )
            
            simple_insights = completion.choices[0].message.content.split('\n')
            insights = [insight.strip('- 1234567890.') for insight in simple_insights if len(insight.strip()) > 20]
            return insights[:5]
            
        except Exception as e:
            self.logger.error(f"Even fallback insights failed: {e}")
            return [f"Analysis of '{title}' reveals strategic information requiring further evaluation"]
    
    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for insights generation."""
        return """You are a strategic analyst identifying actionable insights and opportunities.

Your expertise includes:
- Business strategy and competitive analysis
- Technology trends and implications
- Risk assessment and mitigation
- Innovation and growth opportunities

Focus on insights that drive decision-making and action, not just observations."""
    
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """Get fallback result when analysis fails."""
        return {
            "analysis": "• Unable to generate insights due to processing error\n• Manual review recommended",
            "success": False,
            "web_search_used": False
        }