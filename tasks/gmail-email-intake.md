# Gmail Email Intake Feature

## Overview
Implement Gmail API integration to capture newsletter and content emails directly from Gmail inbox into the knowledge pipeline.

## Individual Tasks

### Phase 1: Core Gmail Integration
- [x] **COMPLETED** - Set up Google Cloud Project and enable Gmail API
- [x] **COMPLETED** - Create OAuth2 credential configuration system  
- [x] **COMPLETED** - Implement Gmail API authentication flow
- [x] **COMPLETED** - Create `capture_emails.py` module with basic Gmail connection
- [x] **COMPLETED** - Add Gmail-specific environment variables to README

### Phase 2: Email Processing  
- [x] **COMPLETED** - Implement email search and filtering (newsletters, specific senders)
- [x] **COMPLETED** - Create email content extraction pipeline (HTML→markdown)
- [x] **COMPLETED** - Add email deduplication using message-id/hash
- [x] **COMPLETED** - Create Notion database integration for email sources
- [x] **COMPLETED** - Handle email metadata (sender, subject, date) storage

### Phase 3: Content Enhancement  
- [x] **COMPLETED** - Update `enrich_rss.py` to process email content sources
- [x] **COMPLETED** - Add email-specific content cleaning (remove footers, unsubscribe links)
- [x] **COMPLETED** - Implement smart sender filtering and whitelist management
- [ ] **PENDING** - Add email attachment processing for PDFs/documents

### Phase 4: Pipeline Integration
- [ ] **IN-PROGRESS** - Fix archived page handling in enrichment process
- [ ] **PENDING** - Integrate email capture into `pipeline.sh` automation
- [ ] **PENDING** - Add error handling and retry logic for Gmail API calls
- [ ] **PENDING** - Create configuration documentation and setup guide
- [ ] **PENDING** - Test end-to-end email→enrichment→Notion workflow

### Phase 5: Advanced Features (Optional)
- [ ] **PENDING** - Add Gmail label-based organization and filtering
- [ ] **PENDING** - Implement email thread/conversation handling
- [ ] **PENDING** - Add support for multiple Gmail accounts
- [ ] **PENDING** - Create email processing analytics and monitoring

## Environment Variables Needed
```bash
GMAIL_CREDENTIALS_PATH=path/to/credentials.json
GMAIL_TOKEN_PATH=path/to/token.json  
GMAIL_SEARCH_QUERY=from:newsletter OR from:substack
GMAIL_WINDOW_DAYS=7
EMAIL_SENDERS_WHITELIST=newsletter@substack.com,digest@morning.com
```

## Success Criteria
- [ ] Can authenticate with Gmail API using OAuth2
- [ ] Can search and retrieve newsletter emails from Gmail
- [ ] Can extract clean content and store in Notion database
- [ ] Can enrich email content using existing AI pipeline
- [ ] Integrates seamlessly with existing pipeline automation

---
**Status**: Phase 1-3 Complete, Phase 4 In Progress  
**Current Issue**: Some Notion pages are archived and can't be enriched
**Next Task**: Handle archived pages or complete pipeline integration