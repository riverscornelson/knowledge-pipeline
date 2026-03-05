# RVF + Notion Knowledge Distillation — Implementation Plan

## Objective

Build a single-file vector knowledge base (`.rvf`) from Notion workspace content, enabling semantic search, client-scoped querying, and auditable knowledge retrieval across project docs, meeting notes, and technical wikis.

---

## Phase 1: Repository & Toolchain Research

**Goal:** Understand the actual RVF codebase, data format requirements, and what's real vs. aspirational before writing any code.

### Research 1.1 — Clone and Explore the Repo Structure

```bash
git clone https://github.com/ruvnet/ruvector
cd ruvector
# Map the workspace
find crates/rvf -name "Cargo.toml" | head -30
ls examples/rvf/examples/
```

**Investigate:**
- Which crates actually compile on the current stable Rust? Run `cargo check --workspace` and note any failures.
- What is the actual MSRV? The README says 1.87 — verify this exists yet or if a lower version works.
- Are the npm packages (`@ruvector/rvf-node`, `@ruvector/rvf-mcp-server`) actually published on npm? Run `npm view @ruvector/rvf-node` and `npm view @ruvector/rvf-mcp-server` to check.

### Research 1.2 — Run the Test Suite

```bash
cd crates/rvf
cargo test --workspace 2>&1 | tail -50
```

**Investigate:**
- Do all 1,156 tests pass? Note any failures — these indicate areas that may not be production-ready.
- Are there integration tests that exercise the full ingest → query pipeline? Search for them: `grep -r "ingest_batch" examples/rvf/examples/basic_store.rs`

### Research 1.3 — Run a Basic Example End-to-End

```bash
cd examples/rvf
cargo run --example basic_store
cargo run --example filtered_search
```

**Investigate:**
- Does `basic_store` actually create a `.rvf` file on disk? Check file size and structure with the CLI.
- Does `rvf inspect` work on the output? This proves the CLI toolchain functions.
- Try the JSON ingest path specifically — this is the path we'll use: `cargo run --example generate_all` and inspect one of the outputs.

### Research 1.4 — Examine the JSON Ingest Format

```bash
# Find the JSON import code
cat crates/rvf/rvf-import/src/json.rs
# Find example JSON files
find . -name "*.json" -path "*/examples/*" | head -10
```

**Investigate:**
- What exact JSON schema does `rvf ingest --format json` expect? Document the required fields: `id`, `vector`, `metadata`.
- What metadata types are supported for filtered search? (string, number, boolean, arrays?)
- Is there a maximum batch size for ingest?
- What happens if you ingest vectors with metadata keys that weren't declared upfront?

### Research 1.5 — Examine the Node.js Bindings

```bash
cat crates/rvf/rvf-node/src/lib.rs
cat crates/rvf/rvf-node/index.js  # or index.d.ts
ls crates/rvf/rvf-node/
```

**Investigate:**
- Do the N-API bindings actually compile? Run `cd rvf-node && npm install && npm run build`.
- What methods are exposed? Document the actual API surface (create, open, ingest, query, close, etc.).
- Is metadata filtering available from Node.js or only from Rust?
- Can you pass a `Float32Array` directly or does it need conversion?

### Research 1.6 — Examine the MCP Server

```bash
cat packages/rvf-mcp-server/src/index.ts  # or wherever it lives
find . -name "*.ts" -path "*mcp*"
```

**Investigate:**
- Does `npx @ruvector/rvf-mcp-server` actually start? Test with `--transport stdio`.
- What MCP tools does it expose? Verify the list from the README matches reality.
- Does it support metadata-filtered queries or only pure vector search?
- Can it handle the `rvf_ingest` tool with pre-computed embeddings?

**Phase 1 Deliverable:** A `RESEARCH_FINDINGS.md` documenting what works, what doesn't, and which path (Rust CLI, Node.js, or MCP) is most viable for the pipeline.

---

## Phase 2: Notion Workspace Audit & Export Design

**Goal:** Map the Notion content landscape and design the chunking/metadata strategy before pulling any data.

### Research 2.1 — Inventory the Notion Workspace

Use the Notion MCP tools to survey what's available:

```
notion-search: {"query": ""}              # broad search, see what comes back
notion-get-teams: {}                       # list teamspaces
notion-query-data-sources: {"query": "SELECT * FROM data_sources LIMIT 50"}
```

**Investigate:**
- What databases exist? (Meeting notes, project trackers, wikis, client pages)
- How are pages organized — flat or nested under client/project hierarchies?
- What's the total content volume? Estimate page count and avg page length.
- Which content is most valuable for semantic search? Prioritize: project docs > meeting notes > admin pages.

### Research 2.2 — Sample and Profile Content Types

Pull 5-10 representative pages across different types:

