# Test Scenarios for Prompt Configuration

## 🧪 Manual Testing Checklist

### Scenario 1: Basic Web Search Toggle
```bash
# Test 1.1: Web search disabled globally
ENABLE_WEB_SEARCH=false
# Expected: All analyzers use standard API

# Test 1.2: Web search enabled for insights only
ENABLE_WEB_SEARCH=true
SUMMARIZER_WEB_SEARCH=false
INSIGHTS_WEB_SEARCH=true
# Expected: Only insights uses web search
```

### Scenario 2: Content-Type-Specific Prompts

#### Test Data:
1. **Research Paper**: "arxiv_paper.pdf"
   - Should trigger academic-focused prompts
   - Web search for recent citations

2. **Market News**: "tesla_earnings.html"
   - Should trigger market-focused prompts
   - Web search for competitor data

3. **Technical Doc**: "react_hooks_guide.md"
   - Should trigger technical prompts
   - Web search for latest versions

### Scenario 3: Cost Control
```python
# Monitor these metrics:
- Tokens used without web search: ~2,000
- Tokens used with web search: ~3,500
- Web search queries per document: 1-2
- Cost increase: Should be <15%
```

### Scenario 4: Error Handling

1. **Web Search API Down**
   - Simulate by using invalid API key
   - Expected: Graceful fallback to standard API

2. **Timeout Scenario**
   - Use very long content
   - Expected: Timeout handled, partial results

3. **Rate Limiting**
   - Process 20 documents rapidly
   - Expected: Automatic retry with backoff

## 🔍 Validation Checklist

### For Each Test Run:

- [ ] Correct prompts used (check logs)
- [ ] Web search only when configured
- [ ] Notion output formatted correctly
- [ ] No regression in quality
- [ ] Performance within 10% of baseline
- [ ] Costs tracked and reasonable

### Edge Cases to Test:

1. **Empty Content**
   ```python
   analyzer.analyze("", "Empty Doc")
   # Should handle gracefully
   ```

2. **Massive Content**
   ```python
   analyzer.analyze("x" * 100000, "Large Doc")
   # Should truncate appropriately
   ```

3. **Special Characters**
   ```python
   analyzer.analyze("🤖 AI & <code>", "Special")
   # Should handle encoding properly
   ```

4. **Concurrent Requests**
   ```python
   # Process 5 documents simultaneously
   # Should not mix up configurations
   ```

## 📊 Performance Benchmarks

### Baseline (No Web Search):
- Average processing time: 3.2s
- P95 processing time: 5.1s
- Success rate: 99.5%

### Target (With Web Search):
- Average processing time: <4.5s
- P95 processing time: <7.0s
- Success rate: >98%

## 🐛 Bug Report Template

```markdown
**Scenario**: [What were you testing]
**Configuration**: [Relevant env vars]
**Expected**: [What should happen]
**Actual**: [What happened]
**Logs**: [Relevant log snippets]
**Impact**: [High/Medium/Low]
```