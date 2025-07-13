"""
Content classification using OpenAI.
"""
import json
from typing import Dict, List, Any
from openai import OpenAI
from ..core.config import OpenAIConfig
from ..utils.logging import setup_logger


class ContentClassifier:
    """Classifies content into categories and identifies attributes."""
    
    def __init__(self, config: OpenAIConfig, taxonomy: Dict[str, List[str]]):
        """Initialize classifier with OpenAI configuration and taxonomy."""
        self.config = config
        self.client = OpenAI(api_key=config.api_key)
        self.taxonomy = taxonomy
        self.logger = setup_logger(__name__)
        
    def classify_content(self, content: str, title: str) -> Dict[str, Any]:
        """
        Classify content into categories and identify attributes.
        
        Args:
            content: The text content to classify
            title: The document title
            
        Returns:
            Dict with classification results
        """
        # Truncate content for classification
        truncated_content = content[:4000]
        
        prompt = f"""
        Analyze this document and provide structured classification.
        
        Document Title: {title}
        Content: {truncated_content}
        
        Available Content Types: {', '.join(self.taxonomy['content_types'])}
        Available AI Primitives: {', '.join(self.taxonomy['ai_primitives'])}
        Available Vendors: {', '.join(self.taxonomy['vendors'])}
        
        Provide JSON response with:
        {{
            "content_type": "most appropriate content type from the list",
            "ai_primitives": ["relevant AI primitives from the list (max 3)"],
            "vendor": "company/organization mentioned (from list or new if clearly mentioned)",
            "confidence": "high/medium/low",
            "reasoning": "brief explanation of classification choices"
        }}
        
        Rules:
        - Only use content types from the provided list
        - Only use AI primitives from the provided list
        - For vendor, prefer items from the list but can suggest new ones if clearly mentioned
        - Be selective with AI primitives - only include highly relevant ones
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.config.model_classifier,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.3,  # Lower temperature for more consistent classification
                max_tokens=500
            )
            
            classification = json.loads(response.choices[0].message.content)
            
            # Validate and clean the response
            classification = self._validate_classification(classification)
            
            self.logger.info(
                f"Classified '{title}' as {classification['content_type']} "
                f"with {len(classification['ai_primitives'])} AI primitives"
            )
            
            return classification
            
        except Exception as e:
            self.logger.error(f"Failed to classify content: {e}")
            return {
                "content_type": "Unknown",
                "ai_primitives": [],
                "vendor": None,
                "confidence": "low",
                "reasoning": "Classification failed due to error"
            }
    
    def _validate_classification(self, classification: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean classification results."""
        # Ensure content_type is from taxonomy
        if classification.get("content_type") not in self.taxonomy["content_types"]:
            classification["content_type"] = "Unknown"
        
        # Filter AI primitives to only those in taxonomy
        valid_primitives = []
        for primitive in classification.get("ai_primitives", []):
            if primitive in self.taxonomy["ai_primitives"]:
                valid_primitives.append(primitive)
        classification["ai_primitives"] = valid_primitives[:3]  # Max 3
        
        # Validate vendor if it's from the list
        vendor = classification.get("vendor")
        if vendor and vendor not in self.taxonomy["vendors"]:
            # Only keep if confidence is high
            if classification.get("confidence") != "high":
                classification["vendor"] = None
        
        # Ensure confidence is valid
        if classification.get("confidence") not in ["high", "medium", "low"]:
            classification["confidence"] = "medium"
        
        return classification