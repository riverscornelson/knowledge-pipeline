#!/usr/bin/env python3
"""
Migration script to transition from the old NotionFormatter to the new PromptAwareNotionFormatter.
Provides backward compatibility and gradual rollout capabilities.
"""
import os
import sys
import argparse
import json
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.enrichment.pipeline_processor import PipelineProcessor
from src.enrichment.pipeline_processor_enhanced_formatting import EnhancedFormattingPipelineProcessor
from src.utils.logging import setup_logger


class FormatterMigration:
    """Handles migration from old to new formatter."""
    
    def __init__(self, config_path: str = None):
        """Initialize migration handler."""
        self.logger = setup_logger(__name__)
        
        # Load configuration
        self.config = PipelineConfig(config_path)
        self.notion_client = NotionClient(
            token=self.config.notion.token,
            db_id=self.config.notion.database_id
        )
        
        # Initialize both processors for comparison
        self.old_processor = PipelineProcessor(self.config, self.notion_client)
        self.new_processor = EnhancedFormattingPipelineProcessor(self.config, self.notion_client)
        
        # Migration state
        self.migration_stats = {
            "pages_analyzed": 0,
            "pages_migrated": 0,
            "migration_errors": 0,
            "performance_improvements": [],
            "start_time": datetime.now()
        }
    
    def analyze_migration_impact(self, limit: int = 10) -> Dict[str, Any]:
        """Analyze the impact of migrating to the new formatter."""
        self.logger.info(f"Analyzing migration impact for {limit} pages...")
        
        analysis_results = {
            "formatting_differences": [],
            "performance_comparison": [],
            "feature_improvements": [],
            "compatibility_issues": []
        }
        
        # Get sample pages
        sample_pages = list(self.notion_client.get_inbox_items(limit))
        
        for page in sample_pages:
            try:
                page_analysis = self._analyze_single_page(page)
                analysis_results["formatting_differences"].append(page_analysis["formatting"])
                analysis_results["performance_comparison"].append(page_analysis["performance"])
                
                if page_analysis["improvements"]:
                    analysis_results["feature_improvements"].extend(page_analysis["improvements"])
                    
                if page_analysis["issues"]:
                    analysis_results["compatibility_issues"].extend(page_analysis["issues"])
                    
            except Exception as e:
                self.logger.error(f"Failed to analyze page {page['id']}: {e}")
                analysis_results["compatibility_issues"].append({
                    "page_id": page['id'],
                    "error": str(e),
                    "type": "analysis_failure"
                })
        
        # Generate summary
        analysis_results["summary"] = self._generate_analysis_summary(analysis_results)
        
        return analysis_results
    
    def _analyze_single_page(self, page: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze a single page for migration impact."""
        page_id = page['id']
        title = page['properties']['Title']['title'][0]['text']['content']
        
        self.logger.debug(f"Analyzing page: {title}")
        
        # Extract content
        content = self.old_processor._extract_content(page)
        if not content:
            return {
                "page_id": page_id,
                "formatting": {"error": "No content found"},
                "performance": {"error": "No content to process"},
                "improvements": [],
                "issues": ["No content available for analysis"]
            }
        
        # Run enrichment with both formatters
        try:
            result = self.old_processor.enrich_content(content, page)
            
            # Time old formatter
            import time
            start_time = time.time()
            old_blocks = self.old_processor._create_content_blocks(result, content)
            old_time = time.time() - start_time
            
            # Time new formatter  
            start_time = time.time()
            new_blocks = self.new_processor._create_content_blocks(result, content)
            new_time = time.time() - start_time
            
            return {
                "page_id": page_id,
                "title": title,
                "formatting": {
                    "old_block_count": len(old_blocks),
                    "new_block_count": len(new_blocks),
                    "block_count_change": len(new_blocks) - len(old_blocks),
                    "new_features_detected": self._detect_new_features(new_blocks)
                },
                "performance": {
                    "old_time": old_time,
                    "new_time": new_time,
                    "time_change": new_time - old_time,
                    "performance_improvement": old_time > new_time
                },
                "improvements": self._identify_improvements(old_blocks, new_blocks),
                "issues": self._identify_compatibility_issues(old_blocks, new_blocks)
            }
            
        except Exception as e:
            return {
                "page_id": page_id,
                "formatting": {"error": str(e)},
                "performance": {"error": str(e)},
                "improvements": [],
                "issues": [f"Processing error: {e}"]
            }
    
    def _detect_new_features(self, blocks: List[Dict[str, Any]]) -> List[str]:
        """Detect new features in the formatted blocks."""
        features = []
        
        for block in blocks:
            # Check for executive dashboard
            if block.get("type") == "heading_1" and "Executive" in str(block):
                features.append("Executive Dashboard")
            
            # Check for quality indicators
            if "quality" in str(block).lower() and "⭐" in str(block):
                features.append("Quality Indicators")
            
            # Check for prompt attribution
            if "Generated by" in str(block):
                features.append("Prompt Attribution")
            
            # Check for cross-insights
            if "Connected Insights" in str(block):
                features.append("Cross-Insights")
            
            # Check for performance metrics
            if "Performance Details" in str(block):
                features.append("Performance Metrics")
        
        return list(set(features))
    
    def _identify_improvements(self, old_blocks: List[Dict], new_blocks: List[Dict]) -> List[str]:
        """Identify improvements in the new formatter."""
        improvements = []
        
        # Check for visual hierarchy improvements
        old_headings = sum(1 for b in old_blocks if "heading" in b.get("type", ""))
        new_headings = sum(1 for b in new_blocks if "heading" in b.get("type", ""))
        
        if new_headings > old_headings:
            improvements.append(f"Better visual hierarchy (+{new_headings - old_headings} headings)")
        
        # Check for callout usage
        old_callouts = sum(1 for b in old_blocks if b.get("type") == "callout")
        new_callouts = sum(1 for b in new_blocks if b.get("type") == "callout")
        
        if new_callouts > old_callouts:
            improvements.append(f"Enhanced visual elements (+{new_callouts - old_callouts} callouts)")
        
        # Check for toggles (better organization)
        old_toggles = sum(1 for b in old_blocks if b.get("type") == "toggle")
        new_toggles = sum(1 for b in new_blocks if b.get("type") == "toggle")
        
        if new_toggles > old_toggles:
            improvements.append(f"Better content organization (+{new_toggles - old_toggles} toggles)")
        
        return improvements
    
    def _identify_compatibility_issues(self, old_blocks: List[Dict], new_blocks: List[Dict]) -> List[str]:
        """Identify potential compatibility issues."""
        issues = []
        
        # Check for significant block count changes
        old_count = len(old_blocks)
        new_count = len(new_blocks)
        change_ratio = abs(new_count - old_count) / max(old_count, 1)
        
        if change_ratio > 0.5:
            issues.append(f"Significant block count change: {old_count} -> {new_count}")
        
        # Check for new block types that might not be supported
        new_block_types = set(b.get("type") for b in new_blocks)
        old_block_types = set(b.get("type") for b in old_blocks)
        additional_types = new_block_types - old_block_types
        
        if additional_types:
            issues.append(f"New block types introduced: {', '.join(additional_types)}")
        
        return issues
    
    def _generate_analysis_summary(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of analysis results."""
        total_pages = len(results["formatting_differences"])
        
        # Performance summary
        perf_improvements = sum(1 for p in results["performance_comparison"] 
                               if p.get("performance_improvement", False))
        
        # Feature summary
        all_features = []
        for diff in results["formatting_differences"]:
            features = diff.get("new_features_detected", [])
            all_features.extend(features)
        
        feature_counts = {}
        for feature in all_features:
            feature_counts[feature] = feature_counts.get(feature, 0) + 1
        
        return {
            "total_pages_analyzed": total_pages,
            "performance_improvements": perf_improvements,
            "performance_improvement_rate": perf_improvements / max(total_pages, 1),
            "common_new_features": feature_counts,
            "total_issues": len(results["compatibility_issues"]),
            "recommendation": self._generate_recommendation(results)
        }
    
    def _generate_recommendation(self, results: Dict[str, Any]) -> str:
        """Generate migration recommendation."""
        total_pages = len(results["formatting_differences"])
        issues_count = len(results["compatibility_issues"])
        
        if total_pages == 0:
            return "Unable to analyze - no pages processed"
        
        issue_rate = issues_count / total_pages
        
        if issue_rate < 0.1:
            return "RECOMMENDED: Low compatibility issues, safe to migrate"
        elif issue_rate < 0.3:
            return "CAUTIOUS: Some compatibility issues, test with subset first"
        else:
            return "NOT RECOMMENDED: High compatibility issues, requires fixes"
    
    def perform_gradual_migration(self, batch_size: int = 5, test_mode: bool = True) -> Dict[str, Any]:
        """Perform gradual migration in batches."""
        self.logger.info(f"Starting gradual migration (batch_size={batch_size}, test_mode={test_mode})")
        
        # Get all pages needing migration
        all_pages = list(self.notion_client.get_inbox_items())
        
        migration_results = {
            "batches_processed": 0,
            "pages_migrated": 0,
            "errors": [],
            "performance_gains": []
        }
        
        # Process in batches
        for i in range(0, len(all_pages), batch_size):
            batch = all_pages[i:i + batch_size]
            
            self.logger.info(f"Processing batch {i // batch_size + 1}: {len(batch)} pages")
            
            batch_result = self._migrate_batch(batch, test_mode)
            
            migration_results["batches_processed"] += 1
            migration_results["pages_migrated"] += batch_result["migrated"]
            migration_results["errors"].extend(batch_result["errors"])
            migration_results["performance_gains"].extend(batch_result["performance_gains"])
            
            # Stop if too many errors
            if len(migration_results["errors"]) > batch_size:
                self.logger.warning("Too many errors, stopping migration")
                break
        
        return migration_results
    
    def _migrate_batch(self, pages: List[Dict], test_mode: bool) -> Dict[str, Any]:
        """Migrate a batch of pages."""
        batch_result = {"migrated": 0, "errors": [], "performance_gains": []}
        
        for page in pages:
            try:
                if test_mode:
                    # Test mode: just analyze, don't actually migrate
                    analysis = self._analyze_single_page(page)
                    if not analysis.get("issues"):
                        batch_result["migrated"] += 1
                        if analysis["performance"]["performance_improvement"]:
                            batch_result["performance_gains"].append(analysis["performance"])
                else:
                    # Actually migrate the page
                    success = self._migrate_single_page(page)
                    if success:
                        batch_result["migrated"] += 1
                        
            except Exception as e:
                batch_result["errors"].append({
                    "page_id": page['id'],
                    "error": str(e)
                })
        
        return batch_result
    
    def _migrate_single_page(self, page: Dict[str, Any]) -> bool:
        """Migrate a single page to use new formatter."""
        try:
            # Extract content
            content = self.new_processor._extract_content(page)
            if not content:
                return False
            
            # Process with new formatter
            result = self.new_processor.enrich_content(content, page)
            
            # Store results using new formatter
            self.new_processor._store_results(page, result, content)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to migrate page {page['id']}: {e}")
            return False
    
    def create_migration_report(self, analysis_results: Dict[str, Any], output_path: str = None):
        """Create a detailed migration report."""
        if not output_path:
            output_path = f"migration_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            "migration_analysis": analysis_results,
            "timestamp": datetime.now().isoformat(),
            "configuration": {
                "old_formatter": "NotionFormatter",
                "new_formatter": "PromptAwareNotionFormatter",
                "migration_tool_version": "1.0.0"
            },
            "recommendations": self._generate_detailed_recommendations(analysis_results)
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Migration report saved to: {output_path}")
        
        # Also create a human-readable summary
        summary_path = output_path.replace('.json', '_summary.txt')
        self._create_text_summary(report, summary_path)
        
        return output_path
    
    def _generate_detailed_recommendations(self, results: Dict[str, Any]) -> List[str]:
        """Generate detailed migration recommendations."""
        recommendations = []
        
        summary = results.get("summary", {})
        
        # Performance recommendation
        if summary.get("performance_improvement_rate", 0) > 0.7:
            recommendations.append("High performance gains expected - prioritize migration")
        
        # Feature recommendation
        if summary.get("common_new_features"):
            recommendations.append("New features available will improve user experience")
        
        # Risk assessment
        if summary.get("total_issues", 0) > 0:
            recommendations.append(f"Address {summary['total_issues']} compatibility issues before migration")
        
        # Gradual rollout
        recommendations.append("Consider gradual rollout starting with 10% of pages")
        
        return recommendations
    
    def _create_text_summary(self, report: Dict[str, Any], output_path: str):
        """Create human-readable text summary."""
        with open(output_path, 'w') as f:
            f.write("PROMPT-AWARE NOTION FORMATTER MIGRATION REPORT\n")
            f.write("=" * 50 + "\n\n")
            
            # Summary
            summary = report["migration_analysis"]["summary"]
            f.write(f"Pages Analyzed: {summary['total_pages_analyzed']}\n")
            f.write(f"Performance Improvements: {summary['performance_improvements']}\n")
            f.write(f"Total Issues: {summary['total_issues']}\n")
            f.write(f"Recommendation: {summary['recommendation']}\n\n")
            
            # Features
            f.write("NEW FEATURES DETECTED:\n")
            features = summary.get("common_new_features", {})
            for feature, count in features.items():
                f.write(f"  - {feature}: {count} pages\n")
            f.write("\n")
            
            # Recommendations
            f.write("RECOMMENDATIONS:\n")
            for rec in report["recommendations"]:
                f.write(f"  - {rec}\n")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description="Migrate to prompt-aware Notion formatter")
    parser.add_argument("--analyze", action="store_true", help="Analyze migration impact")
    parser.add_argument("--migrate", action="store_true", help="Perform actual migration")
    parser.add_argument("--test-mode", action="store_true", help="Run in test mode (no actual changes)")
    parser.add_argument("--batch-size", type=int, default=5, help="Batch size for migration")
    parser.add_argument("--limit", type=int, default=10, help="Limit for analysis")
    parser.add_argument("--config", type=str, help="Config file path")
    parser.add_argument("--output", type=str, help="Output file for report")
    
    args = parser.parse_args()
    
    # Initialize migration handler
    migration = FormatterMigration(args.config)
    
    if args.analyze:
        # Analyze migration impact
        print("Analyzing migration impact...")
        results = migration.analyze_migration_impact(args.limit)
        
        # Create report
        report_path = migration.create_migration_report(results, args.output)
        print(f"Analysis complete. Report saved to: {report_path}")
        
        # Print summary
        summary = results["summary"]
        print(f"\nSUMMARY:")
        print(f"  Pages analyzed: {summary['total_pages_analyzed']}")
        print(f"  Performance improvements: {summary['performance_improvements']}")
        print(f"  Issues found: {summary['total_issues']}")
        print(f"  Recommendation: {summary['recommendation']}")
        
    elif args.migrate:
        # Perform migration
        print("Starting migration...")
        results = migration.perform_gradual_migration(args.batch_size, args.test_mode)
        
        print(f"Migration complete:")
        print(f"  Batches processed: {results['batches_processed']}")
        print(f"  Pages migrated: {results['pages_migrated']}")
        print(f"  Errors: {len(results['errors'])}")
        
        if results['errors']:
            print("Errors encountered:")
            for error in results['errors'][:5]:  # Show first 5
                print(f"  - {error['page_id']}: {error['error']}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()