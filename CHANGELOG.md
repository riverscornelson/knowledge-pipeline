# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- **Summary field** from Notion properties - resolves 200-character truncation issue
  - Full summaries remain available in "📋 Core Summary" toggle blocks
  - No data loss - only removes the truncated property field
  - Existing entries retain their Summary field, new entries won't populate it

### Changed
- Updated pipeline processor to stop populating Summary property
- Modified tests and scripts to remove Summary field references

## [3.0.9] - 2025-07-19 - Released

### Security
- **CRITICAL**: Fixed OAuth2 token storage vulnerability (CVE-level severity)
  - Replaced insecure pickle serialization with secure JSON format
  - Enforces strict file permissions (0600) on token files
  - Tokens now stored in secure location (~/.config/knowledge-pipeline/)
  - Added automatic migration from legacy pickle format
  - Validates token file permissions on load, removing insecure tokens

### Fixed
- Test suite now passes 100% (72/72 tests)
- Fixed text chunking empty separator handling
- Fixed pipeline processor test mocks
- Fixed prompt config test assertions
- Improved exception handling in tests

### Added
- SecureTokenStorage class for proper OAuth2 token management
- Comprehensive test coverage for all core functionality
- Enhanced content tagging system with dual-taxonomy approach:
  - **Topical-Tags**: Subject matter and theme classification (3-5 tags per document)
  - **Domain-Tags**: Industry and application area classification (2-4 tags per document)
  - Intelligent tag generation with consistency enforcement
  - Preference for existing tags to maintain taxonomy coherence
  - Backfill script for tagging existing content
- OAuth2-based Drive uploads to avoid service account quota limits
- Local PDF upload preprocessor for batch processing local PDFs

## [3.0.8] - 2025-07-16

### Changed
- Removed all content truncation limits - process full documents
- Enhanced content processing to handle documents of any size

## [3.0.7] - 2025-07-16

### Fixed
- Web search detection to match o3 Responses API structure
- Web search activation and o3 model compatibility

## [3.0.6] - 2025-07-16

### Fixed
- AI primitive classification and method signature errors
- Added web search citation tracking and display in Notion

## [3.0.5] - 2025-07-16

### Fixed
- Enrichment errors and improved content classification

## [3.0.4] - 2025-07-16

### Fixed
- Cleaned up temporary implementation files

## [3.0.3] - 2025-07-16

### Fixed
- Removed unsubstantiated performance claim

## [3.0.2] - 2025-07-16

### Changed
- Cleaned up and reorganized documentation

## [3.0.1] - 2025-01-16

### Changed
- **Simplified Architecture**: Removed Gmail and Firecrawl integrations to focus on core Google Drive functionality
- **Streamlined Pipeline**: Single-source architecture for improved reliability and maintainability
- **Updated Documentation**: All docs now reflect Google Drive-only focus with clear future roadmap
- **Enhanced Future Planning**: Added comprehensive FUTURE_FEATURES.md for planned integrations

### Removed
- Gmail integration code and dependencies (moved to future features)
- Firecrawl integration code and dependencies (moved to future features)
- Secondary source command-line options
- Unused dependencies: firecrawl-py, feedparser, aiohttp, asyncio

### Added
- FUTURE_FEATURES.md with detailed roadmap for Gmail and web content integrations
- Improved error handling for web content extraction fallbacks
- Enhanced architecture documentation for v3.0 focus

### Fixed
- Pipeline runner now correctly handles drive-only source selection
- Removed references to deprecated secondary source integrations
- Updated environment variable documentation for simplified setup

### Security
- Complete removal of credentials from git history
- Added comprehensive pre-commit hooks for credential scanning
- Enhanced .gitignore with extensive credential protection patterns
- Added dependency pinning for security and reproducibility

### Documentation
- Updated all documentation to reflect v3.0.1 architecture
- Comprehensive API reference cleanup
- Enhanced troubleshooting guides
- Improved quick-start instructions for simplified setup
- Removed all temporary development files (temp/, debug_*.py, test_*.py)
- Fixed email references in documentation

## [3.0.0] - 2025-07-16

### Added
- Modular architecture with organized package structure under `src/`
- Priority-based processing with Google Drive as primary source
- 75% faster processing with streamlined AI analysis
- Proper Python packaging with `pip install -e .` installation
- Centralized configuration via `PipelineConfig.from_env()`
- Advanced enrichment modules with enhanced AI analysis
- Comprehensive test suite with 100% pass rate
- Structured JSON logging with performance metrics
- Resilient operations with built-in retry logic and graceful error handling

### Changed
- Complete refactoring from v2.0 architecture
- Enhanced AI processing with multi-step reasoning
- Improved content classification with dynamic taxonomies
- Better error handling and recovery mechanisms

### Deprecated
- Legacy newsletter module removed
- Old script-based architecture replaced with modular design

## [2.0.0] - Previous Version

Initial modular release with basic functionality.

---

## Security Policy

For security-related changes and vulnerability reporting, see [SECURITY.md](SECURITY.md).