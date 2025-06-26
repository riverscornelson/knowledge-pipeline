# Minimal Gmail OAuth Setup

## Quick Setup for Personal Use

### Option 1: Fix Current Project
1. Go to https://console.cloud.google.com/apis/credentials/consent
2. Ensure **Publishing Status = "Testing"**
3. In **Test users** section: Add your Gmail address
4. **Save**

### Option 2: Create New Project (If Option 1 Fails)
1. **New Project**: `gmail-personal-access`
2. **Enable Gmail API**: APIs & Services → Library → Gmail API → Enable
3. **OAuth Consent Screen**:
   - User Type: External
   - App name: `Personal Gmail Access`
   - Support email: Your Gmail
   - Developer contact: Your Gmail
   - Publishing status: **Testing** (never publish)
   - Test users: Add your Gmail
4. **Credentials**:
   - Create OAuth Client ID
   - Type: Desktop application
   - Download JSON as `credentials.json`

### What "Testing" Mode Means:
- ✅ Works for up to 100 test users
- ✅ No verification required
- ✅ Perfect for personal use
- ⚠️ Shows "unverified app" warning (normal, click "Advanced" → "Go to app")

### Expected Flow:
1. Browser opens OAuth consent screen
2. Warning: "Google hasn't verified this app" 
3. Click "Advanced" → "Go to [app name] (unsafe)"
4. Grant permissions
5. Success!

The key is staying in "Testing" mode and adding yourself as a test user.