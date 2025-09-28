"""
Performance Optimizer for GPT-5 Knowledge Pipeline
Implements caching, parallel processing, and resource optimization
"""

import asyncio
import threading
import time
from typing import Dict, List, Any, Optional, Callable, Tuple
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from functools import lru_cache, wraps
from dataclasses import dataclass, field
from collections import defaultdict
import hashlib
import pickle
import json
import psutil
from pathlib import Path
import logging

# Thread-safe cache for content processing
from threading import RLock


@dataclass
class PerformanceMetrics:
    """Performance metrics tracking"""
    processing_times: List[float] = field(default_factory=list)
    cache_hits: int = 0
    cache_misses: int = 0
    parallel_tasks: int = 0
    memory_usage: List[float] = field(default_factory=list)
    token_usage: Dict[str, int] = field(default_factory=dict)
    api_calls: int = 0
    optimization_savings: float = 0.0


@dataclass
class OptimizationConfig:
    """Configuration for performance optimizations"""
    enable_caching: bool = True
    enable_parallel_processing: bool = True
    max_workers: int = 8
    cache_size: int = 1000
    batch_size: int = 10
    memory_threshold: float = 80.0  # Percentage
    enable_token_optimization: bool = True
    enable_api_batching: bool = True
    cache_ttl: int = 3600  # seconds


class ContentCache:
    """Thread-safe content caching system"""

    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        self.cache = {}
        self.access_times = {}
        self.max_size = max_size
        self.ttl = ttl
        self._lock = RLock()

    def _generate_key(self, content: str, operation: str) -> str:
        """Generate cache key from content and operation"""
        content_hash = hashlib.md5(content.encode()).hexdigest()
        return f"{operation}:{content_hash}"

    def get(self, content: str, operation: str) -> Optional[Any]:
        """Get cached result"""
        key = self._generate_key(content, operation)

        with self._lock:
            if key in self.cache:
                # Check TTL
                if time.time() - self.access_times[key] < self.ttl:
                    self.access_times[key] = time.time()
                    return self.cache[key]
                else:
                    # Expired
                    del self.cache[key]
                    del self.access_times[key]

        return None

    def put(self, content: str, operation: str, result: Any):
        """Store result in cache"""
        key = self._generate_key(content, operation)

        with self._lock:
            # Evict if at capacity
            if len(self.cache) >= self.max_size:
                self._evict_lru()

            self.cache[key] = result
            self.access_times[key] = time.time()

    def _evict_lru(self):
        """Evict least recently used item"""
        if not self.cache:
            return

        lru_key = min(self.access_times.items(), key=lambda x: x[1])[0]
        del self.cache[lru_key]
        del self.access_times[lru_key]

    def clear(self):
        """Clear all cached items"""
        with self._lock:
            self.cache.clear()
            self.access_times.clear()

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'hit_rate': self._calculate_hit_rate(),
                'oldest_entry': min(self.access_times.values()) if self.access_times else None
            }

    def _calculate_hit_rate(self) -> float:
        """Calculate cache hit rate (placeholder for actual implementation)"""
        # This would need to be tracked separately in a real implementation
        return 0.85  # Example value


