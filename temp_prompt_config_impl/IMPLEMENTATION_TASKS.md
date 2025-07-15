# Prompt Configuration & Web Search Implementation Tasks

**Project**: Dynamic Prompt Configuration with Web Search Support
**Status**: Ready for Development
**Target**: Knowledge Pipeline v2.1

## 📋 Task Overview

This implementation adds:
1. Content-type-specific prompts
2. Per-analyzer web search toggles
3. OpenAI Responses API integration
4. Configuration management system

---

## 🏗️ Phase 1: Foundation (Week 1)

### Task 1.1: Create Core Configuration Classes
**Assignee**: Backend Developer
**Priority**: High
**Estimated**: 4 hours

- [ ] Create `src/core/prompt_config.py`
  - [ ] Implement `PromptConfig` class
  - [ ] Add YAML loading with env var substitution
  - [ ] Add getter methods for prompt retrieval
  - [ ] Write unit tests

**Acceptance Criteria**:
- Can load prompts from YAML file
- Environment variables override YAML values
- Returns correct prompts for analyzer + content type combo

### Task 1.2: Create Analyzer Base Class
**Assignee**: Backend Developer
**Priority**: High
**Estimated**: 3 hours

- [ ] Create `src/enrichment/base_analyzer.py`
  - [ ] Implement abstract `BaseAnalyzer` class
  - [ ] Add web search detection logic
  - [ ] Add fallback mechanisms
  - [ ] Write unit tests

**Acceptance Criteria**:
- Analyzers can inherit from base class
- Web search automatically enabled/disabled based on config
- Graceful fallback when web search fails

### Task 1.3: Set Up Configuration Files
**Assignee**: DevOps/Backend
**Priority**: Medium
**Estimated**: 2 hours

- [ ] Create `config/prompts.yaml` template
- [ ] Document all configuration options
- [ ] Add to `.env.example`:
  ```bash
  # Web Search Configuration
  ENABLE_WEB_SEARCH=false
  WEB_SEARCH_MODEL=gpt-4o
  SUMMARIZER_WEB_SEARCH=false
  CLASSIFIER_WEB_SEARCH=false
  INSIGHTS_WEB_SEARCH=true
  ```
- [ ] Update deployment scripts

---

## 🔧 Phase 2: OpenAI Integration (Week 1-2)

### Task 2.1: Upgrade OpenAI Client
**Assignee**: Backend Developer
**Priority**: High
**Estimated**: 2 hours

- [ ] Check current OpenAI SDK version
- [ ] Upgrade to latest version supporting Responses API
- [ ] Update requirements.txt
- [ ] Test basic Responses API calls

**Acceptance Criteria**:
- Can make successful Responses API calls
- Existing Chat Completions API still works

### Task 2.2: Implement Responses API Wrapper
**Assignee**: Backend Developer
**Priority**: High
**Estimated**: 4 hours

- [ ] Create `src/ai/responses_client.py`
- [ ] Implement web search calls
- [ ] Add error handling and retries
- [ ] Add response parsing
- [ ] Write integration tests

**Test Cases**:
- [ ] Successful web search query
- [ ] Web search with no results
- [ ] API timeout handling
- [ ] Rate limit handling

---

## 🔄 Phase 3: Analyzer Migration (Week 2)

### Task 3.1: Migrate Existing Analyzers
**Assignee**: Backend Developer
**Priority**: High
**Estimated**: 6 hours

- [ ] Update `AdvancedContentSummarizer`
  - [ ] Accept content_type parameter
  - [ ] Use PromptConfig for prompts
  - [ ] Add web search capability
  
- [ ] Update `AdvancedContentClassifier`
  - [ ] Accept content_type parameter
  - [ ] Use PromptConfig for prompts
  
- [ ] Update `AdvancedInsightsGenerator`
  - [ ] Accept content_type parameter
  - [ ] Use PromptConfig for prompts
  - [ ] Add web search capability

**Acceptance Criteria**:
- All analyzers use new configuration system
- Backward compatibility maintained
- No regression in existing functionality

### Task 3.2: Update Pipeline Processor
**Assignee**: Backend Developer
**Priority**: High
**Estimated**: 3 hours

- [ ] Update `PipelineProcessor.__init__`
  - [ ] Initialize PromptConfig
  - [ ] Pass to analyzers
  
