#!/usr/bin/env python3
"""Analyze logged prompts and responses for optimization."""

import json
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from collections import defaultdict
import statistics


def load_prompt_logs(log_file: Path, limit: Optional[int] = None) -> List[Dict]:
    """Load prompt logs from file."""
    logs = []
    
    if not log_file.exists():
        print(f"Log file not found: {log_file}")
        return logs
    
    with open(log_file, 'r') as f:
        for i, line in enumerate(f):
            if limit and i >= limit:
                break
            try:
                logs.append(json.loads(line.strip()))
            except json.JSONDecodeError:
                continue
    
    return logs


def analyze_by_analyzer(logs: List[Dict]) -> Dict[str, Dict]:
    """Group and analyze logs by analyzer type."""
    analyzer_stats = defaultdict(lambda: {
        "count": 0,
        "durations": [],
        "models": defaultdict(int),
        "content_types": defaultdict(int),
        "errors": 0,
        "web_search_used": 0,
        "sample_prompts": []
    })
    
    for log in logs:
        analyzer = log.get("analyzer", "unknown")
        stats = analyzer_stats[analyzer]
        
        stats["count"] += 1
        
        if log.get("duration_ms"):
            stats["durations"].append(log["duration_ms"])
        
        if log.get("model"):
            stats["models"][log["model"]] += 1
        
        if log.get("content_type"):
            stats["content_types"][log["content_type"]] += 1
        else:
            stats["content_types"]["default"] += 1
        
        if log.get("error"):
            stats["errors"] += 1
        
        if log.get("web_search_enabled"):
            stats["web_search_used"] += 1
        
        # Store sample prompts (first 3)
        if len(stats["sample_prompts"]) < 3 and log.get("prompt"):
            stats["sample_prompts"].append({
                "source_id": log.get("source_id", "unknown"),
                "prompt": log.get("prompt")
            })
    
    return dict(analyzer_stats)


def print_analysis(analyzer_stats: Dict[str, Dict]):
    """Print analysis results."""
    print("\n" + "="*80)
    print("PROMPT LOGGING ANALYSIS REPORT")
    print("="*80)
    
    total_calls = sum(stats["count"] for stats in analyzer_stats.values())
    print(f"\nTotal API calls logged: {total_calls}")
    
    for analyzer, stats in analyzer_stats.items():
        print(f"\n{'='*40}")
        print(f"Analyzer: {analyzer}")
        print(f"{'='*40}")
        print(f"Total calls: {stats['count']}")
        print(f"Errors: {stats['errors']} ({stats['errors']/stats['count']*100:.1f}%)")
        print(f"Web search used: {stats['web_search_used']} ({stats['web_search_used']/stats['count']*100:.1f}%)")
        
        # Duration statistics
        if stats["durations"]:
            avg_duration = statistics.mean(stats["durations"])
            median_duration = statistics.median(stats["durations"])
            print(f"\nDuration statistics:")
            print(f"  Average: {avg_duration:.0f}ms")
            print(f"  Median: {median_duration:.0f}ms")
            print(f"  Min: {min(stats['durations']):.0f}ms")
            print(f"  Max: {max(stats['durations']):.0f}ms")
        
        # Model usage
        print(f"\nModels used:")
        for model, count in stats["models"].items():
            print(f"  {model}: {count} ({count/stats['count']*100:.1f}%)")
        
        # Content type distribution
        print(f"\nContent types processed:")
        for content_type, count in stats["content_types"].items():
            print(f"  {content_type}: {count} ({count/stats['count']*100:.1f}%)")
        
        # Sample prompts
        if stats["sample_prompts"]:
            print(f"\nSample prompts:")
            for i, sample in enumerate(stats["sample_prompts"], 1):
                print(f"\n  Sample {i} (source: {sample['source_id']}):")
                prompt = sample['prompt']
                
                # Handle both string and message array prompts
                if isinstance(prompt, list):
                    for msg in prompt:
                        role = msg.get('role', 'unknown')
                        content = msg.get('content', '')
                        preview = content[:200] + "..." if len(content) > 200 else content
                        print(f"    [{role}]: {preview}")
                else:
                    preview = prompt[:300] + "..." if len(prompt) > 300 else prompt
                    print(f"    {preview}")


def export_prompts(logs: List[Dict], output_file: Path, analyzer_filter: Optional[str] = None):
    """Export prompts to a file for detailed analysis."""
    filtered_logs = logs
    
    if analyzer_filter:
        filtered_logs = [log for log in logs if log.get("analyzer") == analyzer_filter]
    
    with open(output_file, 'w') as f:
        for log in filtered_logs:
            # Write a simplified version for easier reading
            entry = {
                "timestamp": log.get("timestamp"),
                "analyzer": log.get("analyzer"),
                "source_id": log.get("source_id"),
                "model": log.get("model"),
                "duration_ms": log.get("duration_ms"),
                "prompt": log.get("prompt"),
                "response": log.get("response")[:500] + "..." if log.get("response") and len(log.get("response", "")) > 500 else log.get("response")
            }
            f.write(json.dumps(entry, indent=2) + "\n\n")
    
    print(f"\nExported {len(filtered_logs)} prompts to {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Analyze prompt logs for optimization")
    parser.add_argument("--log-file", default="logs/prompts.jsonl", help="Path to prompt log file")
    parser.add_argument("--limit", type=int, help="Limit number of logs to analyze")
    parser.add_argument("--export", help="Export prompts to file for detailed analysis")
    parser.add_argument("--analyzer", help="Filter by specific analyzer when exporting")
    
    args = parser.parse_args()
    
    # Load logs
    log_file = Path(args.log_file)
    logs = load_prompt_logs(log_file, args.limit)
    
    if not logs:
        print("No logs found to analyze.")
        return
    
    # Analyze
    analyzer_stats = analyze_by_analyzer(logs)
    print_analysis(analyzer_stats)
    
    # Export if requested
    if args.export:
        export_prompts(logs, Path(args.export), args.analyzer)


if __name__ == "__main__":
    main()