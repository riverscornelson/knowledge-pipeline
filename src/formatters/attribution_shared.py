"""
Shared attribution utilities for formatters.
Common functions extracted from multiple formatter classes to reduce duplication.
"""
from typing import Dict, Any


# Quality thresholds and indicators (shared across formatters)
QUALITY_THRESHOLDS = {
    "excellent": 9.0,  # For 0-10 scale
    "good": 7.0, 
    "acceptable": 5.0,
    "poor": 0
}

QUALITY_INDICATORS = {
    "excellent": "🌟",
    "good": "✅",
    "acceptable": "⚠️", 
    "poor": "❌"
}

# Alternative quality indicators for legacy compatibility
LEGACY_QUALITY_INDICATORS = {
    "excellent": "⭐",
    "good": "✅", 
    "acceptable": "✓",
    "poor": "⚠️"
}

QUALITY_COLORS = {
    "excellent": "green_background",
    "good": "blue_background", 
    "acceptable": "yellow_background",
    "poor": "red_background"
}


def get_quality_level(scaled_score: float) -> str:
    """Get quality level based on scaled score (0-10)."""
    if scaled_score >= QUALITY_THRESHOLDS["excellent"]:
        return "excellent"
    elif scaled_score >= QUALITY_THRESHOLDS["good"]:
        return "good"
    elif scaled_score >= QUALITY_THRESHOLDS["acceptable"]:
        return "acceptable"
    else:
        return "poor"


def get_quality_indicator(score: float, use_legacy: bool = False) -> str:
    """Get emoji indicator for quality score."""
    if score >= 0.9:
        level = "excellent"
    elif score >= 0.7:
        level = "good"
    elif score >= 0.5:
        level = "acceptable"
    else:
        level = "poor"
    
    indicators = LEGACY_QUALITY_INDICATORS if use_legacy else QUALITY_INDICATORS
    return indicators[level]


def get_quality_color(quality_level: str) -> str:
    """Get Notion color for quality level."""
    return QUALITY_COLORS.get(quality_level, "gray_background")


def scale_quality_score(raw_score: float, scale: int = 10) -> float:
    """Scale quality score to specified range (default 0-10)."""
    return raw_score * scale


def create_quality_callout(quality_score: float, content: str, scaled: bool = True) -> Dict[str, Any]:
    """Create a standardized quality callout block."""
    if scaled:
        scaled_score = quality_score if quality_score > 1 else scale_quality_score(quality_score)
    else:
        scaled_score = scale_quality_score(quality_score)
    
    level = get_quality_level(scaled_score)
    indicator = QUALITY_INDICATORS[level]
    color = get_quality_color(level)
    
    return {
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {"content": f"{indicator} {content} ({scaled_score:.1f}/10)"}
            }],
            "icon": {"type": "emoji", "emoji": indicator},
            "color": color
        }
    }


def create_attribution_header(analyzer_name: str, quality_score: float, processing_time: float) -> Dict[str, Any]:
    """Create standardized attribution header."""
    indicator = get_quality_indicator(quality_score)
    
    return {
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {
                    "content": f"Generated by {analyzer_name} | Quality: {quality_score:.2f} {indicator} | {processing_time:.1f}s"
                }
            }],
            "icon": {"type": "emoji", "emoji": "🤖"},
            "color": "blue_background"
        }
    }


def create_metrics_summary(total_prompts: int, avg_quality: float, total_tokens: int, 
                          processing_time: float, prompt_sources: Dict[str, str] = None) -> Dict[str, Any]:
    """Create standardized metrics summary callout."""
    scaled_quality = scale_quality_score(avg_quality) if avg_quality <= 1 else avg_quality
    indicator = get_quality_indicator(avg_quality)
    
    # Build source indicator
    source_indicator = ""
    if prompt_sources:
        notion_count = sum(1 for source in prompt_sources.values() if source == "notion")
        yaml_count = total_prompts - notion_count
        
        if notion_count > 0 and yaml_count > 0:
            source_indicator = f" (📝 Notion + 📄 YAML)"
        elif notion_count > 0:
            source_indicator = f" (📝 Notion)"
        else:
            source_indicator = f" (📄 YAML)"
    
    return {
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {
                    "content": f"📊 {total_prompts} Prompts{source_indicator} • {scaled_quality:.1f}/10 {indicator} • {total_tokens:,} Tokens • {processing_time:.1f}s ⚡"
                }
            }],
            "icon": {"type": "emoji", "emoji": "📊"},
            "color": get_quality_color(get_quality_level(scaled_quality))
        }
    }


def add_quality_indicator_to_block(block: Dict[str, Any], quality_score: float) -> Dict[str, Any]:
    """Add visual quality indicators to blocks."""
    indicator = get_quality_indicator(quality_score)
    
    block_type = block.get("type")
    if block_type in ["heading_1", "heading_2", "heading_3"]:
        # Prepend indicator to heading text
        rich_text = block[block_type]["rich_text"]
        if rich_text and rich_text[0].get("text"):
            original_text = rich_text[0]["text"]["content"]
            rich_text[0]["text"]["content"] = f"{indicator} {original_text}"
            
    elif block_type == "callout":
        # Update callout icon
        block["callout"]["icon"] = {"type": "emoji", "emoji": indicator}
        
    return block


def format_attribution_footer(avg_quality: float, total_prompts: int, 
                             prompt_sources: Dict[str, str] = None) -> Dict[str, Any]:
    """Create standardized attribution footer."""
    scaled_quality = scale_quality_score(avg_quality) if avg_quality <= 1 else avg_quality
    indicator = get_quality_indicator(avg_quality)
    
    # Build flow description
    if prompt_sources:
        notion_prompts = [name for name, source in prompt_sources.items() if source == "notion"]
        yaml_prompts = [name for name, source in prompt_sources.items() if source == "yaml"]
        
        if notion_prompts and yaml_prompts:
            flow_desc = f"🤖 Orchestrated Notion prompts ({', '.join(notion_prompts)}) with YAML fallbacks"
        elif notion_prompts:
            flow_desc = f"🤖 Powered by Notion prompts: {', '.join(notion_prompts)}"
        else:
            flow_desc = f"🤖 Synthesized insights from {total_prompts} AI prompts"
    else:
        flow_desc = f"🤖 Synthesized insights from {total_prompts} AI prompts"
    
    return {
        "type": "callout",
        "callout": {
            "rich_text": [{
                "type": "text",
                "text": {
                    "content": f"{flow_desc} | Quality: {scaled_quality:.1f}/10 {indicator}"
                }
            }],
            "icon": {"type": "emoji", "emoji": "🤖"},
            "color": get_quality_color(get_quality_level(scaled_quality))
        }
    }