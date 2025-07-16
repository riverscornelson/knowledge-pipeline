# Line-Aware Chunking Implementation Plan

## Current Problem
The word-boundary fix eliminated mid-word truncation but destroyed all text formatting by using `text.split()`, which converts all whitespace (including `\n\n` paragraph breaks) into single spaces. This makes content unreadable in Notion.

## Solution: Implement Recursive Character Splitting (Industry Standard)

### Research Findings
- **Industry consensus**: Use hierarchical separators `["\n\n", "\n", " ", ""]`
- **Best practice**: Split on natural boundaries (paragraphs → lines → words → characters)
- **Notion compatibility**: Preserve visual structure users expect

## Task List

### Phase 1: Core Implementation
- [ ] **Task 1.1**: Replace current `_chunk_text_to_blocks` method with line-aware logic
- [ ] **Task 1.2**: Implement hierarchical separator splitting pattern
- [ ] **Task 1.3**: Add proper paragraph break preservation (`\n\n`)
- [ ] **Task 1.4**: Handle edge cases (empty lines, oversized single lines)

### Phase 2: Enhanced Features  
- [ ] **Task 2.1**: Add list and bullet point preservation
- [ ] **Task 2.2**: Implement smart whitespace handling for code blocks
- [ ] **Task 2.3**: Add markdown structure awareness (headers, tables)

### Phase 3: Testing & Validation
- [ ] **Task 3.1**: Update existing unit tests for new chunking behavior
- [ ] **Task 3.2**: Add comprehensive formatting preservation tests
- [ ] **Task 3.3**: Test with the problematic PDF to verify both fixes work
- [ ] **Task 3.4**: Run full pipeline to validate Notion formatting

### Phase 4: Documentation & Cleanup
- [ ] **Task 4.1**: Update method documentation with new behavior
- [ ] **Task 4.2**: Add inline comments explaining hierarchical splitting
- [ ] **Task 4.3**: Remove any temporary test files

## Implementation Strategy

### Core Algorithm (Task 1.1-1.2)
```python
def _chunk_text_to_blocks(self, text: str, max_length: int = 1900) -> List[Dict]:
    """Chunk text with hierarchical separators to preserve formatting."""
    separators = ["\n\n", "\n", " ", ""]
    return self._recursive_split(text, separators, max_length)

def _recursive_split(self, text: str, separators: List[str], max_length: int) -> List[Dict]:
    """Recursively split text using separator hierarchy."""
    if not separators or len(text) <= max_length:
        return [self._create_paragraph_block(text)] if text.strip() else []
    
    separator = separators[0]
    remaining_separators = separators[1:]
    
    if separator not in text:
        return self._recursive_split(text, remaining_separators, max_length)
    
    # Split and process chunks
    chunks = text.split(separator)
    # ... implement chunk processing logic
```

### Expected Outcomes
- ✅ **No word truncation**: Preserves complete words (original bug fix maintained)
- ✅ **Format preservation**: Maintains paragraphs, lists, structure (fixes current issue)
- ✅ **Industry standard**: Follows recursive character splitting best practices
- ✅ **Notion compatibility**: Content displays properly formatted

### Success Criteria
1. **Word integrity**: No mid-word cuts (e.g., no "wha", "ca", "beli")
2. **Paragraph structure**: `\n\n` preserved as separate blocks or clear breaks
3. **List formatting**: Bullet points and lists remain readable
4. **Test coverage**: All edge cases covered with unit tests
5. **Pipeline success**: Full enrichment works with properly formatted content

## Risk Mitigation
- **Backup approach**: Keep current implementation as fallback if new version fails
- **Gradual rollout**: Test with single file before full pipeline
- **Quality validation**: Compare before/after Notion formatting manually

## Estimated Timeline
- **Phase 1**: 1-2 hours (core implementation)
- **Phase 2**: 1 hour (enhanced features)
- **Phase 3**: 1 hour (testing)
- **Phase 4**: 30 minutes (documentation)
- **Total**: 3.5-4.5 hours

## Dependencies
- Current `_chunk_text_to_blocks` method location: `src/enrichment/pipeline_processor.py:696-710`
- Related method: `_markdown_to_blocks` (calls chunking method)
- Test file: `tests/enrichment/test_chunking.py` (needs updates)