```
notion-search: {"query": "architecture"}     # technical docs
notion-search: {"query": "call"}             # meeting notes
notion-search: {"query": "wiki"}             # knowledge bases
notion-search: {"query": "checklist"}        # project management
```

For each, fetch the full page and analyze:

**Investigate:**
- What's the typical page length in tokens? (Affects chunk count per page)
- Do pages have consistent structure (headings, sections) or freeform?
- What metadata is available per page? (Tags, properties, created date, author, status)
- Are there database properties we should preserve as filterable metadata? (Client name, project, status, type)
- How do meeting transcripts differ from written docs? (Transcripts are 5K-20K words per the skill file — need different chunking strategy)

### Research 2.3 — Design the Metadata Schema

Based on the audit, define the metadata fields that will be attached to each chunk for filtered search in RVF:

```json
{
  "source_page_id": "notion-page-uuid",
  "source_page_title": "HSS Architecture Design",
  "client": "Nucor",
  "project": "HSS",
  "content_type": "technical_doc | meeting_notes | wiki | checklist",
  "section_heading": "Authentication Flow",
  "chunk_index": 3,
  "total_chunks": 12,
  "created_date": "2025-11-15",
  "last_edited": "2026-02-20",
  "author": "Nick",
  "page_url": "https://www.notion.so/..."
}
```

**Investigate:**
- Which of these fields does RVF's metadata filtering actually support? (Test with the filtered_search example)
- Are there RVF limits on metadata size per vector?
- Can we do compound filters like `client = "Nucor" AND content_type = "technical_doc"`?

### Research 2.4 — Design the Chunking Strategy

**Investigate by experimentation:**
- For technical docs: chunk by heading section (H2/H3 boundaries), with fallback to ~500 token windows
- For meeting transcripts: chunk by speaker turn or ~500 token windows with 100-token overlap
- For checklists/databases: chunk per row/item with full context in metadata
- Test: pull one real page, manually chunk it, count chunks, estimate total corpus size

**Estimate total vectors:**
```
Pages: ~200 (estimate from audit)
Avg chunks per page: ~8
Total chunks: ~1,600 vectors
At 384 dims (float32): ~1,600 × 384 × 4 = ~2.4 MB of vector data
```

**Phase 2 Deliverable:** A `NOTION_SCHEMA.md` documenting the content types, metadata schema, and chunking rules.

---

## Phase 3: Embedding Model Selection & Testing

**Goal:** Choose and validate an embedding model before building the full pipeline.

### Research 3.1 — Evaluate Embedding Options

| Model | Dims | Method | Cost | Latency |
|-------|------|--------|------|---------|
| `all-MiniLM-L6-v2` | 384 | Local (ONNX / Python) | Free | ~5ms/chunk |
| `nomic-embed-text-v1.5` | 768 | Local or API | Free/cheap | ~8ms/chunk |
| `text-embedding-3-small` | 1536 | OpenAI API | $0.02/1M tokens | ~50ms/chunk |
| `text-embedding-3-small` | 384 | OpenAI API (reduced) | $0.02/1M tokens | ~50ms/chunk |
| `voyage-3-lite` | 512 | Voyage API | $0.02/1M tokens | ~50ms/chunk |

**Investigate:**
- Is there a preferred local embedding runtime that works well in your environment? Check if `fastembed`, `sentence-transformers`, or `@xenova/transformers` (JS) is easiest to set up.
- For your content (consulting docs, technical architecture, meeting notes) — which model handles domain-specific language best?
- Test: embed 10 sample chunks with 2-3 models, query with natural language questions, compare result quality subjectively.

### Research 3.2 — Test Embedding → RVF Roundtrip

Write a minimal test script:

```python
# test_roundtrip.py
# 1. Embed 10 sample text chunks
# 2. Write to JSON in RVF ingest format
# 3. Run: rvf create test.rvf --dimension 384
# 4. Run: rvf ingest test.rvf --input test_chunks.json --format json
# 5. Embed a query string
# 6. Run: rvf query test.rvf --vector "0.1,0.2,..." --k 5
# 7. Verify results make semantic sense
```

**Investigate:**
- Does the full embed → ingest → query cycle work end-to-end?
- Is query latency acceptable? (Should be sub-millisecond for 1,600 vectors)
- Do the top-k results actually return the semantically relevant chunks?
- Does metadata come back with query results, or only vector IDs?

**Phase 3 Deliverable:** Chosen embedding model + a working `embed_and_ingest.py` (or `.js`) script.

---

## Phase 4: Build the Notion → RVF Pipeline

**Goal:** Automated pipeline that exports Notion, chunks, embeds, and ingests into RVF.

### 4.1 — Notion Export Script

Build a script that uses the Notion MCP tools (or Notion API directly) to pull pages:

