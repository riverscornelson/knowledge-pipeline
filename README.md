# Knowledge Pipeline v2.0

A modular, priority-based content ingestion and enrichment system with Google Drive as the primary source.

## 🚀 Quick Start

```bash
# Install
pip install -e .

# Configure (copy and edit .env.example)
cp .env.example .env

# Run pipeline
python scripts/run_pipeline.py
```

## 📁 New Structure

```
knowledge-pipeline/
├── src/                    # Source code (properly packaged)
│   ├── core/              # Core functionality
│   ├── drive/             # PRIMARY: Drive ingestion
│   ├── enrichment/        # AI processing
│   ├── secondary_sources/ # Gmail, RSS, Firecrawl (lower priority)
│   ├── utils/             # Shared utilities
│   └── deprecated/        # Newsletter (to be removed)
├── scripts/               # Executable scripts
├── tests/                 # Organized test suite
├── config/                # Configuration files
├── docs/                  # Documentation
└── pyproject.toml         # Modern Python packaging
```

## 🎯 Key Improvements

1. **Drive-First Architecture**: Google Drive is now the primary content source with dedicated modules
2. **Proper Python Package**: Install with `pip install -e .` for better dependency management
3. **Modular Design**: Clear separation between ingestion, enrichment, and storage
4. **Professional Testing**: Organized test structure with pytest
5. **Centralized Config**: All configuration in `src/core/config.py`
6. **Newsletter Deprecated**: Moved to `deprecated/` folder for removal

## 🔧 Configuration

Same environment variables as before, now centrally managed:

```python
from src.core.config import PipelineConfig
config = PipelineConfig.from_env()
```

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [Migration Guide](docs/migration_guide.md)
- [API Reference](docs/api_reference.md)

## 🚦 Migration Status

- ✅ Directory structure created
- ✅ Python packaging setup
- ✅ Drive ingestion migrated
- ✅ Configuration management
- ✅ Documentation updated
- ⏳ Enrichment module migration
- ⏳ Secondary sources migration
- ⏳ Newsletter deprecation

## 🔄 Compared to v1

| Feature | v1 (Current) | v2 (New) |
|---------|--------------|----------|
| Structure | Flat, all files in root | Modular packages under `src/` |
| Priority | All sources equal | Drive primary, others secondary |
| Config | Scattered in each file | Centralized `PipelineConfig` |
| Testing | Manual test scripts | Organized pytest suite |
| Newsletter | Part of main pipeline | Deprecated, to be removed |
| Installation | Run scripts directly | `pip install -e .` |

The new structure makes Drive the clear priority while maintaining a clean, professional codebase ready for long-term maintenance and extension.