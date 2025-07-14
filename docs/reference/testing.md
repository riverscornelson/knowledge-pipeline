# Testing Documentation

## Overview

The Knowledge Pipeline project includes a comprehensive test suite that validates all core functionality. The tests are organized into unit tests for individual components and integration tests for end-to-end workflows.

## Test Statistics

- **Total Tests**: 49
- **Pass Rate**: 100%
- **Code Coverage**: 38% overall (94-100% for core modules)
- **Test Categories**: Unit tests, Integration tests, Simple integration tests

## Running Tests

### Run All Tests
```bash
python -m pytest
```

### Run with Coverage Report
```bash
python -m pytest --cov=src --cov-report=html
```

### Run Specific Test Categories
```bash
# Core module tests only
python -m pytest tests/core/

# Drive integration tests
python -m pytest tests/drive/

# Enrichment tests
python -m pytest tests/enrichment/

# Integration tests
python -m pytest tests/test_integration.py
```

### Run with Verbose Output
```bash
python -m pytest -v
```

## Test Organization

```
tests/
├── conftest.py              # Shared fixtures and test configuration
├── core/                    # Core module unit tests
│   ├── test_config.py       # Configuration tests (7 tests)
│   ├── test_models.py       # Data model tests (7 tests)
│   └── test_notion_client.py # Notion client tests (6 tests)
├── drive/                   # Drive integration tests
│   ├── test_ingester.py     # Drive ingester tests (6 tests)
│   └── test_pdf_processor.py # PDF processor tests (3 tests)
├── enrichment/              # AI enrichment tests
│   ├── test_classifier.py   # Content classifier tests (5 tests)
│   ├── test_processor.py    # Enrichment processor tests (4 tests)
│   └── test_summarizer.py   # Content summarizer tests (4 tests)
├── fixtures/                # Test data files
│   └── test.pdf            # Sample PDF for testing
├── test_integration.py      # End-to-end integration tests (3 tests)
└── test_simple_integration.py # Simple integration tests (4 tests)
```

## Key Test Fixtures

The `conftest.py` file provides reusable fixtures for all tests:

### Configuration Fixtures
- `mock_env_vars`: Sets up environment variables for testing
- `mock_config`: Provides a complete `PipelineConfig` instance
- `mock_openai_client`: Mocked OpenAI client

### Data Fixtures
- `sample_pdf_content`: Sample PDF text content
- `sample_notion_page`: Example Notion page structure
- `sample_drive_file`: Mock Google Drive file metadata

### Service Fixtures
- `mock_notion_client`: Mocked Notion client
- `mock_drive_service`: Mocked Google Drive service

## Testing Patterns

### 1. External Service Mocking

All external services are mocked to ensure tests run locally without credentials:

```python
# Example: Mocking Google Drive
with patch('src.drive.ingester.build') as mock_build:
    mock_build.return_value = mock_drive_service
    # Test code here
```

### 2. Configuration Testing

Tests verify that configuration loads correctly from environment variables:

```python
def test_config_from_env(mock_env_vars):
    config = PipelineConfig.from_env()
    assert config.notion.token == "test-notion-token"
```

### 3. API Response Mocking

OpenAI and other API responses are mocked with realistic data:

```python
mock_openai_client.chat.completions.create.return_value = Mock(
    choices=[Mock(message=Mock(content="AI generated response"))]
)
```

### 4. Error Handling Tests

Tests verify graceful error handling:

```python
def test_extract_text_handles_errors(self):
    with patch('src.drive.pdf_processor.extract_text') as mock_extract:
        mock_extract.side_effect = Exception("PDF parsing error")
        text = processor.extract_text_from_pdf(b"invalid pdf")
        assert text is None
```

## Coverage Details

### High Coverage Modules (94-100%)
- `src.core.config` - Configuration management
- `src.core.models` - Data models
- `src.drive.ingester` - Drive file ingestion
- `src.enrichment.classifier` - Content classification

### Moderate Coverage Modules (50-80%)
- `src.core.notion_client` - Notion API client
- `src.enrichment.processor` - Enrichment orchestration
- `src.enrichment.summarizer` - Content summarization
- `src.drive.pdf_processor` - PDF text extraction

### Low/No Coverage Modules
- Secondary sources (Gmail, Firecrawl) - Not included in initial test scope
- Utility modules (markdown, resilience) - Not included in initial test scope

## Writing New Tests

### Test Structure Template

```python
class TestComponentName:
    """Test ComponentName functionality."""
    
    def test_create_component(self):
        """Test creating ComponentName instance."""
        # Arrange
        mock_dependency = Mock()
        
        # Act
        component = ComponentName(mock_dependency)
        
        # Assert
        assert component is not None
        assert component.dependency == mock_dependency
    
    def test_component_method(self, fixture_name):
        """Test specific method behavior."""
        # Test implementation
```

### Mocking Guidelines

1. **Mock at boundaries** - Mock external services, not internal components
2. **Use fixtures** - Reuse common mocks via fixtures
3. **Verify calls** - Use `assert_called_with()` to verify correct API usage
4. **Return realistic data** - Mock responses should match real API responses

### Assertion Best Practices

1. **Be specific** - Assert exact values, not just truthiness
2. **Test edge cases** - Include tests for error conditions
3. **One assertion per test** - Keep tests focused
4. **Use descriptive names** - Test names should explain what they verify

## Continuous Integration

The test suite is designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions configuration
- name: Run tests
  run: |
    pip install -e .
    python -m pytest --cov=src --cov-report=xml
    
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Troubleshooting Tests

### Common Issues

1. **Import Errors**
   - Ensure the package is installed: `pip install -e .`
   - Check that `__init__.py` files exist in all packages

2. **Mock Assertion Failures**
   - Verify the exact method names and signatures
   - Check mock call counts match expectations

3. **Fixture Not Found**
   - Ensure fixtures are defined in `conftest.py` or the test file
   - Check fixture scope (function, class, module, session)

### Debugging Tips

1. **Use pytest -vv** for very verbose output
2. **Add breakpoints**: `import pdb; pdb.set_trace()`
3. **Print mock calls**: `print(mock_object.mock_calls)`
4. **Check coverage gaps**: `pytest --cov=src --cov-report=term-missing`

## Future Testing Improvements

### Recommended Additions

1. **Performance Tests** - Add benchmarks for processing times
2. **Secondary Sources** - Test Gmail and Firecrawl integrations
3. **Utility Coverage** - Add tests for markdown and resilience utilities
4. **Property-Based Tests** - Use hypothesis for edge case discovery
5. **Contract Tests** - Validate API response formats

### Testing Goals

- Maintain 100% test pass rate
- Increase overall coverage to 80%+
- Add performance regression tests
- Implement mutation testing
- Add integration tests with test databases