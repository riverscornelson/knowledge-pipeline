"""
Advanced content classification using sophisticated multi-step reasoning.
"""
import json
from typing import Dict, List, Any, Optional, Tuple
from openai import OpenAI
from core.config import OpenAIConfig
from utils.logging import setup_logger


class AdvancedContentClassifier:
    """Classifies content using systematic reasoning and validation techniques."""
    
    def __init__(self, config: OpenAIConfig, taxonomy: Dict[str, List[str]]):
        """Initialize classifier with OpenAI configuration and dynamic taxonomy."""
        self.config = config
        self.client = OpenAI(api_key=config.api_key)
        self.taxonomy = taxonomy
        self.logger = setup_logger(__name__)
        
        # Create taxonomy understanding for better classification
        self.content_type_definitions = self._build_content_type_definitions()
        self.ai_primitive_definitions = self._build_ai_primitive_definitions()
    
    def classify_content(self, content: str, title: str) -> Dict[str, Any]:
        """
        Perform advanced content classification using systematic reasoning.
        
        Args:
            content: The text content to classify
            title: The document title
            
        Returns:
            Dict with comprehensive classification results and reasoning
        """
        # Step 1: Intelligent content preprocessing
        processed_content = content  # Use full content for classification
        
        # Step 2: Advanced multi-step classification with system message
        system_message = {
            "role": "system",
            "content": """You are an expert content classification specialist with deep expertise in technology, business, and research domains. Your mission is to provide accurate, consistent classifications that enable effective content organization and discovery.

CLASSIFICATION EXPERTISE:
- Technology and AI content analysis
- Business document categorization  
- Research and academic content types
- Market intelligence and competitive analysis
- Strategic business intelligence

QUALITY STANDARDS:
- Use systematic reasoning for every classification decision
- Provide specific evidence from content to support choices
- Maintain consistency across similar documents
- Prefer precision over broad categorization
- Include confidence assessments based on evidence strength"""
        }
        
        classification_prompt = f"""
ADVANCED CONTENT CLASSIFICATION TASK

Step 1: Document Understanding
Document: {title}
Content Length: {len(processed_content)} characters
Classification Goal: Determine optimal content categorization for strategic knowledge management

Step 2: Systematic Classification Analysis

A) CONTENT TYPE ANALYSIS
Available Options: {', '.join(self.taxonomy['content_types'])}

Classification Methodology:
1. Analyze the ACTUAL SUBJECT MATTER and topics discussed
2. Identify the primary PURPOSE of the content (research, news, analysis, etc.)
3. Focus on WHAT is being communicated, not HOW it was delivered
4. Ignore format indicators (PDF, email headers, "Gmail" in title) - these are delivery mechanisms, not content types

IMPORTANT: A PDF containing market analysis is "Market News" regardless of being saved from Gmail
A research paper is "Research" even if received via email and saved as "Gmail - [title].pdf"

Evidence Analysis:
[Examine the actual content substance, not the delivery format or file naming]

B) AI PRIMITIVE IDENTIFICATION  
Available Options: {', '.join(self.taxonomy['ai_primitives'])}

Analysis Framework:
1. Scan for explicit mentions of AI/ML technologies
2. Identify discussed AI capabilities and applications
3. Look for specific AI use cases or implementations
4. Validate relevance and specificity

Evidence Gathering:
[Extract specific AI-related terms, concepts, and applications]

C) VENDOR/ORGANIZATION DETECTION
Available Options: {', '.join(self.taxonomy['vendors'][:20])}... (showing first 20)

Detection Methodology:
1. Identify primary companies/organizations mentioned
2. Distinguish between subject companies vs. cited examples
3. Determine relevance to document's core message
4. Validate against known vendor list

Evidence Collection:
[Find specific company mentions and assess their relevance]

Step 3: Reasoning and Validation

CONTENT TYPE REASONING:
Based on the analysis above, the most appropriate content type is [X] because:
- Evidence 1: [Specific CONTENT and SUBJECT MATTER discussed]
- Evidence 2: [Primary PURPOSE and INTENT of the material]  
- Evidence 3: [Target audience and use case based on CONTENT, not format]

NOTE: Do NOT classify as "Email" just because title contains "Gmail" or it was originally an email
Focus on the actual content: Is it research? Market analysis? Vendor announcement? Thought leadership?

Confidence Level: [High/Medium/Low] because [specific reasoning about content substance]

AI PRIMITIVES REASONING:
Selected AI primitives and justification:
- Primitive 1: [Specific evidence from content]
- Primitive 2: [Detailed justification]
- Primitive 3: [Relevance explanation]

VENDOR REASONING:
Primary vendor/organization: [Company] because:
- Prominence in content: [Evidence]
- Relevance to core message: [Justification]
- Context of mention: [Subject vs. example]

Step 4: Quality Validation Checkpoint
Does this classification:
✓ Reflect the document's primary purpose and content?
✓ Use specific evidence rather than assumptions?
✓ Maintain consistency with similar documents?
✓ Provide actionable categorization for knowledge management?

FINAL OUTPUT (JSON):
{{
    "content_type": "selected_type",
    "ai_primitives": ["primitive1", "primitive2"],
    "vendor": "organization_name",
    "confidence": "high/medium/low",
    "reasoning": "comprehensive explanation of classification decisions",
    "evidence": {{
        "content_type_indicators": ["specific evidence 1", "evidence 2"],
        "ai_primitive_mentions": ["AI term/concept 1", "term 2"],
        "vendor_context": "how vendor is discussed in document"
    }}
}}

CONTENT TO CLASSIFY:
Title: {title}
Content: {processed_content}

Please provide your systematic classification analysis following this framework.
"""
        
        try:
            # Execute multi-step classification
            messages = [system_message, {"role": "user", "content": classification_prompt}]
            response = self._get_completion_with_structured_output(messages)
            
            # Parse and validate classification
            classification = self._parse_classification_response(response)
            
            # Advanced validation with cross-checks
            validated_classification = self._advanced_validation(classification, content, title)
            
            # Log detailed classification results
            self._log_classification_results(validated_classification, title)
            
            return validated_classification
            
        except Exception as e:
            self.logger.error(f"Advanced classification failed for '{title}': {e}")
            return self._fallback_classification(content, title)
    
    def _intelligent_content_extraction(self, content: str, max_chars: int) -> str:
        """Extract most relevant content for classification analysis."""
        if len(content) <= max_chars:
            return content
        
        # Prioritize content sections for classification
        lines = content.split('\n')
        
        # High-value sections for classification
        classification_priority = []
        supporting_content = []
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue
            
            # Classification-relevant content indicators
            is_high_priority = (
                stripped.startswith('#') or  # Headers
                any(keyword in stripped.lower() for keyword in [
                    'abstract', 'summary', 'introduction', 'conclusion', 'overview',
                    'purpose', 'objective', 'goal', 'method', 'approach', 'results',
                    'ai', 'artificial intelligence', 'machine learning', 'deep learning',
                    'technology', 'platform', 'system', 'solution', 'product'
                ]) or
                len(stripped) < 150 or  # Concise statements
                any(char.isupper() for char in stripped[:20])  # Titles/headers
            )
            
            # Context around high-priority content
            if is_high_priority:
                classification_priority.append(line)
                # Include surrounding context
                for j in range(max(0, i-1), min(len(lines), i+2)):
                    if j != i and lines[j].strip():
                        supporting_content.append(lines[j])
            else:
                supporting_content.append(line)
        
        # Combine with priority weighting
        final_content = []
        current_length = 0
        
        # Add all priority content first
        for line in classification_priority:
            if current_length + len(line) < max_chars * 0.7:
                final_content.append(line)
                current_length += len(line)
        
        # Fill remaining space with supporting content
        for line in supporting_content:
            if current_length + len(line) < max_chars:
                final_content.append(line)
                current_length += len(line)
            else:
                break
        
        return '\n'.join(final_content)
    
    def _get_completion_with_structured_output(self, messages: List[Dict]) -> str:
        """Execute completion optimized for structured classification output."""
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_classifier,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.1,  # Very low for consistency
                max_tokens=800
            )
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"Classification API call failed: {e}")
    
    def _parse_classification_response(self, response: str) -> Dict[str, Any]:
        """Parse and extract structured classification from AI response."""
        try:
            # Try to find JSON in the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_content = response[json_start:json_end]
                classification = json.loads(json_content)
                
                # Ensure all required fields exist
                required_fields = ["content_type", "ai_primitives", "vendor", "confidence", "reasoning"]
                for field in required_fields:
                    if field not in classification:
                        classification[field] = None if field == "vendor" else []
                
                return classification
            else:
                raise ValueError("No JSON structure found in response")
                
        except Exception as e:
            self.logger.error(f"Failed to parse classification response: {e}")
            raise
    
    def _advanced_validation(self, classification: Dict[str, Any], content: str, title: str) -> Dict[str, Any]:
        """Perform advanced validation with cross-checks and consistency verification."""
        validated = classification.copy()
        validation_issues = []
        
        # Content Type Validation
        if validated.get("content_type") not in self.taxonomy["content_types"]:
            validation_issues.append(f"Invalid content type: {validated.get('content_type')}")
            validated["content_type"] = self._infer_content_type_fallback(content, title)
        
        # AI Primitives Validation with Relevance Check
        valid_primitives = []
        for primitive in validated.get("ai_primitives", []):
            if primitive in self.taxonomy["ai_primitives"]:
                # Check if primitive is actually relevant to content
                if self._validate_ai_primitive_relevance(primitive, content):
                    valid_primitives.append(primitive)
                else:
                    validation_issues.append(f"AI primitive '{primitive}' not sufficiently supported by content")
            else:
                validation_issues.append(f"Invalid AI primitive: {primitive}")
        
        validated["ai_primitives"] = valid_primitives[:3]  # Max 3, most relevant
        
        # Vendor Validation with Context Check
        vendor = validated.get("vendor")
        if vendor:
            if vendor in self.taxonomy["vendors"]:
                validated["vendor"] = vendor
            else:
                # Check if vendor is prominently mentioned
                vendor_prominence = self._assess_vendor_prominence(vendor, content, title)
                if vendor_prominence < 0.3:  # Threshold for prominence
                    validation_issues.append(f"Vendor '{vendor}' not prominently featured")
                    validated["vendor"] = None
        
        # Confidence Validation with Evidence Check
        confidence = validated.get("confidence", "medium")
        if confidence not in ["high", "medium", "low"]:
            confidence = "medium"
            validation_issues.append("Invalid confidence level, defaulted to medium")
        
        # Adjust confidence based on validation issues
        if validation_issues:
            if confidence == "high":
                confidence = "medium"
            elif confidence == "medium":
                confidence = "low"
        
        validated["confidence"] = confidence
        
        # Add validation metadata
        validated["validation_issues"] = validation_issues
        validated["validation_score"] = 1.0 - (len(validation_issues) * 0.2)  # Decrease score for issues
        
        return validated
    
    def _validate_ai_primitive_relevance(self, primitive: str, content: str) -> bool:
        """Check if AI primitive is actually relevant to the content."""
        content_lower = content.lower()
        primitive_lower = primitive.lower()
        
        # Use dynamic AI primitives from taxonomy
        if primitive not in self.taxonomy.get("ai_primitives", []):
            return False
        
        # Build indicators based on the primitive name itself
        # Split compound terms and create variations
        primitive_words = primitive_lower.replace("/", " ").replace("-", " ").split()
        
        # Create indicators from the primitive name and common variations
        indicators = []
        indicators.extend(primitive_words)  # Individual words
        indicators.append(primitive_lower)  # Full primitive name
        
        # Add common AI-related terms that might indicate any AI primitive
        general_ai_indicators = ["ai", "artificial intelligence", "model", "algorithm", 
                                "machine", "learning", "neural", "data", "analysis",
                                "automation", "intelligent", "system", "technology"]
        
        # Check for primitive-specific indicators
        found_primitive_indicator = any(indicator in content_lower for indicator in indicators)
        
        # Check for general AI context
        found_ai_context = sum(1 for indicator in general_ai_indicators if indicator in content_lower) >= 2
        
        # More lenient validation: either specific primitive term OR general AI context
        return found_primitive_indicator or found_ai_context
    
    def _assess_vendor_prominence(self, vendor: str, content: str, title: str) -> float:
        """Assess how prominently a vendor is featured in the content."""
        vendor_lower = vendor.lower()
        content_lower = content.lower()
        title_lower = title.lower()
        
        prominence_score = 0.0
        
        # Title prominence (high weight)
        if vendor_lower in title_lower:
            prominence_score += 0.4
        
        # Content frequency
        vendor_mentions = content_lower.count(vendor_lower)
        content_words = len(content_lower.split())
        mention_ratio = vendor_mentions / max(content_words, 1) * 1000  # Per 1000 words
        
        prominence_score += min(mention_ratio * 0.1, 0.3)  # Cap at 0.3
        
        # Context quality (mentioned with relevant terms)
        context_terms = ["company", "corporation", "organization", "platform", "solution", "technology"]
        context_score = sum(0.05 for term in context_terms 
                          if term in content_lower and vendor_lower in content_lower)
        prominence_score += min(context_score, 0.3)
        
        return min(prominence_score, 1.0)
    
    def _infer_content_type_fallback(self, content: str, title: str) -> str:
        """Infer content type using fallback heuristics."""
        content_lower = content.lower()
        title_lower = title.lower()
        
        # Simple heuristic matching
        if any(term in title_lower + content_lower for term in ["research", "study", "analysis", "report"]):
            return "Research" if "Research" in self.taxonomy["content_types"] else self.taxonomy["content_types"][0]
        elif any(term in title_lower + content_lower for term in ["news", "article", "press", "announcement"]):
            return "Market News" if "Market News" in self.taxonomy["content_types"] else self.taxonomy["content_types"][0]
        else:
            return self.taxonomy["content_types"][0] if self.taxonomy["content_types"] else "Unknown"
    
    def _build_content_type_definitions(self) -> Dict[str, str]:
        """Build understanding of content type definitions for better classification."""
        return {
            "Research": "Academic papers, studies, analysis reports, whitepapers",
            "Market News": "News articles, press releases, market updates, announcements",
            "Product": "Product documentation, specifications, feature descriptions",
            "Tutorial": "How-to guides, instructional content, educational materials",
            "Opinion": "Blog posts, editorials, commentary, thought leadership",
            "Technical": "Technical documentation, API guides, implementation details"
        }
    
    def _build_ai_primitive_definitions(self) -> Dict[str, str]:
        """Build understanding of AI primitive definitions for accurate identification."""
        return {
            "Natural Language Processing": "Text analysis, language understanding, sentiment analysis",
            "Machine Learning": "Predictive models, data analysis, pattern recognition",
            "Computer Vision": "Image recognition, visual analysis, object detection",
            "Deep Learning": "Neural networks, advanced ML models, complex pattern recognition",
            "Generative AI": "Content generation, creative AI, large language models",
            "Automation": "Process automation, workflow optimization, efficiency tools"
        }
    
    def _log_classification_results(self, classification: Dict[str, Any], title: str):
        """Log detailed classification results for monitoring and improvement."""
        validation_score = classification.get("validation_score", 1.0)
        confidence = classification.get("confidence", "unknown")
        
        self.logger.info(
            f"Advanced classification for '{title}': "
            f"Type={classification.get('content_type')}, "
            f"AI_Primitives={len(classification.get('ai_primitives', []))}, "
            f"Vendor={classification.get('vendor', 'None')}, "
            f"Confidence={confidence}, "
            f"Validation_Score={validation_score:.2f}"
        )
        
        if classification.get("validation_issues"):
            self.logger.warning(f"Validation issues for '{title}': {classification['validation_issues']}")
    
    def _fallback_classification(self, content: str, title: str) -> Dict[str, Any]:
        """Generate basic classification when advanced processing fails."""
        fallback_type = self._infer_content_type_fallback(content, title)
        
        return {
            "content_type": fallback_type,
            "ai_primitives": [],
            "vendor": None,
            "confidence": "low",
            "reasoning": "Generated using fallback classification due to processing error",
            "validation_issues": ["Advanced classification failed"],
            "validation_score": 0.3
        }