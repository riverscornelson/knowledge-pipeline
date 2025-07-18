# Content Tag Addition - Project Overview

## Purpose
Add a "Content Tag" field to the knowledge pipeline that extracts 1-7 key phrases (4 words max each) from PDF content to enable cross-searching and improved content discovery.

## Project Structure
- `01_design_specification.md` - Technical design and field specifications
- `02_implementation_plan.md` - Step-by-step implementation guide
- `03_notion_schema_update.md` - Database schema changes
- `04_ai_tag_extraction.md` - AI prompt design and extraction logic
- `05_pipeline_integration.md` - Integration with existing pipeline
- `06_testing_strategy.md` - Testing and validation approach
- `07_deployment_guide.md` - Deployment and rollback procedures

## Key Deliverables
1. New "Content Tag" multi-select field in Notion Sources database
2. AI-powered tag extraction module (`src/enrichment/tag_extractor.py`)
3. Updated enrichment pipeline to include tag extraction
4. Comprehensive testing suite for tag quality validation

## Timeline
- Design Phase: Complete all specification documents
- Implementation Phase: Code development and testing
- Deployment Phase: Staged rollout with monitoring