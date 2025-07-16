# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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