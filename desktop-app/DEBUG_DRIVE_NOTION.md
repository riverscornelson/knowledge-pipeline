# Drive-Notion Integration Debugging Guide

## Issue: Notion metadata not showing in Drive Explorer

### What was implemented:
1. **Backend**: Drive-Notion IPC handler at `src/main/drive-notion-handlers.ts`
2. **Frontend**: Enhanced `useGoogleDrive` hook to fetch Notion metadata
3. **UI**: Updated GoogleDriveExplorer to show Content Type and Status chips

### Debugging steps:

1. **Check Console Logs**
   - Open Developer Tools (Cmd+Option+I)
   - Look for logs starting with "Fetching Notion metadata"
   - Check for any error messages

2. **Verify IPC Handler Registration**
   - Check that `registerDriveNotionHandlers()` is called in `SecureIPCService`
   - Verify handler is registered for `DRIVE_GET_NOTION_METADATA` channel

3. **Check Notion Configuration**
   - Ensure Notion token and database ID are configured
   - Verify the Drive URL property exists in Notion database

4. **Test with Sample Data**
   - The handler now logs sample URLs and request details
   - Check electron logs for backend processing

### Common issues:
1. **Secure messaging**: Handler now supports both secure and direct message formats
2. **Empty results**: Check if files have `webViewLink` property
3. **Notion permissions**: Ensure integration has access to the database

### Next steps if still not working:
1. Check which preload script is being used (preload.ts vs preload-secure.ts)
2. Verify IPC channel is properly exposed in the preload
3. Add the method to secure API if using secure preload
4. Check Notion database schema for correct property names

Remember to remove this file after debugging:
```bash
rm DEBUG_DRIVE_NOTION.md
```