"""
Formatting system for Knowledge Pipeline.

This module provides a flexible, template-based formatting system that can adapt
to different content types and prompt outputs.
"""

from .models import (
    EnrichedContent,
    Insight,
    ActionItem,
    Attribution,
    ProcessingMetrics,
    ActionPriority,
    ContentQuality
)
from .normalizer import ContentNormalizer
from .templates import ContentTemplate, TemplateRegistry
from .visibility import VisibilityRules
from .builder import AdaptiveBlockBuilder, Platform

# Import to trigger template registration
from . import content_templates

__all__ = [
    # Models
    'EnrichedContent',
    'Insight',
    'ActionItem',
    'Attribution',
    'ProcessingMetrics',
    'ActionPriority',
    'ContentQuality',
    # Core components
    'ContentNormalizer',
    'ContentTemplate',
    'TemplateRegistry',
    'VisibilityRules',
    'AdaptiveBlockBuilder',
    'Platform',
]