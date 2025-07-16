# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- Complete removal of credentials from git history
- Added comprehensive pre-commit hooks for credential scanning
- Enhanced .gitignore with extensive credential protection patterns
- Added dependency pinning for security and reproducibility

### Added
- Pre-commit hooks for automated code quality and security checks
- Comprehensive dependency version pinning in requirements.txt
- Enhanced contributing guidelines with security tools
- Automated credential scanning with detect-secrets
- Security linting with bandit
- Development tools for pip-audit vulnerability scanning

### Changed
- Updated contact information to personal email (rivers.cornelson@gmail.com)
- Changed homepage URL to LinkedIn profile
- Enhanced .gitignore for better protection against credential leaks
- Cleaned up temporary and debug files from repository

### Fixed
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