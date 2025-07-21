# Environment Variables Reference

Complete reference for all environment variables in Knowledge Pipeline v4.0.0.

## Core Configuration

### Notion API
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NOTION_TOKEN` | ✅ Yes | - | Notion integration token |
| `NOTION_DATABASE_ID` | ✅ Yes | - | Main content database ID |
| `NOTION_PROMPT_DB_ID` | ❌ No | - | Prompt database ID (v4.0 feature) |

### OpenAI API
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | ✅ Yes | - | OpenAI API key |
| `OPENAI_MODEL` | ❌ No | `gpt-4o-mini` | Model to use for analysis |
| `OPENAI_MAX_TOKENS` | ❌ No | `4000` | Maximum tokens per response |

### Google Drive
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_DRIVE_FOLDER_ID` | ❌ No | - | Source folder for ingestion |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | ❌ No | - | Path to service account JSON |

## Feature Flags

### v4.0 Core Features (Enabled by Default)
| Variable | Default | Options | Description |
|----------|---------|---------|-------------|
| `USE_ENHANCED_FORMATTING` | `true` | `true`/`false` | Rich Notion formatting with visual hierarchy (v4.0 standard) |
| `USE_ENHANCED_ATTRIBUTION` | `true` | `true`/`false` | Prompt attribution tracking (v4.0 standard) |
| `USE_ENHANCED_PROMPTS` | `true` | `true`/`false` | Dual-source prompt system (v4.0 standard) |
| `ENABLE_QUALITY_SCORING` | `true` | `true`/`false` | Content quality assessment (v4.0 standard) |
| `ENABLE_PROMPT_CACHING` | `true` | `true`/`false` | Performance optimization via caching |
| `ENABLE_WEB_SEARCH` | `false` | `true`/`false` | Allow web search in prompts (optional) |

**Note**: In v4.0, these features are enabled by default. Set to `false` only if you need legacy behavior.

## Performance Tuning

### Processing
| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `BATCH_SIZE` | `10` | 1-50 | Documents per batch |
| `MAX_RETRIES` | `3` | 1-5 | API retry attempts |
| `RETRY_DELAY` | `1.0` | 0.5-5.0 | Initial retry delay (seconds) |
| `RATE_LIMIT_DELAY` | `0.5` | 0.1-2.0 | Delay between API calls |

### Caching
| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `PROMPT_CACHE_TTL` | `300` | 60-3600 | Prompt cache TTL (seconds) |
| `TAG_CACHE_TTL` | `600` | 60-3600 | Tag cache TTL (seconds) |
| `CACHE_DIR` | `.cache` | - | Cache directory path |

### Memory Management
| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `MAX_CHUNK_SIZE` | `1900` | 500-2000 | Max chars per text block |
| `MAX_BLOCKS_PER_TOGGLE` | `100` | 10-100 | Notion API limit |
| `MEMORY_LIMIT_MB` | `512` | 256-2048 | Process memory limit |

## Logging and Monitoring

| Variable | Default | Options | Description |
|----------|---------|---------|-------------|
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR` | Logging verbosity |
| `LOG_FILE` | `pipeline.log` | - | Log file path |
| `LOG_FORMAT` | `standard` | `standard`/`json` | Log output format |
| `ENABLE_METRICS` | `false` | `true`/`false` | Performance metrics collection |

## Security

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKEN_STORAGE_PATH` | `~/.config/knowledge-pipeline/` | Secure token storage location |
| `ENCRYPT_TOKENS` | `false` | Enable token encryption at rest |
| `API_KEY_ROTATION_DAYS` | `90` | Days before key rotation warning |

## Development

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG_MODE` | `false` | Enable debug features |
| `DRY_RUN` | `false` | Simulate processing without writes |
| `TEST_MODE` | `false` | Use test databases |
| `MOCK_AI_RESPONSES` | `false` | Use mock responses (testing) |

## Migration

| Variable | Default | Description |
|----------|---------|-------------|
| `MIGRATION_MODE` | `auto` | `auto`/`manual`/`skip` |
| `PRESERVE_V3_BEHAVIOR` | `false` | Keep v3.x compatibility |
| `PROMPT_SOURCE_PRIORITY` | `notion` | `notion`/`yaml`/`both` |

## Example .env File

```bash
# Core Configuration
NOTION_TOKEN=secret_AbCdEfGhIjKlMnOpQrStUvWxYz
NOTION_DATABASE_ID=12345678-1234-1234-1234-123456789012
NOTION_PROMPT_DB_ID=87654321-4321-4321-4321-210987654321
OPENAI_API_KEY=sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ

# Optional: Google Drive
GOOGLE_DRIVE_FOLDER_ID=1ABC2DEF3GHI4JKL5MNO6PQR7STU8VWX
GOOGLE_SERVICE_ACCOUNT_FILE=credentials/service-account.json

# v4.0 Core Features (enabled by default, shown for reference)
# USE_ENHANCED_FORMATTING=true      # Already enabled by default
# USE_ENHANCED_ATTRIBUTION=true     # Already enabled by default  
# USE_ENHANCED_PROMPTS=true         # Already enabled by default
# ENABLE_QUALITY_SCORING=true       # Already enabled by default
# ENABLE_PROMPT_CACHING=true        # Already enabled by default

# Optional Features
ENABLE_WEB_SEARCH=false             # Enable if needed for research

# Performance Tuning
BATCH_SIZE=20
RATE_LIMIT_DELAY=0.5
PROMPT_CACHE_TTL=600
TAG_CACHE_TTL=1200

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/pipeline.log

# Development (remove in production)
DEBUG_MODE=false
DRY_RUN=false
```

## Environment-Specific Configurations

### Production
```bash
LOG_LEVEL=WARNING
BATCH_SIZE=50
ENABLE_METRICS=true
RATE_LIMIT_DELAY=1.0
```

### Development
```bash
LOG_LEVEL=DEBUG
BATCH_SIZE=5
DRY_RUN=true
MOCK_AI_RESPONSES=true
```

### Testing
```bash
TEST_MODE=true
NOTION_DATABASE_ID=test-database-id
MOCK_AI_RESPONSES=true
LOG_LEVEL=DEBUG
```