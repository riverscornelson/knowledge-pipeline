"""
Enhanced content summarizer with full advanced capabilities, prompt configuration and web search support.
"""
from typing import Optional, Dict, Any, List
from core.config import PipelineConfig
from core.prompt_config import PromptConfig
from .base_analyzer import BaseAnalyzer
from utils.logging import setup_logger


class EnhancedContentSummarizer(BaseAnalyzer):
    """Enhanced summarizer with full advanced analysis capabilities and configuration support."""
    
    @property
    def analyzer_name(self) -> str:
        """Override to match the config file which uses 'summarizer'."""
        return "summarizer"
    
    def __init__(self, config: PipelineConfig, prompt_config: Optional[PromptConfig] = None):
        """Initialize enhanced summarizer.
        
        Args:
            config: Pipeline configuration
            prompt_config: Optional prompt configuration
        """
        super().__init__(config, prompt_config)
        self.logger = setup_logger(__name__)
    
    def generate_summary(self, content: str, title: str, content_type: Optional[str] = None) -> str:
        """Generate summary with optional web search and content-type awareness.
        
        Args:
            content: The content to summarize
            title: Document title
            content_type: Optional content type for specialized prompts
            
        Returns:
            Summary text
        """
        # Use the new analyze method
        result = self.analyze(content, title, content_type)
        
        if result.get("success"):
            # Extract and format structured summary
            analysis = result["analysis"]
            return self._extract_structured_summary(analysis)
        else:
            # Generate fallback summary
            return self._fallback_summary(content, title)
    
    def generate_brief_summary(self, full_summary: str) -> str:
        """
        Extract executive brief (under 200 chars) optimized for database storage.
        
        Args:
            full_summary: The full structured summary
            
        Returns:
            Concise summary for Notion property field
        """
        try:
            # Look for executive summary section first
            lines = full_summary.split('\n')
            in_exec_summary = False
            
            for line in lines:
                if "executive summary" in line.lower() or "executive briefing" in line.lower():
                    in_exec_summary = True
                    continue
                elif in_exec_summary and line.strip().startswith('#'):
                    break  # Next section started
                elif in_exec_summary and line.strip() and not line.strip().startswith('['):
                    # Found executive summary content
                    sentence = line.strip()
                    if len(sentence) <= 200:
                        return sentence
                    else:
                        # Truncate at last complete sentence
                        sentences = sentence.split('. ')
                        brief = sentences[0] + '.'
                        return brief[:197] + "..." if len(brief) > 200 else brief
            
            # Fallback: extract from key findings
            key_findings_start = full_summary.find("## Key Findings")
            if key_findings_start > 0:
                findings_section = full_summary[key_findings_start:key_findings_start+400]
                first_finding = findings_section.split('\n')[1] if '\n' in findings_section else findings_section
                clean_finding = first_finding.strip('- ').strip()
                return clean_finding[:197] + "..." if len(clean_finding) > 200 else clean_finding
            
            # Final fallback
            clean_text = ' '.join(full_summary.split())
            return clean_text[:197] + "..." if len(clean_text) > 200 else clean_text
            
        except Exception as e:
            self.logger.error(f"Failed to extract brief summary: {e}")
            return "Advanced summary extraction failed"
    
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build the user prompt for summarization with advanced preprocessing."""
        # Intelligent content preprocessing 
        preprocessing_config = config.get('preprocessing', {})
        max_chars = preprocessing_config.get('max_chars', 50000)
        processed_content = self._intelligent_preprocessing(content, max_chars)
        
        # Use advanced multi-step framework if configured
        if config.get('use_advanced_framework', True):
            return self._build_advanced_analysis_prompt(processed_content, title, config)
        else:
            return self._build_standard_prompt(processed_content, title, config)
    
    def _build_advanced_analysis_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build advanced multi-step analysis prompt."""
        prompt = f"""
ADVANCED DOCUMENT ANALYSIS

Step 1: Content Recognition
Document: {title}
Length: {len(content)} characters
Purpose: Extract maximum value for strategic decision-making

Step 2: Systematic Analysis Framework

A) CORE THEMES IDENTIFICATION
What are the 2-3 central themes that drive this document's value?

B) EVIDENCE MAPPING  
What quantitative data, examples, case studies, or proof points support these themes?

C) STRATEGIC IMPLICATIONS
What business opportunities, risks, or decisions does this information enable?

D) AUDIENCE VALUE ASSESSMENT
What would a senior professional most need to extract from this content?

Step 3: Layered Summary Construction

EXECUTIVE BRIEFING (Core essence in 2-3 sentences):
[Capture the document's primary strategic value and key insight]

DETAILED ANALYSIS:

## Key Findings
[Top 3-5 discoveries with supporting evidence - prioritize by business impact]

## Strategic Implications
[2-3 business opportunities, risks, or competitive advantages identified]

## Decision Enablers  
[Specific actions, investments, or strategic moves this information supports]

## Context & Validation
[Important nuances, limitations, or qualifications to consider]

Step 4: Quality Validation
Does this summary:
✓ Preserve the document's most valuable insights?
✓ Enable immediate strategic understanding?
✓ Include specific, actionable information?
✓ Maintain accuracy while eliminating noise?

CONTENT TO ANALYZE:
{content}

Please provide your analysis following this systematic framework.
"""
        return prompt
    
    def _build_standard_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build standard prompt format."""
        prompt = f"""
