#!/usr/bin/env python3
"""Diagnose prompt configuration issues."""

import os
import sys

# First, let's check what's in the Notion database
notion_token = os.getenv('NOTION_TOKEN')
notion_db_id = os.getenv('NOTION_PROMPTS_DB_ID')

if not notion_token or not notion_db_id:
    print("Missing NOTION_TOKEN or NOTION_PROMPTS_DB_ID")
    print(f"NOTION_TOKEN: {notion_token[:10]}..." if notion_token else "NOTION_TOKEN: Not set")
    print(f"NOTION_PROMPTS_DB_ID: {notion_db_id}" if notion_db_id else "NOTION_PROMPTS_DB_ID: Not set")
    sys.exit(1)

import requests

headers = {
    "Authorization": f"Bearer {notion_token}",
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
}

# Query the database
response = requests.post(
    f"https://api.notion.com/v1/databases/{notion_db_id}/query",
    headers=headers,
    json={
        "filter": {"property": "Active", "checkbox": {"equals": True}},
        "page_size": 100
    }
)

if response.status_code != 200:
    print(f"Failed to query Notion: {response.status_code}")
    print(response.text)
    sys.exit(1)

data = response.json()
results = data.get("results", [])

print(f"Found {len(results)} active prompts in Notion")
print("\nPrompts by Content Type and Analyzer:")

prompts = {}
for page in results:
    props = page.get("properties", {})
    
    # Extract content type
    content_type_prop = props.get("Content Type", {})
    if content_type_prop.get("type") == "select":
        content_type = content_type_prop.get("select", {}).get("name", "Unknown")
    else:
        content_type = "Unknown"
    
    # Extract analyzer type
    analyzer_prop = props.get("Analyzer Type", {}) or props.get("Analyzer", {})
    if analyzer_prop.get("type") == "select":
        analyzer = analyzer_prop.get("select", {}).get("name", "Unknown")
    else:
        analyzer = "Unknown"
    
    key = f"{content_type} / {analyzer}"
    if key not in prompts:
        prompts[key] = 0
    prompts[key] += 1

for key in sorted(prompts.keys()):
    print(f"  - {key}: {prompts[key]} prompt(s)")

# Show what cache keys these would generate
print("\nExpected cache keys:")
for page in results[:10]:  # Show first 10
    props = page.get("properties", {})
    
    # Extract content type
    content_type_prop = props.get("Content Type", {})
    if content_type_prop.get("type") == "select":
        content_type = content_type_prop.get("select", {}).get("name", "Unknown")
    else:
        continue
    
    # Extract analyzer type
    analyzer_prop = props.get("Analyzer Type", {}) or props.get("Analyzer", {})
    if analyzer_prop.get("type") == "select":
        analyzer = analyzer_prop.get("select", {}).get("name", "Unknown")
    else:
        continue
    
    # Show both possible cache keys
    key1 = f"{content_type.lower().replace(' ', '_')}_{analyzer.lower()}"
    key2 = f"{content_type.lower()}_{analyzer.lower()}"
    
    if key1 != key2:
        print(f"  - {key1} (normalized)")
        print(f"  - {key2} (original)")
    else:
        print(f"  - {key1}")