# Local Upload OAuth 2.0 Integration Design

## Problem Statement

The local PDF upload preprocessing feature is failing with "invalid_grant: Token has been expired or revoked" errors. This is happening because:

1. The desktop app has migrated to OAuth 2.0 authentication
2. The Python pipeline's local upload feature is still trying to use expired OAuth tokens
3. There's a disconnect between the desktop app's auth state and the Python pipeline's auth requirements

## Current Architecture Issues

1. **Dual Authentication Systems**: 
   - Desktop app: Uses OAuth 2.0 with UnifiedGoogleAuth
   - Python pipeline: Uses service account for Drive ingestion BUT OAuth for local uploads
   
2. **Token Management Gap**:
   - Desktop app manages OAuth tokens in memory/keychain
   - Python pipeline expects tokens to be available in its own storage

3. **Local Upload Flow**:
   - Currently attempts to use separate OAuth credentials
   - No coordination with desktop app's authentication state

## Proposed Solution

### Option 1: Service Account for All Operations (Recommended)

**Approach**: Standardize on service account authentication for all Drive operations in the Python pipeline.

**Implementation**:
1. Modify `local_uploader/preprocessor.py` to use service account instead of OAuth
2. Remove OAuth dependencies from local upload code
3. Use the same DriveIngester service account logic for uploads

**Pros**:
- Consistent authentication mechanism
- No token expiration issues
- Works independently of desktop app auth state
- Simpler architecture

**Cons**:
- Files uploaded by service account won't show user as owner
- May need to share Drive folder with service account

### Option 2: Pass OAuth Token from Desktop App

**Approach**: Desktop app passes its OAuth token to Python pipeline.

**Implementation**:
1. Desktop app exports current OAuth token to temp file
2. Python pipeline reads token and uses it for uploads
3. Clear token file after use

**Pros**:
- Files show correct user ownership
- Leverages existing OAuth flow

**Cons**:
- Security concerns with token passing
- Complex token lifecycle management
- Token might expire during long operations

### Option 3: Remove Local Upload Feature

**Approach**: Deprecate local upload preprocessing in favor of desktop app handling.

**Implementation**:
1. Move local upload logic to desktop app (TypeScript)
2. Desktop app uploads files before triggering pipeline
3. Pipeline only processes Drive files

**Pros**:
- Cleanest separation of concerns
- No auth coordination needed
- Desktop app already has working OAuth

**Cons**:
- Requires reimplementing upload logic in TypeScript
- Changes existing workflow

## Recommended Implementation Plan (Option 1)

### Phase 1: Immediate Fix
1. Update `local_uploader/preprocessor.py` to detect OAuth failures
2. Fall back to service account authentication
3. Log clear message about auth method being used

### Phase 2: Refactor
1. Remove OAuth code from local uploader
2. Standardize on service account for all operations
3. Update configuration to ensure service account has folder access

### Phase 3: Enhancement
1. Add explicit service account validation on startup
2. Provide clear error messages if service account lacks permissions
3. Document the authentication architecture

## Code Changes Required

### 1. Update `local_uploader/preprocessor.py`

```python
def _upload_to_drive_with_service_account(self, file_path: str, drive_service) -> Optional[str]:
    """Upload file using service account (same as DriveIngester)."""
    # Use same upload logic as DriveIngester
    pass

def process_local_pdfs(config: PipelineConfig, notion_client: NotionClient) -> Dict[str, int]:
    """Process with service account fallback."""
    try:
        # Try to get service account credentials
        drive_ingester = DriveIngester(config, notion_client)
        drive_service = drive_ingester.drive
        
        if not drive_service:
            raise ValueError("No Drive service available")
            
        # Use service account for uploads
        # ... rest of upload logic
    except Exception as e:
        logger.error(f"Failed to process local PDFs: {e}")
```

### 2. Remove OAuth Token Management

- Remove `_get_oauth_drive_service()` method
- Remove `_get_oauth_tokens()` method  
- Remove token refresh logic

### 3. Update Documentation

- Document that local uploads use service account
- Provide instructions for granting service account access to Drive folder
- Update troubleshooting guide

## Migration Steps

1. **Immediate** (while pipeline is running):
   - Document the issue and workaround
   - Prepare code changes locally

2. **Next Maintenance Window**:
   - Deploy service account fix
   - Test with sample PDFs
   - Update configuration if needed

3. **Follow-up**:
   - Monitor for any permission issues
   - Consider adding service account validation to desktop app
   - Update user documentation

## Alternative Quick Fix

If you need local uploads working immediately without code changes:

1. Manually refresh OAuth tokens using Google's OAuth playground
2. Store refreshed tokens where Python expects them
3. This is temporary - tokens will expire again

## Long-term Considerations

1. **Unified Auth Strategy**: Consider moving all Google operations to service account
2. **Desktop App Integration**: Future version could handle all uploads directly
3. **Security**: Service account key rotation and access audit

This design ensures reliable local uploads without OAuth token expiration issues while maintaining security and proper access controls.