- [ ] Update `enrich_content` method
  - [ ] Extract content_type from Notion
  - [ ] Pass to analyzer methods
  
- [ ] Update error handling

---

## 🧪 Phase 4: Testing & Validation (Week 2-3)

### Task 4.1: Unit Tests
**Assignee**: QA/Backend Developer
**Priority**: High
**Estimated**: 4 hours

- [ ] Test PromptConfig class
  - [ ] YAML loading
  - [ ] Environment variable substitution
  - [ ] Content-type resolution
  
- [ ] Test BaseAnalyzer
  - [ ] Web search toggling
  - [ ] Fallback behavior
  
- [ ] Test analyzer migrations

### Task 4.2: Integration Tests
**Assignee**: QA Engineer
**Priority**: High
**Estimated**: 6 hours

- [ ] Create test content samples:
  - [ ] Research paper
  - [ ] Market news article
  - [ ] Technical documentation
  
- [ ] Test scenarios:
  - [ ] Different content types get different prompts
  - [ ] Web search only activates when configured
  - [ ] Correct Notion output format
  - [ ] Performance with/without web search

### Task 4.3: Cost Analysis Testing
**Assignee**: QA/Product
**Priority**: Medium
**Estimated**: 3 hours

- [ ] Measure token usage with/without web search
- [ ] Calculate cost implications
- [ ] Document in cost analysis report
- [ ] Set up monitoring alerts

---

## 📊 Phase 5: Monitoring & Documentation (Week 3)

### Task 5.1: Add Metrics
**Assignee**: Backend Developer
**Priority**: Medium
**Estimated**: 3 hours

- [ ] Track web search usage by analyzer
- [ ] Track response times
- [ ] Track fallback frequency
- [ ] Add to existing dashboards

### Task 5.2: Update Documentation
**Assignee**: Technical Writer/Developer
**Priority**: Medium
**Estimated**: 4 hours

- [ ] Update CLAUDE.md with new config options
- [ ] Create user guide for prompt customization
- [ ] Add examples to docs/
- [ ] Update API documentation

### Task 5.3: Create Admin Interface Design
**Assignee**: Frontend Developer/Designer
**Priority**: Low
**Estimated**: 4 hours

- [ ] Design mockups for prompt editing UI
- [ ] Plan configuration management interface
- [ ] Document API requirements

---

## 🚀 Phase 6: Deployment (Week 3-4)

### Task 6.1: Staging Deployment
**Assignee**: DevOps
**Priority**: High
**Estimated**: 2 hours

- [ ] Deploy to staging environment
- [ ] Run full test suite
- [ ] Verify configuration loading
- [ ] Test with production-like data

### Task 6.2: Production Rollout
**Assignee**: DevOps/Backend
**Priority**: High
**Estimated**: 4 hours

- [ ] Create rollback plan
- [ ] Deploy with feature flags
- [ ] Monitor error rates
- [ ] Gradual rollout (10% → 50% → 100%)

---

## ✅ Definition of Done

Each task is complete when:
1. Code is written and peer-reviewed
2. Unit tests pass with >80% coverage
3. Integration tests pass
4. Documentation is updated
5. No performance regression
6. Deployed to staging and tested

## 🎯 Success Metrics

- [ ] Web search reduces "outdated info" complaints by 50%
- [ ] Content-type-specific prompts improve classification accuracy by 20%
- [ ] No increase in processing time for non-web-search analyses
- [ ] Cost increase stays under 15% with web search enabled

## 🚨 Risk Mitigation

1. **OpenAI API Changes**
   - Keep fallback to Chat Completions API
   - Abstract API calls behind interface

2. **Cost Overruns**
   - Implement hard limits on web search queries/day
   - Monitor usage in real-time

3. **Performance Impact**
   - Cache web search results (15 min TTL)
   - Async processing where possible

## 📝 Notes for Developers

1. **Testing Priority**: Focus on backward compatibility
2. **Configuration**: Use environment variables for all secrets
3. **Logging**: Add detailed logs for web search decisions
4. **Error Handling**: Never let web search failures break the pipeline

---

**Questions?** Post in #knowledge-pipeline Slack channel
**Blockers?** Escalate to Product Manager immediately