# Document Analysis Request

**Title**: {title}

**Content**:
{content}

---

Please provide a comprehensive summary following this structure:

## Executive Summary
Provide a 2-3 sentence overview capturing the document's primary purpose and key takeaway.

## Key Points
List the 3-5 most important points, facts, or findings.

## Strategic Implications
Identify actionable insights and their potential impact.

## Technical Details (if applicable)
Highlight any technical specifications, methodologies, or implementation details.

## Recommendations
Suggest concrete next steps based on the content.

Remember to:
- Prioritize actionable insights
- Use specific, quantitative language
- Structure by importance
- Preserve critical context
"""
        return prompt
    
    def _intelligent_preprocessing(self, content: str, max_chars: int) -> str:
        """Intelligently extract key content sections preserving maximum value."""
        if len(content) <= max_chars:
            return content
        
        lines = content.split('\n')
        priority_content = []
        regular_content = []
        current_length = 0
        
        # Identify high-value content patterns
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
                
            # High priority indicators
            is_priority = (
                stripped.startswith('#') or  # Headings
                stripped.startswith('•') or stripped.startswith('-') or stripped.startswith('*') or  # Lists
                any(keyword in stripped.lower() for keyword in ['key', 'important', 'critical', 'result', 'finding', 'conclusion']) or
                len(stripped) < 120 or  # Short, dense information
                any(char.isdigit() for char in stripped)  # Contains numbers/data
            )
            
            if is_priority:
                priority_content.append(line)
            else:
                regular_content.append(line)
        
        # Allocate space: 60% priority, 40% regular content
        priority_budget = int(max_chars * 0.6)
        regular_budget = max_chars - priority_budget
        
        final_content = []
        
        # Add priority content first
        for line in priority_content:
            if current_length + len(line) < priority_budget:
                final_content.append(line)
                current_length += len(line)
        
        # Add regular content to fill remaining space
        for line in regular_content:
            if current_length + len(line) < max_chars:
                final_content.append(line)
                current_length += len(line)
            else:
                break
        
        return '\n'.join(final_content)
    
    def _extract_structured_summary(self, response: str) -> str:
        """Extract and format the structured summary from AI response."""
        try:
            # Find the executive briefing
            briefing_start = response.find("EXECUTIVE BRIEFING")
            if briefing_start == -1:
                briefing_start = response.find("Executive Briefing")
            
            # Find the detailed analysis
            analysis_start = response.find("DETAILED ANALYSIS")
            if analysis_start == -1:
                analysis_start = response.find("## Key Findings")
            
            if briefing_start > 0 and analysis_start > briefing_start:
                # Extract executive briefing
                briefing_section = response[briefing_start:analysis_start].strip()
                briefing_lines = briefing_section.split('\n')[1:]  # Skip header
                executive_summary = '\n'.join(line.strip() for line in briefing_lines if line.strip() and not line.strip().startswith('['))
                
                # Extract detailed analysis
                detailed_section = response[analysis_start:].strip()
                
                # Combine into formatted output
                return f"## Executive Summary\n{executive_summary}\n\n{detailed_section}"
            else:
                # Return formatted version of original response
                return response
                
        except Exception as e:
            self.logger.warning(f"Failed to extract structured summary: {e}")
            return response
    
    def _validate_summary_quality(self, summary: str, title: str, config: Dict[str, Any]) -> str:
        """Validate summary quality and completeness."""
        validation_config = config.get('quality_validation', {})
        validation_issues = []
        
        # Check for completeness
        min_length = validation_config.get('min_length', 200)
        if len(summary) < min_length:
            validation_issues.append(f"Summary too brief (< {min_length} chars)")
        
        # Check for key sections
        required_sections = validation_config.get('required_sections', ["Key Findings", "Strategic Implications", "Decision"])
        missing_sections = [section for section in required_sections 
                          if section.lower() not in summary.lower()]
        
        if missing_sections:
            validation_issues.append(f"Missing sections: {', '.join(missing_sections)}")
        
        # Check for actionable content
        actionable_indicators = ["opportunity", "risk", "recommend", "should", "action", "decision", "strategy"]
        if not any(indicator in summary.lower() for indicator in actionable_indicators):
            validation_issues.append("Lacks actionable insights")
        
        # Log validation results
        if validation_issues:
            self.logger.warning(f"Summary quality issues for {title}: {validation_issues}")
        else:
            self.logger.info(f"Summary quality validation passed for {title}")
        
        return summary
    
    def _fallback_summary(self, content: str, title: str) -> str:
        """Generate simple fallback summary when advanced processing fails."""
        truncated = content[:800] if len(content) > 800 else content
        
        simple_prompt = f"""Summarize this document briefly:

