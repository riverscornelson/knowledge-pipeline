# Testing Guide - Knowledge Pipeline v4.0.0

This document provides comprehensive information about testing the Knowledge Pipeline, including how to run tests, coverage requirements, and guidelines for adding new tests.

## Overview

The Knowledge Pipeline uses `pytest` as the primary testing framework, with comprehensive test coverage across all core modules including:

- **Core functionality**: Configuration, models, Notion client
- **Drive integration**: PDF processing, file ingestion, deduplication  
- **Enrichment pipeline**: Content analysis, AI processing, prompt management
- **Formatting**: Notion content formatting, attribution tracking
- **CLI interface**: Command-line argument parsing and pipeline execution
- **Integration tests**: End-to-end workflow validation

## Quick Start

### Running All Tests

```bash
# Run all tests with coverage
python -m pytest --cov=src --cov-report=term-missing

# Run tests in parallel (faster)
python -m pytest -n auto

# Run with verbose output
python -m pytest -v
```

### Running Specific Test Suites

```bash
# Core functionality
python -m pytest tests/core/ -v

# Drive ingestion
python -m pytest tests/drive/ -v

# Enrichment pipeline
python -m pytest tests/enrichment/ -v

# CLI functionality
python -m pytest tests/test_cli.py -v

# Integration tests
python -m pytest tests/test_integration.py -v
```

### Running Individual Tests

```bash
# Single test file
python -m pytest tests/core/test_config.py -v

# Single test class
python -m pytest tests/core/test_config.py::TestPipelineConfig -v

# Single test method
python -m pytest tests/core/test_config.py::TestPipelineConfig::test_config_from_env -v
```

## Test Structure

### Test Directory Layout

```
tests/
├── conftest.py                     # Shared fixtures and configuration
├── test_cli.py                     # CLI functionality tests
├── test_integration.py             # End-to-end integration tests
├── core/                           # Core functionality tests
│   ├── test_config.py             # Configuration management
│   ├── test_models.py             # Data models
│   └── test_notion_client.py      # Notion API client
├── drive/                         # Drive integration tests
│   ├── test_deduplication.py     # File deduplication
│   ├── test_ingester.py          # Drive file ingestion
│   └── test_pdf_processor.py     # PDF text extraction
├── enrichment/                    # AI enrichment tests
│   ├── test_base_analyzer.py     # Base analysis functionality
│   ├── test_content_tagger.py    # Content classification
│   ├── test_processor.py         # Pipeline processing
│   └── test_prompt_config.py     # Prompt management
├── formatters/                    # Content formatting tests
│   ├── test_formatter_integration.py
│   └── test_prompt_aware_notion_formatter.py
└── fixtures/                      # Test data files
    └── test.pdf
```

### Shared Fixtures

The `conftest.py` file provides shared test fixtures:

- **Mock clients**: Pre-configured mocks for Notion, OpenAI, and Google Drive
- **Sample data**: Representative content objects and responses
- **Configuration**: Test-specific pipeline configurations
- **Environment**: Automated environment variable management

## Test Coverage Requirements

### Coverage Targets

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Current Coverage Status

As of the latest run, the test suite includes:
- **122 total tests**: 117 passing, 5 failing (96% pass rate)
- **34% overall coverage**: Requires improvement to meet targets
- **High coverage areas**: Core configuration (93%), deduplication (99%), content tagging (99%)
- **Low coverage areas**: Many enrichment and formatting modules need additional tests

### Generating Coverage Reports

```bash
# Terminal report
python -m pytest --cov=src --cov-report=term-missing

# HTML report (opens in browser)
python -m pytest --cov=src --cov-report=html
open htmlcov/index.html

# XML report (for CI/CD)
python -m pytest --cov=src --cov-report=xml
```

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual functions and classes in isolation

**Characteristics**:
- Fast execution (< 100ms per test)
- No external dependencies (mocked)
- Single responsibility focus
- Predictable and repeatable

**Examples**:
```python
def test_calculate_hash():
    """Test hash calculation for content deduplication."""
    dedup = DeduplicationService()
    hash1 = dedup.calculate_hash("test content")
    hash2 = dedup.calculate_hash("test content")
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA-256 hex
```

### 2. Integration Tests

**Purpose**: Test component interactions and workflows

**Characteristics**:
- Medium execution time (< 5 seconds)
- Mocked external APIs
- Multiple component interaction
- Realistic data flows

**Examples**:
```python
def test_drive_to_enrichment_flow():
    """Test complete flow from Drive ingestion to enrichment."""
    # Setup mocked components
    # Execute full pipeline
    # Verify end-to-end behavior
```