```javascript
// notion_export.js
// 1. List all databases/pages in scope
// 2. For each page: fetch full content via notion-fetch
// 3. Extract plain text (strip Notion formatting)
// 4. Extract metadata (page properties, title, dates, tags)
// 5. Write raw pages to pages.json for chunking
```

**Research during implementation:**
- Does the Notion API return markdown or blocks? How do you get clean text?
- How do you handle nested pages (subpages within project spaces)?
- Rate limits: how fast can you pull pages? Notion API is typically 3 req/sec.
- How do you handle images, embeds, and tables within pages? (Likely: extract alt text / table as text, skip images)

### 4.2 — Chunking Script

```javascript
// chunk_pages.js
// Input: pages.json (from 4.1)
// Output: chunks.json (ready for embedding)
//
// For each page:
//   - Split by heading boundaries (H2/H3)
//   - If a section > 500 tokens, split further with overlap
//   - If a section < 100 tokens, merge with adjacent
//   - Attach metadata from page properties
//   - Generate chunk ID: hash(page_id + chunk_index)
```

**Research during implementation:**
- What tokenizer should you use for counting? (`tiktoken` for OpenAI models, or simple word count / 0.75)
- Do heading-based splits produce better retrieval than fixed-window? Test with a few pages.
- Should the page title be prepended to every chunk for context? (Usually yes — improves retrieval)

### 4.3 — Embedding Script

```javascript
// embed_chunks.js
// Input: chunks.json
// Output: embedded_chunks.json (with vector field added)
//
// For each chunk:
//   - Call embedding model
//   - Add "vector": [0.1, 0.2, ...] to the chunk object
//   - Batch if using API (e.g., 100 chunks per request)
```

**Research during implementation:**
- What's the max batch size for your chosen embedding model?
- Should you normalize vectors? (RVF uses cosine distance, which benefits from normalized vectors)
- Total embedding cost estimate: ~1,600 chunks × ~200 tokens/chunk = ~320K tokens ≈ $0.006 with OpenAI

### 4.4 — RVF Ingest Script

```bash
# Create the store
rvf create notion-knowledge.rvf --dimension 384

# Ingest all chunks
rvf ingest notion-knowledge.rvf --input embedded_chunks.json --format json

# Verify
rvf status notion-knowledge.rvf
rvf inspect notion-knowledge.rvf
```

Or programmatically via Node.js:

```javascript
const { RvfDatabase } = require('@ruvector/rvf-node');
const db = RvfDatabase.create('notion-knowledge.rvf', { dimension: 384 });

for (const chunk of embeddedChunks) {
  db.ingestBatch(
    new Float32Array(chunk.vector),
    [chunk.id],
    chunk.metadata  // if supported
  );
}

db.close();
```

**Research during implementation:**
- Does `rvf ingest --format json` handle metadata fields, or only id + vector?
- If metadata isn't supported in JSON ingest, can you use the Rust API directly?
- Verify with `rvf query` that results are correct after ingest.

**Phase 4 Deliverable:** Working pipeline scripts and a populated `notion-knowledge.rvf` file.

---

## Phase 5: Query Interface & Validation

**Goal:** Build a usable query interface and validate retrieval quality.

### 5.1 — CLI Query Validation

Prepare 10 test queries that you know the answers to:

```
1. "What is the authentication method for the AI Sales Order Entry solution?"
2. "What was discussed in the last Nucor HSS call?"
3. "What are the open items on the HSS project closure checklist?"
4. "How does the Content Understanding integration work?"
5. "What feedback did we give on the Sales Order Entry wiki?"
...
```

For each: embed the query, run `rvf query`, check if the top-3 results contain the relevant chunk.

**Investigate:**
- What's recall@3 and recall@5 for your test set?
- Are there queries that fail? Why? (Chunk too large, metadata mismatch, embedding model weakness)
- Does adding the page title to chunks improve retrieval?

### 5.2 — Build a Query Script

```javascript
// query_notion.js
// Usage: node query_notion.js "what auth method does the sales order entry use?"
//
// 1. Embed the query
// 2. Query RVF store (top 5)
// 3. Print results with source page title, chunk text preview, and distance score
// 4. Optionally: pass results to an LLM for a synthesized answer (RAG)
```

### 5.3 — HTTP Server Mode

```bash
rvf serve notion-knowledge.rvf --port 8080
```

**Investigate:**
- Does the HTTP server expose metadata in query responses?
- Can you add an auth layer or is it open by default?
- Latency under the HTTP path vs. direct CLI?

### 5.4 — RAG Integration (Optional)

If retrieval quality is good, wire the top-k chunks into a Claude API call:

```javascript
// rag_query.js
// 1. Embed user question
// 2. Query RVF for top 5 chunks
// 3. Build prompt: "Given this context: [chunks], answer: [question]"
// 4. Call Claude API for synthesized answer
// 5. Return answer with source citations
```