Title: {title}
Content: {truncated}

Provide a clear summary with key points."""
        
        try:
            completion = self.client.chat.completions.create(
                model=self.config.openai.model_summary,
                messages=[{"role": "user", "content": simple_prompt}],
                temperature=0.5,
                max_tokens=500
            )
            
            return f"## Summary\n{completion.choices[0].message.content}\n\n*Note: Generated using simplified processing due to technical limitations.*"
            
        except Exception as e:
            self.logger.error(f"Fallback summary also failed: {e}")
            return f"## Summary\nDocument: {title}\n\nContent preview: {content[:300]}...\n\n*Summary generation failed - showing content preview.*"
    
    def _get_default_system_prompt(self) -> str:
        """Get default system prompt for summarization."""
        return """You are an expert content analyst specializing in extracting actionable insights from complex documents. Your mission is to serve busy professionals who need to quickly understand and act on information.

EXPERTISE AREAS:
- Strategic business analysis
- Technical concept simplification  
- Risk and opportunity identification
- Decision-support synthesis

QUALITY STANDARDS:
- Prioritize actionable insights over background information
- Use specific, quantitative language (avoid vague terms)
- Structure information by importance and urgency
- Preserve critical context and nuance
- Enable informed decision-making"""
    
    def _get_fallback_result(self, error_message: str) -> Dict[str, Any]:
        """Get fallback result when analysis fails."""
        return {
            "analysis": f"Summary generation failed: {error_message}",
            "success": False,
            "web_search_used": False
        }