### 3. CLI Tests

**Purpose**: Test command-line interface and argument parsing

**Characteristics**:
- Argument validation
- Error handling
- Process flow control
- Configuration loading

**Examples**:
```python
def test_dry_run_mode():
    """Test that dry run prevents actual operations."""
    # Mock sys.argv with --dry-run
    # Verify no actual changes made
```

### 4. Performance Tests

**Purpose**: Verify performance requirements are met

**Examples**:
```python
def test_large_batch_processing():
    """Test processing 1000+ items within time limits."""
    start = time.time()
    process_batch(generate_items(1000))
    duration = time.time() - start
    assert duration < 10.0  # 10 second limit
```

## Writing New Tests

### Test Naming Conventions

- **Files**: `test_*.py` or `*_test.py`
- **Classes**: `Test<ComponentName>`
- **Methods**: `test_<specific_behavior>`
- **Fixtures**: `mock_<component>` or `sample_<data>`

### Test Structure (AAA Pattern)

```python
def test_specific_behavior(self):
    """Test description explaining what and why."""
    # Arrange: Set up test conditions
    config = PipelineConfig(...)
    processor = Processor(config)
    
    # Act: Execute the behavior
    result = processor.process(input_data)
    
    # Assert: Verify expected outcomes
    assert result.status == "success"
    assert len(result.items) == 5
```

### Best Practices

1. **Descriptive Test Names**: Clearly communicate intent
   ```python
   # Good
   def test_skips_duplicate_files_when_hash_exists(self):
   
   # Bad
   def test_deduplication(self):
   ```

2. **Single Assertion Principle**: One logical assertion per test
   ```python
   # Good
   def test_creates_notion_page_with_correct_title(self):
       page = create_page(title="Test")
       assert page.title == "Test"
   
   def test_creates_notion_page_with_inbox_status(self):
       page = create_page(title="Test") 
       assert page.status == "Inbox"
   
   # Bad
   def test_creates_notion_page(self):
       page = create_page(title="Test")
       assert page.title == "Test"
       assert page.status == "Inbox"  # Multiple concerns
   ```

3. **Mock External Dependencies**: Isolate code under test
   ```python
   @patch('src.core.notion_client.NotionClient')
   def test_processor_handles_notion_errors(self, mock_notion):
       mock_notion.create_page.side_effect = Exception("API Error")
       # Test error handling behavior
   ```

4. **Use Fixtures for Common Setup**: Reduce duplication
   ```python
   @pytest.fixture
   def processor_with_config():
       config = PipelineConfig.from_env()
       return PipelineProcessor(config)
   
   def test_batch_processing(self, processor_with_config):
       # Use configured processor
   ```

### Testing Error Conditions

Always test both success and failure scenarios:

```python
def test_handles_invalid_configuration(self):
    """Test graceful handling of invalid config."""
    with pytest.raises(ValidationError):
        PipelineConfig.from_dict({"invalid": "config"})

def test_recovers_from_network_timeout(self):
    """Test resilience to network issues."""
    with patch('requests.get') as mock_get:
        mock_get.side_effect = requests.Timeout()
        result = fetch_with_retry(url)
        assert result.status == "retry_exhausted"
```

### Testing Async Code

```python
import pytest
import asyncio

@pytest.mark.asyncio
async def test_async_processing():
    """Test asynchronous content processing."""
    processor = AsyncProcessor()
    result = await processor.process_async(content)
    assert result.status == "completed"
```

## Continuous Integration

### Pre-commit Testing

Run before every commit:
```bash
# Quick test run
python -m pytest tests/core/ tests/drive/

# Full test suite (if time allows)
python -m pytest --maxfail=5
```

### CI/CD Pipeline Testing

The CI pipeline should run:

1. **Lint and Format Check**:
   ```bash
   black --check src tests
   flake8 src tests
   mypy src
   ```

2. **Full Test Suite**:
   ```bash
   python -m pytest --cov=src --cov-report=xml --junitxml=pytest.xml
   ```

3. **Coverage Validation**:
   ```bash
   # Fail if coverage below threshold
   python -m pytest --cov=src --cov-fail-under=80
   ```

### Environment-Specific Testing

```bash
# Test with minimal dependencies
python -m pytest tests/core/

# Test with optional dependencies
pip install -e .[dev]
python -m pytest

# Test multiple Python versions
tox
```

## Debugging Test Failures

### Common Issues and Solutions

1. **Import Errors**:
   ```bash
   # Ensure package is installed in development mode
   pip install -e .
   
   # Check PYTHONPATH includes project root
   export PYTHONPATH=/path/to/knowledge-pipeline:$PYTHONPATH
   ```

