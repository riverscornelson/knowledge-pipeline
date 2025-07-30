# Product Requirements Document: Google Drive Deeplink-Based Deduplication

## Executive Summary

This PRD defines the requirements for replacing the current SHA-256 hash-based deduplication system in the Knowledge Pipeline with a Google Drive deeplink-based deduplication approach. This change will improve deduplication reliability by using persistent, unique identifiers that remain constant even when file content changes.

## Problem Statement

### Current State
- The system uses SHA-256 hashes calculated from file content for deduplication
- Hash calculation requires downloading entire files, impacting performance
- Content-based hashing prevents tracking file updates (same file with updated content gets new hash)
- The system maintains both file IDs and hashes but primarily relies on hashes for deduplication

### Issues with Current Approach
1. **Performance Impact**: Every deduplication check requires downloading and hashing file content
2. **Update Detection**: Cannot distinguish between duplicates and legitimate updates to existing files
3. **Storage Inefficiency**: Stores redundant hash values when Drive already provides unique identifiers
4. **Inconsistent State**: Mix of ID-based and hash-based checking creates complexity

### Proposed Solution
Use Google Drive deeplinks (webViewLink) as the primary deduplication mechanism, leveraging Drive's built-in unique identifiers that persist across file moves, renames, and content updates.

## Requirements

### Functional Requirements

#### FR1: Deeplink as Primary Identifier
- **FR1.1**: Extract and store the complete Google Drive deeplink (webViewLink) for each file
- **FR1.2**: Use deeplink as the primary deduplication key instead of content hash
- **FR1.3**: Maintain the ability to extract file ID from deeplink for API operations
- **FR1.4**: Support both full deeplink and extracted file ID for deduplication checks

#### FR2: Backward Compatibility
- **FR2.1**: Continue to store hash values for existing records (read-only)
- **FR2.2**: Support deduplication against both old hash-based and new deeplink-based records
- **FR2.3**: Provide migration path for existing data without reprocessing
- **FR2.4**: Maintain existing Notion database schema with graceful degradation

#### FR3: Robustness and Error Handling
- **FR3.1**: Handle cases where deeplink is unavailable or malformed
- **FR3.2**: Fallback to hash-based deduplication when deeplink is missing
- **FR3.3**: Validate deeplink format before storage
- **FR3.4**: Log all deduplication decisions for debugging

#### FR4: Performance Optimization
- **FR4.1**: Eliminate unnecessary file downloads for deduplication
- **FR4.2**: Cache deeplink lookups within processing session
- **FR4.3**: Batch deduplication checks for efficiency
- **FR4.4**: Maintain or improve current processing speed (6-10 minutes for batches)

### Non-Functional Requirements

#### NFR1: Architecture Compliance
- **NFR1.1**: Maintain separation of concerns between drive/, core/, and enrichment/ modules
- **NFR1.2**: Follow existing configuration-driven design patterns
- **NFR1.3**: Preserve modular architecture for future migration
- **NFR1.4**: Use dependency injection for deduplication service

#### NFR2: Testing Requirements
- **NFR2.1**: Maintain current test coverage levels (94-100% for core modules)
- **NFR2.2**: Add specific tests for deeplink extraction and validation
- **NFR2.3**: Include migration scenario tests
- **NFR2.4**: Test fallback mechanisms thoroughly

#### NFR3: Data Integrity
- **NFR3.1**: Ensure no data loss during migration
- **NFR3.2**: Maintain audit trail of deduplication decisions
- **NFR3.3**: Support rollback if issues detected
- **NFR3.4**: Preserve all existing metadata

## Technical Specification

### Architecture Changes

#### 1. Deduplication Service Refactor

**Location**: `src/drive/deduplication.py`

