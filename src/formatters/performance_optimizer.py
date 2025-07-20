"""
Performance optimization module for the prompt-aware Notion formatter.
Provides caching, batching, and optimization techniques for large documents.
"""
import hashlib
import json
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from collections import defaultdict
from ..utils.logging import setup_logger


@dataclass
class FormatCache:
    """Cache entry for formatted content."""
    content_hash: str
    formatted_blocks: List[Dict[str, Any]]
    timestamp: float
    access_count: int = 0
    last_access: float = 0


@dataclass
class PerformanceMetrics:
    """Performance metrics for formatting operations."""
    total_operations: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    total_processing_time: float = 0
    avg_blocks_per_operation: float = 0
    largest_document_size: int = 0
    optimization_savings: float = 0


class FormatPerformanceOptimizer:
    """Optimizes performance for large document formatting operations."""
    
    def __init__(self, max_cache_size: int = 1000, cache_ttl: float = 3600):
        """Initialize the performance optimizer.
        
        Args:
            max_cache_size: Maximum number of cached entries
            cache_ttl: Time-to-live for cache entries in seconds
        """
        self.logger = setup_logger(__name__)
        self.max_cache_size = max_cache_size
        self.cache_ttl = cache_ttl
        
        # Cache for formatted content
        self.format_cache: Dict[str, FormatCache] = {}
        
        # Performance metrics
        self.metrics = PerformanceMetrics()
        
        # Optimization settings
        self.enable_block_compression = True
        self.enable_lazy_loading = True
        self.batch_size_threshold = 100  # Blocks
        self.large_doc_threshold = 50000  # Characters
        
    def optimize_formatting(self, 
                          content: str,
                          formatter_func: callable,
                          *args, **kwargs) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Optimize formatting with caching and performance tracking.
        
        Args:
            content: Content to format
            formatter_func: Formatting function to call
            *args, **kwargs: Arguments for formatter function
            
        Returns:
            Tuple of (formatted_blocks, performance_stats)
        """
        start_time = time.time()
        
        # Generate cache key
        cache_key = self._generate_cache_key(content, args, kwargs)
        
        # Check cache first
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            self.metrics.cache_hits += 1
            processing_time = time.time() - start_time
            return cached_result, {
                "cache_hit": True,
                "processing_time": processing_time,
                "block_count": len(cached_result)
            }
        
        # Cache miss - proceed with formatting
        self.metrics.cache_misses += 1
        
        # Apply optimizations based on content size
        if len(content) > self.large_doc_threshold:
            blocks = self._format_large_document(content, formatter_func, *args, **kwargs)
        else:
            blocks = formatter_func(content, *args, **kwargs)
        
        # Cache the result
        self._store_in_cache(cache_key, blocks)
        
        # Update metrics
        processing_time = time.time() - start_time
        self._update_metrics(len(content), len(blocks), processing_time)
        
        return blocks, {
            "cache_hit": False,
            "processing_time": processing_time,
            "block_count": len(blocks),
            "optimizations_applied": len(content) > self.large_doc_threshold
        }
    
    def _format_large_document(self, 
                              content: str, 
                              formatter_func: callable,
                              *args, **kwargs) -> List[Dict[str, Any]]:
        """Apply optimizations for large documents."""
        self.logger.info(f"Applying large document optimizations for {len(content)} characters")
        
        # Strategy 1: Chunk the content
        chunks = self._intelligent_chunk_content(content)
        
        all_blocks = []
        for i, chunk in enumerate(chunks):
            # Format each chunk
            chunk_blocks = formatter_func(chunk, *args, **kwargs)
            
            # Apply block compression if enabled
            if self.enable_block_compression:
                chunk_blocks = self._compress_blocks(chunk_blocks)
            
            all_blocks.extend(chunk_blocks)
            
            # Add progress indicator for large documents
            if len(chunks) > 3 and i < len(chunks) - 1:
                all_blocks.append(self._create_progress_divider(i + 1, len(chunks)))
        
        # Apply lazy loading for very large results
        if len(all_blocks) > self.batch_size_threshold:
            all_blocks = self._apply_lazy_loading(all_blocks)
        
        return all_blocks
    
    def _intelligent_chunk_content(self, content: str, target_size: int = 10000) -> List[str]:
        """Intelligently chunk content at natural boundaries."""
        if len(content) <= target_size:
            return [content]
        
        chunks = []
        current_chunk = ""
        
        # Split by paragraphs first
        paragraphs = content.split('\n\n')
        
        for paragraph in paragraphs:
            # If adding this paragraph would exceed target size
            if len(current_chunk) + len(paragraph) > target_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = paragraph
            else:
                if current_chunk:
                    current_chunk += '\n\n' + paragraph
                else:
                    current_chunk = paragraph
        
        # Add remaining chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        self.logger.debug(f"Chunked {len(content)} chars into {len(chunks)} chunks")
        return chunks
    
    def _compress_blocks(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Compress blocks by merging similar adjacent blocks."""
        if not blocks:
            return blocks
        
        compressed = []
        current_group = [blocks[0]]
        
        for block in blocks[1:]:
            # Check if block can be merged with current group
            if self._can_merge_blocks(current_group[-1], block):
                current_group.append(block)
            else:
                # Process current group
                if len(current_group) > 1:
                    merged_block = self._merge_block_group(current_group)
                    compressed.append(merged_block)
                else:
                    compressed.append(current_group[0])
                
                # Start new group
                current_group = [block]
        
        # Process final group
        if len(current_group) > 1:
            merged_block = self._merge_block_group(current_group)
            compressed.append(merged_block)
        else:
            compressed.extend(current_group)
        
        compression_ratio = len(compressed) / len(blocks)
        self.logger.debug(f"Compressed {len(blocks)} blocks to {len(compressed)} (ratio: {compression_ratio:.2f})")
        
        return compressed
    
    def _can_merge_blocks(self, block1: Dict[str, Any], block2: Dict[str, Any]) -> bool:
        """Check if two blocks can be merged."""
        # Only merge paragraph blocks for now
        if block1.get("type") != "paragraph" or block2.get("type") != "paragraph":
            return False
        
        # Don't merge if either has complex formatting
        text1 = block1.get("paragraph", {}).get("rich_text", [])
        text2 = block2.get("paragraph", {}).get("rich_text", [])
        
        # Check for simple text blocks only
        if len(text1) != 1 or len(text2) != 1:
            return False
        
        # Check for annotations or links
        if text1[0].get("annotations") or text1[0].get("href"):
            return False
        if text2[0].get("annotations") or text2[0].get("href"):
            return False
        
        # Check combined length won't exceed Notion's limits
        content1 = text1[0].get("text", {}).get("content", "")
        content2 = text2[0].get("text", {}).get("content", "")
        
        return len(content1) + len(content2) < 1800  # Leave buffer for Notion's 2000 char limit
    
    def _merge_block_group(self, blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge a group of similar blocks."""
        if not blocks:
            return {}
        
        # Merge paragraph blocks
        if blocks[0].get("type") == "paragraph":
            combined_text = []
            for block in blocks:
                text_content = block.get("paragraph", {}).get("rich_text", [])
                if text_content:
                    content = text_content[0].get("text", {}).get("content", "")
                    combined_text.append(content)
            
            return {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": "\n".join(combined_text)}
                    }]
                }
            }
        
        # If can't merge, return first block
        return blocks[0]
    
    def _apply_lazy_loading(self, blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply lazy loading by grouping blocks into collapsible sections."""
        if not self.enable_lazy_loading:
            return blocks
        
        lazy_blocks = []
        current_batch = []
        
        for i, block in enumerate(blocks):
            current_batch.append(block)
            
            # Create a toggle every batch_size_threshold blocks
            if len(current_batch) >= self.batch_size_threshold:
                batch_num = (i // self.batch_size_threshold) + 1
                
                toggle_block = {
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [{
                            "type": "text", 
                            "text": {"content": f"📄 Content Section {batch_num} ({len(current_batch)} blocks)"}
                        }],
                        "children": current_batch
                    }
                }
                
                lazy_blocks.append(toggle_block)
                current_batch = []
        
        # Add remaining blocks
        if current_batch:
            if len(lazy_blocks) > 0:  # There are other sections, add as final toggle
                final_batch_num = len(lazy_blocks) + 1
                toggle_block = {
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [{
                            "type": "text",
                            "text": {"content": f"📄 Content Section {final_batch_num} ({len(current_batch)} blocks)"}
                        }],
                        "children": current_batch
                    }
                }
                lazy_blocks.append(toggle_block)
            else:  # Only one small section, don't wrap in toggle
                lazy_blocks.extend(current_batch)
        
        return lazy_blocks
    
    def _create_progress_divider(self, current: int, total: int) -> Dict[str, Any]:
        """Create a progress indicator divider."""
        progress_bar = "█" * current + "░" * (total - current)
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{
                    "type": "text",
                    "text": {"content": f"Processing Progress: {progress_bar} ({current}/{total})"}
                }],
                "icon": {"type": "emoji", "emoji": "⏳"},
                "color": "gray_background"
            }
        }
    
    def _generate_cache_key(self, content: str, args: tuple, kwargs: dict) -> str:
        """Generate a cache key for the given content and parameters."""
        # Hash the content
        content_hash = hashlib.md5(content.encode()).hexdigest()
        
        # Hash the parameters
        param_str = json.dumps({
            "args": str(args),
            "kwargs": {k: str(v) for k, v in kwargs.items()}
        }, sort_keys=True)
        param_hash = hashlib.md5(param_str.encode()).hexdigest()
        
        return f"{content_hash}_{param_hash}"
    
    def _get_from_cache(self, cache_key: str) -> Optional[List[Dict[str, Any]]]:
        """Get cached result if available and not expired."""
        if cache_key not in self.format_cache:
            return None
        
        cache_entry = self.format_cache[cache_key]
        current_time = time.time()
        
        # Check if expired
        if current_time - cache_entry.timestamp > self.cache_ttl:
            del self.format_cache[cache_key]
            return None
        
        # Update access info
        cache_entry.access_count += 1
        cache_entry.last_access = current_time
        
        return cache_entry.formatted_blocks
    
    def _store_in_cache(self, cache_key: str, blocks: List[Dict[str, Any]]):
        """Store formatted blocks in cache."""
        # Implement LRU eviction if cache is full
        if len(self.format_cache) >= self.max_cache_size:
            self._evict_least_recently_used()
        
        self.format_cache[cache_key] = FormatCache(
            content_hash=cache_key,
            formatted_blocks=blocks,
            timestamp=time.time(),
            access_count=1,
            last_access=time.time()
        )
    
    def _evict_least_recently_used(self):
        """Remove the least recently used cache entry."""
        if not self.format_cache:
            return
        
        # Find entry with oldest last_access
        oldest_key = min(
            self.format_cache.keys(),
            key=lambda k: self.format_cache[k].last_access
        )
        
        del self.format_cache[oldest_key]
        self.logger.debug(f"Evicted cache entry: {oldest_key}")
    
    def _update_metrics(self, content_size: int, block_count: int, processing_time: float):
        """Update performance metrics."""
        self.metrics.total_operations += 1
        self.metrics.total_processing_time += processing_time
        
        # Update averages
        self.metrics.avg_blocks_per_operation = (
            (self.metrics.avg_blocks_per_operation * (self.metrics.total_operations - 1) + block_count) 
            / self.metrics.total_operations
        )
        
        # Update largest document size
        if content_size > self.metrics.largest_document_size:
            self.metrics.largest_document_size = content_size
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get current performance statistics."""
        cache_hit_rate = 0.0
        if self.metrics.cache_hits + self.metrics.cache_misses > 0:
            cache_hit_rate = self.metrics.cache_hits / (self.metrics.cache_hits + self.metrics.cache_misses)
        
        avg_processing_time = 0.0
        if self.metrics.total_operations > 0:
            avg_processing_time = self.metrics.total_processing_time / self.metrics.total_operations
        
        return {
            "total_operations": self.metrics.total_operations,
            "cache_hit_rate": cache_hit_rate,
            "cache_size": len(self.format_cache),
            "avg_processing_time": avg_processing_time,
            "avg_blocks_per_operation": self.metrics.avg_blocks_per_operation,
            "largest_document_chars": self.metrics.largest_document_size,
            "optimizations_enabled": {
                "block_compression": self.enable_block_compression,
                "lazy_loading": self.enable_lazy_loading,
                "caching": True
            }
        }
    
    def clear_cache(self):
        """Clear the format cache."""
        self.format_cache.clear()
        self.logger.info("Format cache cleared")
    
    def configure_optimizations(self, 
                              enable_compression: bool = None,
                              enable_lazy: bool = None,
                              batch_threshold: int = None,
                              large_doc_threshold: int = None):
        """Configure optimization settings."""
        if enable_compression is not None:
            self.enable_block_compression = enable_compression
        if enable_lazy is not None:
            self.enable_lazy_loading = enable_lazy
        if batch_threshold is not None:
            self.batch_size_threshold = batch_threshold
        if large_doc_threshold is not None:
            self.large_doc_threshold = large_doc_threshold
            
        self.logger.info(f"Optimization settings updated: compression={self.enable_block_compression}, lazy={self.enable_lazy_loading}")