class TokenOptimizer:
    """Optimize token usage through content analysis and compression"""

    def __init__(self):
        self.token_patterns = {}
        self.compression_strategies = {
            'remove_redundancy': self._remove_redundant_content,
            'smart_truncation': self._smart_truncate,
            'content_summarization': self._summarize_content,
            'template_optimization': self._optimize_templates
        }

    def optimize_content(self, content: str, target_reduction: float = 0.2) -> Tuple[str, Dict]:
        """Optimize content to reduce token usage"""
        original_tokens = self._estimate_tokens(content)

        optimized_content = content
        optimizations_applied = []

        for strategy_name, strategy_func in self.compression_strategies.items():
            try:
                optimized_content, metadata = strategy_func(optimized_content, target_reduction)
                if metadata.get('tokens_saved', 0) > 0:
                    optimizations_applied.append({
                        'strategy': strategy_name,
                        'tokens_saved': metadata['tokens_saved'],
                        'reduction_percentage': metadata.get('reduction_percentage', 0)
                    })
            except Exception as e:
                logging.warning(f"Token optimization strategy {strategy_name} failed: {e}")
                continue

        final_tokens = self._estimate_tokens(optimized_content)
        total_saved = original_tokens - final_tokens

        return optimized_content, {
            'original_tokens': original_tokens,
            'final_tokens': final_tokens,
            'tokens_saved': total_saved,
            'reduction_percentage': (total_saved / original_tokens) * 100 if original_tokens > 0 else 0,
            'optimizations_applied': optimizations_applied
        }

    def _estimate_tokens(self, content: str) -> int:
        """Estimate token count (rough approximation)"""
        return int(len(content.split()) * 1.3)

    def _remove_redundant_content(self, content: str, target_reduction: float) -> Tuple[str, Dict]:
        """Remove redundant phrases and repetitive content"""
        lines = content.split('\n')
        seen_lines = set()
        unique_lines = []

        tokens_saved = 0

        for line in lines:
            line_stripped = line.strip()
            if line_stripped and line_stripped not in seen_lines:
                seen_lines.add(line_stripped)
                unique_lines.append(line)
            else:
                tokens_saved += self._estimate_tokens(line)

        optimized_content = '\n'.join(unique_lines)

        return optimized_content, {
            'tokens_saved': tokens_saved,
            'reduction_percentage': (tokens_saved / self._estimate_tokens(content)) * 100 if content else 0
        }

    def _smart_truncate(self, content: str, target_reduction: float) -> Tuple[str, Dict]:
        """Intelligent content truncation preserving important information"""
        lines = content.split('\n')
        important_indicators = ['#', '##', '###', '**', 'TODO:', 'IMPORTANT:', 'NOTE:']

        important_lines = []
        regular_lines = []

        for line in lines:
            if any(indicator in line for indicator in important_indicators):
                important_lines.append(line)
            else:
                regular_lines.append(line)

        # Calculate how many regular lines to keep
        target_lines = int(len(lines) * (1 - target_reduction))
        regular_to_keep = max(0, target_lines - len(important_lines))

        # Keep all important lines and top regular lines
        kept_regular = regular_lines[:regular_to_keep]
        optimized_lines = important_lines + kept_regular

        optimized_content = '\n'.join(optimized_lines)
        original_tokens = self._estimate_tokens(content)
        final_tokens = self._estimate_tokens(optimized_content)

        return optimized_content, {
            'tokens_saved': original_tokens - final_tokens,
            'reduction_percentage': ((original_tokens - final_tokens) / original_tokens) * 100 if original_tokens > 0 else 0
        }

    def _summarize_content(self, content: str, target_reduction: float) -> Tuple[str, Dict]:
        """Summarize content sections (placeholder for AI summarization)"""
        # In a real implementation, this would use an AI model for summarization
        # For now, we'll do simple paragraph reduction

        paragraphs = content.split('\n\n')
        if len(paragraphs) <= 2:
            return content, {'tokens_saved': 0, 'reduction_percentage': 0}

        # Keep first and last paragraphs, summarize middle
        target_paragraphs = max(2, int(len(paragraphs) * (1 - target_reduction)))

        if target_paragraphs >= len(paragraphs):
            return content, {'tokens_saved': 0, 'reduction_percentage': 0}

        kept_paragraphs = [paragraphs[0]]  # Always keep first
        if target_paragraphs > 2:
            # Keep some middle paragraphs
            middle_count = target_paragraphs - 2
            step = len(paragraphs[1:-1]) // (middle_count + 1) if middle_count > 0 else 1
            for i in range(1, len(paragraphs) - 1, step):
                if len(kept_paragraphs) < target_paragraphs - 1:
                    kept_paragraphs.append(paragraphs[i])

        kept_paragraphs.append(paragraphs[-1])  # Always keep last

        optimized_content = '\n\n'.join(kept_paragraphs)
        original_tokens = self._estimate_tokens(content)
        final_tokens = self._estimate_tokens(optimized_content)

        return optimized_content, {
            'tokens_saved': original_tokens - final_tokens,
            'reduction_percentage': ((original_tokens - final_tokens) / original_tokens) * 100 if original_tokens > 0 else 0
        }

    def _optimize_templates(self, content: str, target_reduction: float) -> Tuple[str, Dict]:
        """Optimize template structures and formatting"""
        # Remove excessive whitespace
        lines = content.split('\n')
        optimized_lines = []

        for line in lines:
            stripped = line.strip()
            if stripped:  # Skip empty lines
                optimized_lines.append(stripped)

        optimized_content = '\n'.join(optimized_lines)
        original_tokens = self._estimate_tokens(content)
        final_tokens = self._estimate_tokens(optimized_content)

        return optimized_content, {
            'tokens_saved': original_tokens - final_tokens,
            'reduction_percentage': ((original_tokens - final_tokens) / original_tokens) * 100 if original_tokens > 0 else 0
        }