**Phase 5 Deliverable:** Working query script, retrieval quality metrics, and (optionally) a RAG endpoint.

---

## Phase 6: RVF-Specific Feature Exploration

**Goal:** Test the features that differentiate RVF from a plain vector store.

### Research 6.1 — COW Branching per Client

```bash
# Can we derive a client-scoped child from the main store?
rvf derive notion-knowledge.rvf nucor-hss.rvf --type filter
```

**Investigate:**
- Does `derive` with a filter actually create a lightweight child? Check file size.
- Can you apply a membership filter that only includes chunks where `client = "Nucor"`?
- Can you query the child store independently?
- What's the actual child file size vs. parent? (README claims ~162 bytes for metadata-only child)

### Research 6.2 — Witness Chain Audit Trail

```bash
rvf verify-witness notion-knowledge.rvf
```

**Investigate:**
- After ingesting, does the witness chain record the ingest operations?
- After querying, are queries logged in the chain?
- Can you verify the chain from the CLI? What does the output look like?
- Is this useful for your use case? (e.g., proving what knowledge was available at a point in time for client engagements)

### Research 6.3 — Filtered Search

**Investigate:**
- Test compound metadata filters: `rvf query ... --filter "client=Nucor AND content_type=technical_doc"`
- Does the CLI support filter syntax? Or only the Rust/Node API?
- Performance: is filtered search noticeably slower than unfiltered?

### Research 6.4 — Lineage & Versioning

**Investigate:**
- When you re-export Notion and re-ingest (after docs are updated), can you derive a new version with lineage tracking?
- Does `rvf inspect` show the parent-child lineage chain?
- Can you query against a specific version/generation?

### Research 6.5 — MCP Server Integration

```bash
npx @ruvector/rvf-mcp-server --transport stdio
```

**Investigate:**
- Wire the MCP server into Claude Code config. Does it actually connect?
- Can you issue `rvf_query` tool calls from Claude and get results?
- Can Claude ingest new vectors via the MCP tool? (Useful for incremental updates)
- Test: ask Claude "search my Notion knowledge for architecture decisions" — does the MCP tool return relevant results?

### Research 6.6 — WASM Browser Path

**Investigate:**
- Build the WASM target: `cargo build -p rvf-wasm --target wasm32-unknown-unknown --release`
- Does the output actually come in at ~46 KB?
- Can you load a `.rvf` file in the browser and query it? (This would be powerful for sharing knowledge bases with clients without a backend)
- What are the limitations of the WASM path? (No metadata filtering? No COW? Limited vector count?)

**Phase 6 Deliverable:** Feature assessment matrix documenting which RVF features are production-ready, which are useful for your use case, and which are aspirational.

---

## Phase 7: Incremental Update & Maintenance

**Goal:** Design the ongoing workflow for keeping the knowledge base current.

### 7.1 — Delta Update Strategy

**Investigate:**
- Notion API: can you query for pages modified since a given timestamp?
- If yes: build an incremental pipeline that only re-embeds changed pages
- If no: full re-export with diffing against previous chunk hashes
- Does RVF support deleting specific vectors by metadata filter? (`rvf delete --filter "source_page_id=abc"`)

### 7.2 — Scheduled Pipeline

Design a cron job or CI trigger:

```
1. Pull changed pages from Notion (since last sync timestamp)
2. Re-chunk and re-embed only changed pages
3. Delete old chunks for those pages from RVF
4. Ingest new chunks
5. Optionally: derive a new versioned snapshot with lineage
6. Update sync timestamp
```

**Investigate:**
- Does RVF support in-place updates, or is it append-only requiring compaction?
- How does compaction work? `rvf compact notion-knowledge.rvf` — does it reclaim space from deleted vectors?
- What's the compaction cost at ~2K vectors? (Should be trivial)

---

## Decision Log

Track key decisions as you go:

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Embedding model | MiniLM-L6 / nomic / OpenAI | TBD | Based on Phase 3 testing |
| Interface path | Rust CLI / Node.js / MCP | TBD | Based on Phase 1 research |
| Chunking strategy | Fixed window / heading-based / hybrid | TBD | Based on Phase 2 profiling |
| Dimension | 384 / 768 / 1536 | TBD | Matches chosen model |
| Update cadence | Manual / daily cron / on-edit webhook | TBD | Based on Phase 7 |

---

## Success Criteria

- [ ] Can create a `.rvf` file from Notion content end-to-end
- [ ] Semantic queries return relevant results (recall@5 ≥ 0.8 on test set)
- [ ] Can filter by client/project and get scoped results
- [ ] File is a single portable artifact (sharable, inspectable)
- [ ] Incremental updates work without full re-ingest
- [ ] At least 2 RVF-specific features (COW branching, witness chains, filtered search) provide real value beyond a basic vector DB
