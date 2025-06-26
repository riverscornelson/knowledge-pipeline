# Gmail OAuth Setup Troubleshooting

## Error: 403 access_denied

This error typically occurs due to OAuth consent screen configuration issues.

### Step-by-Step Fix for Personal Use:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project**: `knowledge-pipeline-gmail`

3. **Configure OAuth Consent Screen for Testing**:
   - Navigate to "APIs & Services" → "OAuth consent screen"
   - User Type: "External" (this is correct)
   - Publishing Status: Keep as "Testing" (DO NOT publish)
   - Fill required fields:
     - App name: `Knowledge Pipeline Gmail`
     - User support email: `your-email@gmail.com`
     - Developer contact information: `your-email@gmail.com`
   - Scopes: Click "Add or Remove Scopes"
     - Add: `https://www.googleapis.com/auth/gmail.readonly`
   - **CRITICAL**: Test users section - Add your Gmail address here
   - Save all changes

4. **Verify Publishing Status**:
   - Ensure it shows "Testing" not "In production"
   - This allows up to 100 test users without verification

4. **Verify OAuth Client**:
   - Go to "APIs & Services" → "Credentials"
   - Your OAuth 2.0 Client should be type "Desktop application"
   - Download fresh credentials if needed

5. **Publishing Status**:
   - For personal use: Leave app in "Testing" mode
   - Add your Gmail as a test user
   - For production: Submit for verification (not needed for personal use)

### Alternative Solutions:

#### Option A: Use Different Gmail Account
Try with a fresh Gmail account that hasn't been used with Google Cloud before.

#### Option B: Domain Verification (Advanced)
If you own a domain, you can verify it to avoid some restrictions.

#### Option C: Service Account (Not Recommended)
Service accounts require domain-wide delegation for Gmail access.

### Test Steps:
1. Delete existing token: `rm gmail_credentials/token.json`
2. Run auth test: `python3 gmail_auth.py`
3. Complete OAuth flow in browser
4. Verify connection works

### Common Issues:
- **App not approved**: Normal for testing, add yourself as test user
- **Redirect URI mismatch**: Should auto-generate for desktop apps
- **Scope permissions**: Ensure Gmail readonly scope is added
- **Account restrictions**: Some organization accounts block external OAuth

If issues persist, try creating a new Google Cloud project with a different name.