class ParallelProcessor:
    """Parallel processing manager for content operations"""

    def __init__(self, max_workers: int = 8):
        self.max_workers = max_workers
        self.thread_pool = ThreadPoolExecutor(max_workers=max_workers)
        self.process_pool = ProcessPoolExecutor(max_workers=max_workers)

    def process_batch_threaded(self, items: List[Any], process_func: Callable, *args, **kwargs) -> List[Any]:
        """Process batch of items using threading"""
        futures = []

        for item in items:
            future = self.thread_pool.submit(process_func, item, *args, **kwargs)
            futures.append(future)

        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                logging.error(f"Parallel processing error: {e}")
                results.append(None)

        return results

    def process_batch_multiprocess(self, items: List[Any], process_func: Callable, *args, **kwargs) -> List[Any]:
        """Process batch of items using multiprocessing"""
        futures = []

        for item in items:
            future = self.process_pool.submit(process_func, item, *args, **kwargs)
            futures.append(future)

        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                logging.error(f"Parallel processing error: {e}")
                results.append(None)

        return results

    async def process_batch_async(self, items: List[Any], process_func: Callable, *args, **kwargs) -> List[Any]:
        """Process batch of items asynchronously"""
        semaphore = asyncio.Semaphore(self.max_workers)

        async def process_item(item):
            async with semaphore:
                try:
                    if asyncio.iscoroutinefunction(process_func):
                        return await process_func(item, *args, **kwargs)
                    else:
                        # Run in thread pool for non-async functions
                        loop = asyncio.get_event_loop()
                        return await loop.run_in_executor(None, process_func, item, *args, **kwargs)
                except Exception as e:
                    logging.error(f"Async processing error: {e}")
                    return None

        tasks = [process_item(item) for item in items]
        return await asyncio.gather(*tasks)

    def shutdown(self):
        """Shutdown thread and process pools"""
        self.thread_pool.shutdown(wait=True)
        self.process_pool.shutdown(wait=True)


