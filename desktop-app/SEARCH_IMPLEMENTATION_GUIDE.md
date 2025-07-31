# Search Bar Implementation Guide

## Quick Integration Steps

### 1. Add to SimpleGraph3D.tsx imports:
```typescript
import { GraphSearchBar } from './GraphSearchBar';
```

### 2. Add search state:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<Set<string>>(new Set());
```

### 3. Add search handler:
```typescript
const handleSearch = (query: string) => {
  if (!query) {
    setSearchResults(new Set());
    return;
  }
  
  const results = new Set<string>();
  const lowerQuery = query.toLowerCase();
  
  validNodes.forEach(node => {
    if (node.label.toLowerCase().includes(lowerQuery) ||
        node.properties.content?.toLowerCase().includes(lowerQuery) ||
        node.properties.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      results.add(node.id);
    }
  });
  
  setSearchResults(results);
  console.log(`Found ${results.size} nodes matching "${query}"`);
};
```

### 4. Add search bar to render:
```tsx
<GraphSearchBar
  onSearch={handleSearch}
  resultCount={searchResults.size}
  totalNodes={validNodes.length}
  onFilter={(filters) => {
    // TODO: Implement filtering logic
    console.log('Filters:', filters);
  }}
/>
```

### 5. Update node rendering to highlight search results:
```tsx
<GraphNode
  key={node.id}
  node={node}
  highlighted={highlightedNodes.has(node.id) || searchResults.has(node.id)}
  onClick={() => {
    setSelectedNode(node);
    setHighlightedNodes(new Set());
    onNodeClick?.(node);
  }}
/>
```

## Advanced Features to Add

### 1. Fuzzy Search
Use a library like Fuse.js for better search:
```bash
npm install fuse.js
```

### 2. Search History
Store recent searches in localStorage

### 3. Quick Actions
- Press Enter to jump to first result
- Arrow keys to navigate results
- Cmd/Ctrl+F to focus search

### 4. Search Operators
- `type:document` - filter by type
- `tag:important` - search tags
- `created:2024` - date filters
- `"exact phrase"` - exact matching

### 5. Live Preview
Show matching text snippets below search bar

## Performance Considerations

For large graphs (1000+ nodes):
1. Debounce search input (300ms)
2. Use Web Workers for search
3. Virtualize search results
4. Index content on load

## Example Enhanced Search
```typescript
// With Fuse.js
const fuse = new Fuse(validNodes, {
  keys: ['label', 'properties.content', 'properties.tags'],
  threshold: 0.3,
  includeScore: true
});

const results = fuse.search(query);
```