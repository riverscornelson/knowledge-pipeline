#!/usr/bin/env python3
"""
Production Readiness Validation Script for Knowledge Pipeline v4.0.0
"""
import sys
import os
import importlib.util
from pathlib import Path

def validate_imports():
    """Test that all critical imports work."""
    print("🧪 Testing imports...")
    
    # Add src to path like run_pipeline.py does
    sys.path.insert(0, str(Path(__file__).parent / 'src'))
    
    try:
        from core.config import PipelineConfig, NotionConfig, GoogleDriveConfig, OpenAIConfig
        from core.notion_client import NotionClient
        from core.models import SourceContent, ContentStatus, ContentType
        from drive.ingester import DriveIngester
        from enrichment.pipeline_processor import PipelineProcessor
        from local_uploader.preprocessor import process_local_pdfs
        from utils.logging import setup_logger
        print("✅ All critical imports successful")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def validate_configuration():
    """Test configuration loading with example environment."""
    print("🧪 Testing configuration...")
    
    # Mock required environment variables
    test_env = {
        'OPENAI_API_KEY': 'test_openai_key',
        'NOTION_TOKEN': 'test_notion_token', 
        'NOTION_SOURCES_DB': 'test_sources_db_id',
        'GOOGLE_APP_CREDENTIALS': '/tmp/test-service-account.json'
    }
    
    original_env = {}
    for key, value in test_env.items():
        original_env[key] = os.environ.get(key)
        os.environ[key] = value
    
    try:
        sys.path.insert(0, str(Path(__file__).parent / 'src'))
        from core.config import PipelineConfig
        config = PipelineConfig.from_env()
        print("✅ Configuration loading successful")
        
        # Restore environment
        for key, value in original_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        
        return True
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return False

def validate_cli_commands():
    """Test CLI command structure."""
    print("🧪 Testing CLI commands...")
    
    try:
        import scripts.run_pipeline
        print("✅ Main pipeline script importable")
        
        # Test argparse structure by calling help
        import subprocess
        result = subprocess.run([sys.executable, 'scripts/run_pipeline.py', '--help'], 
                              capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0 and 'Knowledge Pipeline Runner' in result.stdout:
            print("✅ CLI help output correct")
            return True
        else:
            print("❌ CLI help test failed")
            return False
            
    except Exception as e:
        print(f"❌ CLI test error: {e}")
        return False

def validate_dependencies():
    """Check all required dependencies are installed."""
    print("🧪 Testing dependencies...")
    
    required_packages = [
        ('notion_client', 'notion-client'),
        ('openai', 'openai'),
        ('googleapiclient', 'google-api-python-client'),
        ('google.oauth2', 'google-auth'),
        ('pdfminer', 'pdfminer.six'),
        ('dotenv', 'python-dotenv'),
        ('tenacity', 'tenacity'),
        ('tiktoken', 'tiktoken'),
        ('bs4', 'beautifulsoup4'),
        ('requests', 'requests'),
        ('yaml', 'pyyaml'),
        ('markdown', 'markdown')
    ]
    
    missing = []
    for module, package in required_packages:
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(package)
    
    if missing:
        print(f"❌ Missing dependencies: {', '.join(missing)}")
        return False
    else:
        print("✅ All dependencies available")
        return True

def validate_file_structure():
    """Check required files and directories exist."""
    print("🧪 Testing file structure...")
    
    required_files = [
        'scripts/run_pipeline.py',
        'src/core/config.py',
        'src/core/notion_client.py',
        'src/drive/ingester.py',
        'src/enrichment/pipeline_processor.py',
        'src/local_uploader/preprocessor.py',
        'pyproject.toml',
        '.env.example',
        'requirements.txt'
    ]
    
    missing = []
    for file_path in required_files:
        if not Path(file_path).exists():
            missing.append(file_path)
    
    if missing:
        print(f"❌ Missing files: {', '.join(missing)}")
        return False
    else:
        print("✅ All required files present")
        return True

def validate_environment_variables():
    """Check .env.example has all required variables."""
    print("🧪 Testing environment variables...")
    
    required_vars = [
        'OPENAI_API_KEY',
        'NOTION_TOKEN', 
        'NOTION_SOURCES_DB',
        'GOOGLE_APP_CREDENTIALS'
    ]
    
    env_example = Path('.env.example').read_text()
    missing = []
    
    for var in required_vars:
        if var not in env_example:
            missing.append(var)
    
    if missing:
        print(f"❌ Missing environment variables in .env.example: {', '.join(missing)}")
        return False
    else:
        print("✅ All required environment variables documented")
        return True

def main():
    """Run all validation tests."""
    print("🚀 Knowledge Pipeline v4.0.0 Production Validation")
    print("=" * 50)
    
    tests = [
        validate_file_structure,
        validate_dependencies,
        validate_environment_variables,
        validate_imports,
        validate_configuration,
        validate_cli_commands,
    ]
    
    results = []
    for test in tests:
        result = test()
        results.append(result)
        print()
    
    passed = sum(results)
    total = len(results)
    
    print(f"📊 Validation Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ✅ Pipeline is PRODUCTION READY!")
        return 0
    else:
        print("⚠️ ❌ Pipeline has issues that need to be resolved before production.")
        return 1

if __name__ == "__main__":
    sys.exit(main())