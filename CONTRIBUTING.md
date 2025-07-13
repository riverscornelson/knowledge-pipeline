# Contributing to Knowledge Pipeline

Thank you for your interest in contributing to the Knowledge Pipeline! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Contributions](#making-contributions)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and considerate in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/knowledge-pipeline.git
   cd knowledge-pipeline
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/riverscornelson/knowledge-pipeline.git
   ```

## Development Setup

### Prerequisites

- Python 3.8 or higher (3.11+ recommended)
- pip and virtualenv
- Git

### Environment Setup

1. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install the package in development mode**:
   ```bash
   pip install -e .[dev]
   ```

3. **Copy environment configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your test credentials
   ```

### Running the Pipeline Locally

```bash
# Test your changes
python scripts/run_pipeline.py --dry-run

# Run with specific source
python scripts/run_pipeline.py --source drive
```

## Making Contributions

### Types of Contributions

We welcome many types of contributions:

- **Bug fixes**: Fix issues reported in GitHub Issues
- **Features**: Add new functionality or enhance existing features
- **Documentation**: Improve or expand documentation
- **Tests**: Add missing tests or improve test coverage
- **Performance**: Optimize code for better performance
- **Refactoring**: Improve code quality and maintainability

### Before You Start

1. **Check existing issues** to see if someone is already working on it
2. **Open an issue** to discuss significant changes before starting work
3. **For small fixes** (typos, obvious bugs), you can submit a PR directly

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, readable code
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```
   
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation changes
   - `test:` test additions/changes
   - `refactor:` code refactoring
   - `style:` formatting changes
   - `chore:` maintenance tasks

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill out the PR template
   - Link any related issues

### PR Requirements

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New code has appropriate test coverage
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] PR description clearly explains changes

## Coding Standards

### Python Style

- Follow [PEP 8](https://pep8.org/)
- Use type hints for all function signatures
- Maximum line length: 88 characters (Black default)
- Use meaningful variable and function names

### Code Quality Tools

```bash
# Format code with Black
black src/ scripts/

# Sort imports
isort src/ scripts/

# Type checking
mypy src/

# Linting
flake8 src/ scripts/
```

### Docstrings

All public modules, classes, and functions must have docstrings:

```python
def process_content(content: str, title: str) -> Dict[str, Any]:
    """
    Process content and extract insights.
    
    Args:
        content: The raw content to process
        title: Content title for context
        
    Returns:
        Dictionary containing processed results
        
    Raises:
        ValueError: If content is empty
    """
```

## Testing

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test file
pytest tests/test_drive/test_ingester.py
```

### Writing Tests

- Place tests in `tests/` directory mirroring `src/` structure
- Use descriptive test names: `test_should_extract_text_from_valid_pdf`
- Include both positive and negative test cases
- Mock external dependencies (APIs, file system)
- Aim for >80% code coverage on new code

Example test:

```python
def test_pipeline_config_from_env(monkeypatch):
    """Test loading configuration from environment variables."""
    monkeypatch.setenv("NOTION_TOKEN", "test-token")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    
    config = PipelineConfig.from_env()
    
    assert config.notion.token == "test-token"
    assert config.openai.api_key == "test-key"
```

## Documentation

### Types of Documentation

1. **Code Documentation**: Docstrings and inline comments
2. **User Documentation**: In `docs/` directory
3. **API Documentation**: Generated from docstrings
4. **README**: Project overview and quick start

### Documentation Standards

- Use clear, concise language
- Include code examples where helpful
- Keep documentation up-to-date with code changes
- Use proper markdown formatting
- Check links are not broken

## Community

### Getting Help

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Email**: Contact rivers@cornelson.com for sensitive matters

### Recognition

Contributors will be recognized in:
- GitHub contributors graph
- CONTRIBUTORS.md file (for significant contributions)
- Release notes

## Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort in improving the Knowledge Pipeline!

---

*Happy coding! 🚀*