```python
class DeduplicationService:
    """Enhanced deduplication service using deeplinks as primary identifier."""
    
    def __init__(self, use_deeplink_dedup: bool = True, fallback_to_hash: bool = True):
        self.use_deeplink_dedup = use_deeplink_dedup
        self.fallback_to_hash = fallback_to_hash
        self._deeplink_cache = {}
        
    def extract_file_id_from_deeplink(self, deeplink: str) -> Optional[str]:
        """Extract Google Drive file ID from deeplink URL."""
        
    def normalize_deeplink(self, deeplink: str) -> str:
        """Normalize deeplink for consistent comparison."""
        
    def check_duplicate_by_deeplink(self, deeplink: str, known_deeplinks: Set[str]) -> bool:
        """Check if deeplink already exists."""
        
    def calculate_hash(self, content: bytes) -> str:
        """Legacy hash calculation for backward compatibility."""
```

#### 2. Drive Ingester Updates

**Location**: `src/drive/ingester.py`

Key changes:
- Modify `get_existing_drive_files()` to return deeplinks instead of just IDs
- Update `process_file()` to prioritize deeplink deduplication
- Add configuration flag for deduplication strategy
- Implement lazy hash calculation only when needed

#### 3. Notion Client Updates

**Location**: `src/core/notion_client.py`

Key changes:
- Add `get_existing_deeplinks()` method
- Update `check_duplicate_exists()` to support both hash and deeplink checks
- Maintain backward compatibility in `get_existing_drive_files()`

#### 4. Model Updates

**Location**: `src/core/models.py`

```python
@dataclass
class SourceContent:
    # Existing fields remain unchanged
    # Add new optional field
    deeplink_normalized: Optional[str] = None  # Normalized deeplink for deduplication
    
    def to_notion_properties(self) -> Dict[str, Any]:
        # Existing implementation
        # Store normalized deeplink in Hash field for new records
```

### Configuration Changes

**Location**: `src/core/config.py`

```python
@dataclass
class GoogleDriveConfig:
    # Existing fields
    use_deeplink_deduplication: bool = True
    fallback_to_hash_dedup: bool = True
    calculate_content_hash: bool = False  # Only for legacy support
```

### Database Schema

No schema changes required. The system will:
1. Continue using the existing "Hash" field
2. Store normalized deeplinks in this field for new records
3. Maintain hash values for existing records
4. Use "Drive URL" field as the source for deeplink extraction

### Migration Strategy

#### Phase 1: Dual-Mode Operation
1. Deploy code that supports both deduplication methods
2. New records use deeplink deduplication
3. Existing records continue to work with hash-based deduplication
4. Monitor for issues

#### Phase 2: Gradual Migration (Optional)
1. Background job to populate normalized deeplinks for existing records
2. Extract deeplinks from existing "Drive URL" fields
3. Update records without reprocessing content

#### Phase 3: Deprecation (Future)
1. After all records have deeplinks, disable hash calculation
2. Remove hash calculation code in future release
3. Maintain hash field for historical reference

### Testing Requirements

#### Unit Tests

**Location**: `tests/drive/test_deduplication.py` (new file)

```python
class TestDeduplicationService:
    def test_extract_file_id_from_deeplink(self):
        """Test file ID extraction from various deeplink formats."""
        
    def test_normalize_deeplink(self):
        """Test deeplink normalization handles edge cases."""
        
    def test_deeplink_deduplication(self):
        """Test deeplink-based deduplication logic."""
        
    def test_fallback_to_hash(self):
        """Test fallback mechanism when deeplink unavailable."""
        
    def test_backward_compatibility(self):
        """Test system works with mixed hash/deeplink records."""
```

**Location**: `tests/drive/test_ingester.py` (updates)

```python
def test_ingest_with_deeplink_deduplication(self):
    """Test ingestion using deeplink deduplication."""
    
def test_ingest_with_legacy_hash_deduplication(self):
    """Test backward compatibility with hash deduplication."""
```

#### Integration Tests

**Location**: `tests/test_integration.py` (updates)

```python
def test_end_to_end_with_deeplink_dedup(self):
    """Test full pipeline with deeplink deduplication."""
    
def test_migration_scenario(self):
    """Test system handles mixed deduplication methods."""
```