class MemoryManager:
    """Memory usage monitoring and optimization"""

    def __init__(self, threshold_percentage: float = 80.0):
        self.threshold_percentage = threshold_percentage

    def get_memory_usage(self) -> Dict[str, float]:
        """Get current memory usage statistics"""
        memory = psutil.virtual_memory()
        return {
            'total_gb': memory.total / (1024**3),
            'available_gb': memory.available / (1024**3),
            'used_gb': memory.used / (1024**3),
            'percentage': memory.percent,
            'above_threshold': memory.percent > self.threshold_percentage
        }

    def monitor_memory(self, func: Callable) -> Callable:
        """Decorator to monitor memory usage of functions"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_memory = self.get_memory_usage()

            try:
                result = func(*args, **kwargs)
                end_memory = self.get_memory_usage()

                memory_delta = end_memory['used_gb'] - start_memory['used_gb']

                if hasattr(result, '__dict__') and not isinstance(result, (str, int, float, bool, list, dict)):
                    result._memory_usage = {
                        'start_memory': start_memory,
                        'end_memory': end_memory,
                        'memory_delta': memory_delta
                    }

                return result

            except Exception as e:
                end_memory = self.get_memory_usage()
                logging.error(f"Function {func.__name__} failed with memory usage: {end_memory}")
                raise

        return wrapper

    def optimize_for_memory(self, items: List[Any], process_func: Callable, chunk_size: int = None) -> List[Any]:
        """Process items in memory-optimized chunks"""
        if chunk_size is None:
            memory_info = self.get_memory_usage()
            # Adjust chunk size based on available memory
            if memory_info['available_gb'] > 4:
                chunk_size = 50
            elif memory_info['available_gb'] > 2:
                chunk_size = 20
            else:
                chunk_size = 10

        results = []
        for i in range(0, len(items), chunk_size):
            chunk = items[i:i+chunk_size]

            # Check memory before processing chunk
            memory_before = self.get_memory_usage()

            if memory_before['percentage'] > self.threshold_percentage:
                logging.warning(f"High memory usage ({memory_before['percentage']:.1f}%) before processing chunk")
                # Force garbage collection
                import gc
                gc.collect()

            chunk_results = []
            for item in chunk:
                try:
                    result = process_func(item)
                    chunk_results.append(result)
                except Exception as e:
                    logging.error(f"Error processing item in memory-optimized chunk: {e}")
                    chunk_results.append(None)

            results.extend(chunk_results)

            # Check memory after processing chunk
            memory_after = self.get_memory_usage()
            memory_delta = memory_after['used_gb'] - memory_before['used_gb']

            logging.info(f"Processed chunk {i//chunk_size + 1}, memory delta: {memory_delta:.2f}GB")

        return results


class APIBatcher:
    """Batch API calls for improved efficiency"""

    def __init__(self, batch_size: int = 10, delay: float = 0.1):
        self.batch_size = batch_size
        self.delay = delay
        self.pending_requests = []
        self._lock = threading.Lock()

    def add_request(self, request_data: Dict) -> str:
        """Add request to batch queue"""
        request_id = f"req_{len(self.pending_requests)}_{int(time.time())}"

        with self._lock:
            self.pending_requests.append({
                'id': request_id,
                'data': request_data,
                'timestamp': time.time()
            })

        return request_id

    def process_batch(self, api_func: Callable) -> Dict[str, Any]:
        """Process pending requests in batches"""
        if not self.pending_requests:
            return {}

        with self._lock:
            batch = self.pending_requests[:self.batch_size]
            self.pending_requests = self.pending_requests[self.batch_size:]

        results = {}

        try:
            # Process batch through API function
            batch_data = [req['data'] for req in batch]
            batch_results = api_func(batch_data)

            # Map results back to request IDs
            for i, request in enumerate(batch):
                if i < len(batch_results):
                    results[request['id']] = batch_results[i]
                else:
                    results[request['id']] = None

        except Exception as e:
            logging.error(f"Batch API processing failed: {e}")
            # Mark all requests as failed
            for request in batch:
                results[request['id']] = {'error': str(e)}

        return results

    def flush_pending(self, api_func: Callable) -> Dict[str, Any]:
        """Process all pending requests"""
        all_results = {}

        while self.pending_requests:
            batch_results = self.process_batch(api_func)
            all_results.update(batch_results)

            if self.pending_requests:
                time.sleep(self.delay)

        return all_results


class PerformanceOptimizer:
    """Main performance optimization controller"""

    def __init__(self, config: OptimizationConfig = None):
        self.config = config or OptimizationConfig()
        self.metrics = PerformanceMetrics()

        # Initialize components
        self.cache = ContentCache(
            max_size=self.config.cache_size,
            ttl=self.config.cache_ttl
        ) if self.config.enable_caching else None

        self.token_optimizer = TokenOptimizer() if self.config.enable_token_optimization else None

        self.parallel_processor = ParallelProcessor(
            max_workers=self.config.max_workers
        ) if self.config.enable_parallel_processing else None

        self.memory_manager = MemoryManager(
            threshold_percentage=self.config.memory_threshold
        )

        self.api_batcher = APIBatcher(
            batch_size=self.config.batch_size
        ) if self.config.enable_api_batching else None

    def optimize_content_processing(self, content: str, operation: str, process_func: Callable) -> Any:
        """Optimize single content processing operation"""
        start_time = time.time()

        # Try cache first
        if self.cache:
            cached_result = self.cache.get(content, operation)
            if cached_result is not None:
                self.metrics.cache_hits += 1
                return cached_result
            else:
                self.metrics.cache_misses += 1

        # Optimize tokens if enabled
        optimized_content = content
        if self.token_optimizer:
            optimized_content, token_metadata = self.token_optimizer.optimize_content(content)
            self.metrics.optimization_savings += token_metadata.get('tokens_saved', 0)

        # Process content
        try:
            if self.memory_manager:
                monitored_func = self.memory_manager.monitor_memory(process_func)
                result = monitored_func(optimized_content)
            else:
                result = process_func(optimized_content)

            # Cache result
            if self.cache:
                self.cache.put(content, operation, result)

            # Update metrics
            processing_time = time.time() - start_time
            self.metrics.processing_times.append(processing_time)

            return result

        except Exception as e:
            logging.error(f"Content processing failed: {e}")
            raise

    def optimize_batch_processing(self, items: List[Any], process_func: Callable, *args, **kwargs) -> List[Any]:
        """Optimize batch processing operations"""
        if not items:
            return []

        # Check memory constraints
        memory_info = self.memory_manager.get_memory_usage()

        if memory_info['above_threshold']:
            # Use memory-optimized processing
            return self.memory_manager.optimize_for_memory(items, process_func)

        elif self.parallel_processor and len(items) > 5:
            # Use parallel processing for larger batches
            self.metrics.parallel_tasks += len(items)

            # Choose processing method based on item count and memory
            if len(items) > 20 and memory_info['available_gb'] > 2:
                return self.parallel_processor.process_batch_multiprocess(items, process_func, *args, **kwargs)
            else:
                return self.parallel_processor.process_batch_threaded(items, process_func, *args, **kwargs)

        else:
            # Sequential processing for small batches
            results = []
            for item in items:
                try:
                    result = process_func(item, *args, **kwargs)
                    results.append(result)
                except Exception as e:
                    logging.error(f"Sequential processing error: {e}")
                    results.append(None)

            return results

    def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        report = {
            'timestamp': time.time(),
            'config': self.config.__dict__,
            'metrics': {
                'total_processing_operations': len(self.metrics.processing_times),
                'average_processing_time': sum(self.metrics.processing_times) / len(self.metrics.processing_times) if self.metrics.processing_times else 0,
                'cache_hit_rate': self.metrics.cache_hits / (self.metrics.cache_hits + self.metrics.cache_misses) if (self.metrics.cache_hits + self.metrics.cache_misses) > 0 else 0,
                'parallel_tasks_executed': self.metrics.parallel_tasks,
                'total_api_calls': self.metrics.api_calls,
                'optimization_savings': self.metrics.optimization_savings
            },
            'system_performance': self.memory_manager.get_memory_usage(),
            'recommendations': self._generate_recommendations()
        }

        if self.cache:
            report['cache_stats'] = self.cache.stats()

        return report

    def _generate_recommendations(self) -> List[str]:
        """Generate performance optimization recommendations"""
        recommendations = []

        # Cache performance
        if self.cache:
            hit_rate = self.metrics.cache_hits / (self.metrics.cache_hits + self.metrics.cache_misses) if (self.metrics.cache_hits + self.metrics.cache_misses) > 0 else 0
            if hit_rate < 0.5:
                recommendations.append("Low cache hit rate. Consider increasing cache size or TTL.")

        # Memory usage
        memory_info = self.memory_manager.get_memory_usage()
        if memory_info['percentage'] > 80:
            recommendations.append("High memory usage detected. Consider processing smaller batches.")

        # Processing times
        if self.metrics.processing_times:
            avg_time = sum(self.metrics.processing_times) / len(self.metrics.processing_times)
            if avg_time > 5.0:
                recommendations.append("High average processing time. Consider enabling parallel processing.")

        # Parallel processing
        if not self.config.enable_parallel_processing and len(self.metrics.processing_times) > 10:
            recommendations.append("Enable parallel processing for better performance on batch operations.")

        # Token optimization
        if self.metrics.optimization_savings > 1000:
            recommendations.append("Token optimization is saving significant resources. Consider expanding its use.")

        if not recommendations:
            recommendations.append("Performance is optimal. No specific recommendations at this time.")

        return recommendations

    def shutdown(self):
        """Cleanup optimizer resources"""
        if self.parallel_processor:
            self.parallel_processor.shutdown()

        if self.cache:
            self.cache.clear()


# Utility functions for optimization
def cached_operation(cache_key: str):
    """Decorator for caching expensive operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # This would integrate with the global cache
            return func(*args, **kwargs)
        return wrapper
    return decorator


