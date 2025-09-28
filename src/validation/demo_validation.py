#!/usr/bin/env python3
"""
Notion Aesthetic Validation Demo
Demonstrates the complete aesthetic validation suite with real examples.
"""

import json
import sys
import os
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent.parent))

from validation.notion_aesthetic_validator import NotionAestheticValidator
from validation.mock_page_generator import MockNotionPageGenerator
from validation.mobile_comparison_tool import MobileDesktopComparator


def run_comprehensive_demo():
    """Run comprehensive aesthetic validation demo"""
    print("🧪 Notion Aesthetic Validation Suite Demo")
    print("=" * 50)

    # Initialize components
    validator = NotionAestheticValidator()
    generator = MockNotionPageGenerator()
    comparator = MobileDesktopComparator()

    # Generate test pages
    print("\n📄 Generating Test Pages...")
    test_pages = generator.generate_test_suite_pages()

    print(f"Generated {len(test_pages)} test pages:")
    for name, page in test_pages.items():
        print(f"  • {name}: {page.title} ({len(page.blocks)} blocks)")

    # Run validation on each page
    print("\n🔍 Running Aesthetic Validation...")
    results = {}

    for page_name, page in test_pages.items():
        print(f"\n--- Validating: {page.title} ---")

        # Generate comprehensive metrics
        metrics = validator.generate_comprehensive_metrics(page)

        # Mobile vs Desktop analysis
        responsive_analysis = comparator.analyze_responsive_behavior(page)

        # Store results
        results[page_name] = {
            'page_title': page.title,
            'aesthetic_metrics': {
                'overall_score': metrics.overall_aesthetic_score,
                'visual_hierarchy': metrics.visual_hierarchy_score,
                'mobile_readability': metrics.mobile_readability_score,
                'accessibility': metrics.accessibility_score,
                'emoji_functionality': metrics.emoji_functionality_score,
                'table_mobile_compliance': metrics.table_mobile_compliance
            },
            'responsive_metrics': {
                'responsive_score': responsive_analysis.responsive_score,
                'mobile_score': responsive_analysis.mobile_metrics.readability_score,
                'desktop_score': responsive_analysis.desktop_metrics.readability_score,
                'critical_issues': responsive_analysis.critical_issues,
                'recommendations': responsive_analysis.recommendations[:3]  # Top 3
            }
        }

        # Print summary
        print(f"  Overall Score: {metrics.overall_aesthetic_score:.1%}")
        print(f"  Mobile Ready: {'✅' if metrics.table_mobile_compliance else '❌'}")
        print(f"  Accessibility: {metrics.accessibility_score:.1%}")

        if responsive_analysis.critical_issues:
            print(f"  ⚠️  Issues: {len(responsive_analysis.critical_issues)}")

    # Show best and worst performers
    print("\n🏆 Performance Summary")
    print("-" * 30)

    sorted_results = sorted(results.items(),
                          key=lambda x: x[1]['aesthetic_metrics']['overall_score'],
                          reverse=True)

    print("\n📈 Top Performers:")
    for i, (name, data) in enumerate(sorted_results[:3]):
        score = data['aesthetic_metrics']['overall_score']
        print(f"  {i+1}. {data['page_title']}: {score:.1%}")

    print("\n📉 Needs Improvement:")
    for i, (name, data) in enumerate(sorted_results[-2:]):
        score = data['aesthetic_metrics']['overall_score']
        issues = len(data['responsive_metrics']['critical_issues'])
        print(f"  • {data['page_title']}: {score:.1%} ({issues} issues)")

    # Mobile vs Desktop comparison
    print("\n📱 Mobile vs Desktop Comparison")
    print("-" * 35)

    mobile_scores = []
    desktop_scores = []

    for name, data in results.items():
        mobile_scores.append(data['responsive_metrics']['mobile_score'])
        desktop_scores.append(data['responsive_metrics']['desktop_score'])

    avg_mobile = sum(mobile_scores) / len(mobile_scores)
    avg_desktop = sum(desktop_scores) / len(desktop_scores)

    print(f"Average Mobile Score:  {avg_mobile:.1%}")
    print(f"Average Desktop Score: {avg_desktop:.1%}")
    print(f"Mobile-First Gap:      {abs(avg_desktop - avg_mobile):.1%}")

    # Common issues analysis
    print("\n⚠️  Common Issues Identified")
    print("-" * 30)

    all_issues = []
    for data in results.values():
        all_issues.extend(data['responsive_metrics']['critical_issues'])

    # Count issue types
    issue_types = {}
    for issue in all_issues:
        if 'table' in issue.lower():
            issue_types['Table Issues'] = issue_types.get('Table Issues', 0) + 1
        elif 'heading' in issue.lower():
            issue_types['Heading Issues'] = issue_types.get('Heading Issues', 0) + 1
        elif 'mobile' in issue.lower():
            issue_types['Mobile Issues'] = issue_types.get('Mobile Issues', 0) + 1
        else:
            issue_types['Other Issues'] = issue_types.get('Other Issues', 0) + 1

    for issue_type, count in sorted(issue_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {issue_type}: {count} occurrences")

    # Recommendations summary
    print("\n🔧 Key Recommendations")
    print("-" * 25)

    all_recommendations = []
    for data in results.values():
        all_recommendations.extend(data['responsive_metrics']['recommendations'])

    # Count recommendation types
    rec_types = {}
    for rec in all_recommendations:
        if 'table' in rec.lower():
            rec_types['Optimize Tables'] = rec_types.get('Optimize Tables', 0) + 1
        elif 'emoji' in rec.lower():
            rec_types['Improve Emojis'] = rec_types.get('Improve Emojis', 0) + 1
        elif 'mobile' in rec.lower():
            rec_types['Mobile Optimization'] = rec_types.get('Mobile Optimization', 0) + 1
        elif 'heading' in rec.lower():
            rec_types['Fix Headings'] = rec_types.get('Fix Headings', 0) + 1
        else:
            rec_types['General Improvements'] = rec_types.get('General Improvements', 0) + 1

    for rec_type, count in sorted(rec_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  • {rec_type}: {count} recommendations")

    # Export detailed results
    output_file = Path(__file__).parent.parent.parent / "swarm" / "notion-validator" / "demo-results.json"
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\n💾 Detailed results saved to: {output_file}")

    # Final summary
    print("\n✨ Validation Suite Demo Complete!")
    print("=" * 40)
    print(f"📊 Pages Tested: {len(results)}")
    print(f"🎯 Average Score: {sum(data['aesthetic_metrics']['overall_score'] for data in results.values()) / len(results):.1%}")
    print(f"📱 Mobile Ready: {sum(1 for data in results.values() if data['aesthetic_metrics']['table_mobile_compliance'])}/{len(results)}")
    print(f"♿ Accessible: {sum(1 for data in results.values() if data['aesthetic_metrics']['accessibility'] >= 0.8)}/{len(results)}")


def demonstrate_specific_validations():
    """Demonstrate specific validation features"""
    print("\n🔬 Specific Validation Demonstrations")
    print("=" * 40)

    validator = NotionAestheticValidator()
    generator = MockNotionPageGenerator()

    # 1. Emoji Functionality Test
    print("\n1️⃣ Emoji Functionality Validation")
    print("-" * 35)

    ideal_page = generator.generate_ideal_page("tech")
    no_emoji_page = generator.generate_page_variants(ideal_page, "no_emojis")

    ideal_emoji_score = validator.validate_emoji_functionality(ideal_page)
    no_emoji_score = validator.validate_emoji_functionality(no_emoji_page)

    print(f"  With Emojis:    {ideal_emoji_score:.1%}")
    print(f"  Without Emojis: {no_emoji_score:.1%}")
    print(f"  Impact:         {ideal_emoji_score - no_emoji_score:.1%} improvement")

    # 2. Table Mobile Compliance
    print("\n2️⃣ Table Mobile Compliance")
    print("-" * 30)

    good_table_page = generator.generate_ideal_page("business")
    poor_mobile_page = generator.generate_page_variants(good_table_page, "poor_mobile")

    good_table_score = validator.validate_table_formatting(good_table_page)
    poor_table_score = validator.validate_table_formatting(poor_mobile_page)

    print(f"  Mobile-Optimized: {good_table_score:.1%}")
    print(f"  Wide Tables:      {poor_table_score:.1%}")
    print(f"  Compliance Gap:   {good_table_score - poor_table_score:.1%}")

    # 3. Accessibility Impact
    print("\n3️⃣ Accessibility Compliance")
    print("-" * 30)

    accessible_page = generator.generate_ideal_page("design")
    accessibility_issues_page = generator.generate_page_variants(accessible_page, "accessibility_issues")

    accessible_score = validator.accessibility_validator.validate_accessibility(accessible_page)
    issues_score = validator.accessibility_validator.validate_accessibility(accessibility_issues_page)

    print(f"  Fully Accessible: {accessible_score:.1%}")
    print(f"  With Issues:      {issues_score:.1%}")
    print(f"  A11y Impact:      {accessible_score - issues_score:.1%}")

    # 4. Mobile vs Desktop Responsiveness
    print("\n4️⃣ Responsive Design Analysis")
    print("-" * 32)

    comparator = MobileDesktopComparator()
    responsive_page = generator.generate_mobile_test_page()
    analysis = comparator.analyze_responsive_behavior(responsive_page)

    mobile_metrics = analysis.mobile_metrics
    desktop_metrics = analysis.desktop_metrics

    print(f"  Mobile Readability:  {mobile_metrics.readability_score:.1%}")
    print(f"  Desktop Readability: {desktop_metrics.readability_score:.1%}")
    print(f"  Mobile Usability:    {mobile_metrics.usability_score:.1%}")
    print(f"  Desktop Usability:   {desktop_metrics.usability_score:.1%}")
    print(f"  Overall Responsive:  {analysis.responsive_score:.1%}")

    print("\n✅ Specific Validations Complete!")


if __name__ == "__main__":
    try:
        run_comprehensive_demo()
        demonstrate_specific_validations()
    except KeyboardInterrupt:
        print("\n\n🛑 Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()