### Error Handling

1. **Invalid Deeplink Format**
   - Log warning and fall back to hash-based deduplication
   - Track occurrences for monitoring

2. **Missing Deeplink**
   - Use file ID-based deduplication as intermediate fallback
   - Calculate hash only if necessary

3. **Deeplink Extraction Failure**
   - Log detailed error for debugging
   - Continue processing with degraded deduplication

### Performance Considerations

1. **Eliminated Operations**
   - No file downloads for deduplication
   - No hash calculations for new files
   - Faster deduplication checks

2. **Optimization Opportunities**
   - Batch deeplink lookups
   - In-memory caching during processing
   - Parallel deduplication checks

### Security Considerations

1. **Data Privacy**
   - Deeplinks don't expose file content
   - Maintain existing access controls
   - No additional security risks

2. **API Permissions**
   - No new permissions required
   - Uses existing Drive API access

## Implementation Plan

### Development Phases

#### Phase 1: Core Implementation (Week 1)
1. Implement enhanced DeduplicationService
2. Update DriveIngester for deeplink deduplication
3. Modify NotionClient for deeplink queries
4. Add configuration options

#### Phase 2: Testing & Validation (Week 2)
1. Write comprehensive unit tests
2. Update integration tests
3. Test backward compatibility
4. Performance benchmarking

#### Phase 3: Migration Support (Week 3)
1. Implement migration utilities
2. Add monitoring and logging
3. Create rollback procedures
4. Documentation updates

### Rollout Strategy

1. **Development Environment**
   - Full testing with sample data
   - Verify no regressions

2. **Staging/Test Run**
   - Enable for subset of files
   - Monitor deduplication accuracy
   - Validate performance improvements

3. **Production**
   - Gradual rollout with feature flag
   - Monitor error rates
   - Full deployment after validation

## Success Metrics

1. **Performance Metrics**
   - Deduplication check time reduced by >80%
   - No increase in overall pipeline processing time
   - Reduced API calls for hash calculation

2. **Reliability Metrics**
   - Zero false positives in deduplication
   - Successful handling of all edge cases
   - No data loss during migration

3. **Operational Metrics**
   - Reduced storage for hash values (long-term)
   - Simplified deduplication logic
   - Improved debugging capabilities

## Risks and Mitigations

### Risk 1: Deeplink Format Changes
- **Mitigation**: Robust deeplink parsing with multiple format support
- **Monitoring**: Alert on parsing failures

### Risk 2: Migration Complexity
- **Mitigation**: Dual-mode operation allows gradual migration
- **Rollback**: Configuration flag to revert to hash-based deduplication

### Risk 3: Performance Regression
- **Mitigation**: Comprehensive performance testing before deployment
- **Monitoring**: Track deduplication timing metrics

## Future Considerations

1. **Multi-Source Support**
   - Design supports other sources with unique identifiers
   - Abstract deduplication interface for extensibility

2. **Update Detection**
   - Deeplinks enable tracking file updates
   - Future feature: Smart re-enrichment of updated content

3. **Batch Processing Optimization**
   - Bulk deeplink queries for large batches
   - Parallel processing improvements

## Appendix

### A. Deeplink Format Examples

```
Standard format:
https://drive.google.com/file/d/FILE_ID/view?usp=drivesdk

Shared drive format:
https://drive.google.com/file/d/FILE_ID/view?usp=drive_link

Variations:
https://drive.google.com/file/d/FILE_ID/view
https://drive.google.com/open?id=FILE_ID
```

### B. Configuration Example

```python
# .env file
USE_DEEPLINK_DEDUPLICATION=true
FALLBACK_TO_HASH_DEDUP=true
CALCULATE_CONTENT_HASH=false
```

### C. Monitoring Queries

```python
# Log structured data for monitoring
logger.info("deduplication_check", {
    "method": "deeplink",
    "file_id": file_id,
    "duplicate_found": is_duplicate,
    "fallback_used": used_fallback,
    "check_time_ms": check_time
})
```