def memory_optimized(threshold: float = 80.0):
    """Decorator for memory-optimized operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            memory_manager = MemoryManager(threshold)
            monitored_func = memory_manager.monitor_memory(func)
            return monitored_func(*args, **kwargs)
        return wrapper
    return decorator


def parallel_enabled(max_workers: int = 8):
    """Decorator for parallel-enabled batch operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(items, *args, **kwargs):
            if isinstance(items, list) and len(items) > 5:
                processor = ParallelProcessor(max_workers)
                try:
                    return processor.process_batch_threaded(items, func, *args, **kwargs)
                finally:
                    processor.shutdown()
            else:
                return func(items, *args, **kwargs)
        return wrapper
    return decorator


# Example usage and integration points
if __name__ == "__main__":
    # Example usage
    config = OptimizationConfig(
        enable_caching=True,
        enable_parallel_processing=True,
        max_workers=4,
        cache_size=500,
        enable_token_optimization=True
    )

    optimizer = PerformanceOptimizer(config)

    # Example content processing
    def example_process_func(content):
        time.sleep(0.1)  # Simulate processing
        return f"Processed: {len(content)} characters"

    # Test single content optimization
    test_content = "This is test content for optimization" * 100
    result = optimizer.optimize_content_processing(test_content, "test_operation", example_process_func)

    # Test batch optimization
    test_items = [f"Content batch {i}" * 50 for i in range(20)]
    batch_results = optimizer.optimize_batch_processing(test_items, example_process_func)

    # Generate performance report
    report = optimizer.get_performance_report()
    print(json.dumps(report, indent=2))

    # Cleanup
    optimizer.shutdown()