2. **Mock Errors**:
   ```python
   # Mock at the right location
   @patch('module.where.used.ClassName')  # Not where defined
   ```

3. **Fixture Dependency Issues**:
   ```python
   # Check fixture scope and dependencies
   @pytest.fixture(scope="session")  # Shared across tests
   @pytest.fixture(scope="function")  # New instance per test
   ```

4. **Environment Variable Pollution**:
   ```python
   # Always clean up environment changes
   def test_with_env_var(self):
       os.environ["TEST_VAR"] = "value"
       try:
           # Test logic
       finally:
           del os.environ["TEST_VAR"]
   ```

### Debugging Commands

```bash
# Drop into debugger on failure
python -m pytest --pdb

# Show all print statements
python -m pytest -s

# Run only failed tests from last run
python -m pytest --lf

# Stop on first failure
python -m pytest -x

# Verbose output with reasons
python -m pytest -vvv --tb=long
```

## Performance Testing

### Benchmark Tests

```python
import time
import pytest

def test_processing_performance():
    """Ensure batch processing meets performance requirements."""
    items = generate_test_items(1000)
    
    start = time.time()
    result = process_batch(items)
    duration = time.time() - start
    
    # Should process 1000 items in under 5 seconds
    assert duration < 5.0
    assert result.success_count == 1000
```

### Memory Usage Tests

```python
import psutil
import gc

def test_memory_usage_within_limits():
    """Test memory doesn't grow excessively during processing."""
    process = psutil.Process()
    initial_memory = process.memory_info().rss
    
    # Process large dataset
    for i in range(100):
        process_large_item(generate_large_item())
        if i % 10 == 0:
            gc.collect()  # Force garbage collection
    
    final_memory = process.memory_info().rss
    memory_increase = final_memory - initial_memory
    
    # Should not increase memory by more than 100MB
    assert memory_increase < 100 * 1024 * 1024
```

## Test Data Management

### Using Test Fixtures

Store test data in `tests/fixtures/`:
- `test.pdf`: Sample PDF for processing tests
- `sample_content.json`: Representative content objects
- `mock_responses/`: API response samples

### Generating Test Data

```python
def generate_test_content(count=10):
    """Generate test content objects."""
    return [
        SourceContent(
            title=f"Test Document {i}",
            content=f"Test content {i}" * 100,
            hash=f"hash{i:04d}"
        )
        for i in range(count)
    ]
```

## Security Testing

### Testing Sensitive Data Handling

```python
def test_api_keys_not_logged():
    """Ensure API keys don't appear in logs."""
    with patch('logging.Logger.info') as mock_log:
        config = PipelineConfig(openai_api_key="secret-key")
        setup_openai_client(config)
        
        # Check all log calls
        for call in mock_log.call_args_list:
            assert "secret-key" not in str(call)
```

### Input Validation Tests

```python
def test_rejects_malicious_input():
    """Test protection against injection attacks."""
    malicious_inputs = [
        "'; DROP TABLE users; --",
        "<script>alert('xss')</script>",
        "../../../etc/passwd"
    ]
    
    for malicious_input in malicious_inputs:
        with pytest.raises(ValidationError):
            validate_user_input(malicious_input)
```

## Troubleshooting

### Common Test Environment Issues

1. **Missing Dependencies**:
   ```bash
   pip install -e .[dev]  # Install development dependencies
   ```

2. **Permission Errors**:
   ```bash
   chmod +x scripts/run_tests.sh
   ```

3. **Path Issues**:
   ```bash
   export PYTHONPATH=$PWD:$PYTHONPATH
   python -m pytest
   ```

4. **Port Conflicts**:
   ```python
   # Use dynamic ports in tests
   import socket
   sock = socket.socket()
   sock.bind(('', 0))
   port = sock.getsockname()[1]
   sock.close()
   ```

### Getting Help

- **pytest documentation**: https://docs.pytest.org/
- **Coverage.py documentation**: https://coverage.readthedocs.io/
- **Mock documentation**: https://docs.python.org/3/library/unittest.mock.html
- **Project issues**: File issues for test-related problems on the project repository

## Contributing Tests

When contributing new features:

1. **Write tests first** (TDD approach)
2. **Maintain coverage** above 80%
3. **Include both positive and negative test cases**
4. **Update this documentation** if adding new test patterns
5. **Run full test suite** before submitting PR

### Pull Request Test Requirements

- [ ] All tests pass
- [ ] Coverage requirements met
- [ ] New features have corresponding tests
- [ ] Test names are descriptive
- [ ] No test pollution (clean up resources)
- [ ] Performance tests included for performance-critical features