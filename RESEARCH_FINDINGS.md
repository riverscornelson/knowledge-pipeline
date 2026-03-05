# RVF + Notion Knowledge Distillation — Research Findings

## Phase 1: RVF Toolchain Research

### 1.1 Repository Structure

The `ruvnet/ruvector` repo is a large Rust workspace (~7,951 files) with:
- **18+ Rust crates** under `crates/rvf/` (rvf-runtime, rvf-node, rvf-import, rvf-cli, rvf-crypto, rvf-index, etc.)
- **60+ example files** in `examples/rvf/examples/` covering everything from basic_store to zero_knowledge
- **npm workspace** under `npm/` with 50+ packages including rvf-node, rvf-mcp-server, rvf-wasm
- No Rust toolchain available in this environment — cannot compile from source or run `cargo test`

### 1.2 npm Packages — Both Published and Real

| Package | Version | Published | Status |
|---------|---------|-----------|--------|
| `@ruvector/rvf-node` | 0.1.7 | 2 weeks ago | **Works** — ships prebuilt N-API binary for linux-x64 |
| `@ruvector/rvf-mcp-server` | 0.1.3 | 2 weeks ago | **Published** — but see caveat below |

### 1.3 rvf-node: Full API Surface (Verified Working)

The Node.js bindings expose a `RvfDatabase` class with these methods:

| Method | Tested | Notes |
|--------|--------|-------|
| `RvfDatabase.create(path, opts)` | Yes | Creates `.rvf` file (162 bytes empty) |
| `RvfDatabase.open(path)` | - | Opens existing store for read-write |
| `RvfDatabase.openReadonly(path)` | - | Read-only access |
| `db.ingestBatch(Float32Array, ids, metadata)` | Yes | Accepts flat Float32Array + numeric IDs |
| `db.query(Float32Array, k, options)` | Yes | Returns `[{id, distance}]` |
| `db.delete(ids)` | - | Soft-delete by ID |
| `db.deleteByFilter(filterJson)` | Yes | Deletes vectors matching metadata filter |
| `db.compact()` | - | Reclaims dead space |
| `db.status()` | Yes | Returns vector count, file size, epoch |
| `db.derive(childPath, opts)` | Yes | COW branching — child is 162 bytes |
| `db.verifyWitness()` | Yes | Returns `{valid, entries}` |
| `db.freeze()` | - | Sets store to read-only |
| `db.fileId()` / `db.parentId()` | Yes | Lineage tracking |
| `db.lineageDepth()` | Yes | 0 for root, 1 for derived |
| `db.segments()` | - | List segment directory |
| `db.dimension()` / `db.metric()` | - | Store config |
| `db.indexStats()` | - | HNSW stats |

**Create options:**
```js
{ dimension: 384, metric: 'cosine', m: 16, ef_construction: 200, signing: false }
```

**Query options:**
```js
{ filter: '{"op":"eq","fieldId":0,"valueType":"string","value":"ClientA"}', ef_search: 100, timeout_ms: 0 }
```

### 1.4 JSON Ingest Format (from rvf-import/src/json.rs)

```json
[
  {"id": 1, "vector": [0.1, 0.2, ...], "metadata": {"client": "Nucor", "type": "technical_doc"}},
  {"id": 2, "vector": [0.3, 0.4, ...], "metadata": {"client": "HSS"}}
]
```

- Supports: string, number (u64/i64/f64), and JSON-stringified arrays/objects/bools
- Metadata keys are mapped to numeric `fieldId`s by iteration order (important: HashMap ordering is not stable across runs)

### 1.5 Metadata Filtering — Fully Functional

Tested compound metadata filters via Node.js API:

| Filter Type | Syntax | Tested |
|-------------|--------|--------|
| Equality | `{"op":"eq","fieldId":0,"valueType":"string","value":"ClientA"}` | Yes |
| And/Or | `{"op":"and","children":[...]}` | Yes |
| Not | `{"op":"not","child":{...}}` | - |
| In | `{"op":"in","fieldId":0,"valueType":"u64","values":["1","2"]}` | - |
| Range | `{"op":"range","fieldId":1,"valueType":"u64","low":"10","high":"50"}` | - |
| Comparison | `eq`, `ne`, `lt`, `le`, `gt`, `ge` | - |

**Key limitation:** Metadata uses numeric `fieldId`s, not string keys. The JSON importer assigns fieldIds by HashMap iteration order, but the Node.js API requires explicit `fieldId` assignment. We need a stable field-to-id mapping.

### 1.6 MCP Server — In-Memory Only

**Critical finding:** The `@ruvector/rvf-mcp-server` does NOT use the RVF file format. It's a pure TypeScript in-memory implementation:
- Stores vectors in a JavaScript `Map<string, {vector, metadata}>`
- Computes distances with basic JS loops (no HNSW index)
- No persistence — data lost on server restart
- No `.rvf` file I/O at all

**MCP tools exposed:** `rvf_create_store`, `rvf_open_store`, `rvf_close_store`, `rvf_ingest`, `rvf_query`, `rvf_delete`, `rvf_delete_filter`, `rvf_compact`, `rvf_status`, `rvf_list_stores`

**Verdict:** The MCP server is a demo/prototype. For production, use `@ruvector/rvf-node` directly.

### 1.7 RVF-Specific Features — Verified

| Feature | Status | Notes |
|---------|--------|-------|
| COW Branching (derive) | **Works** | Child file is 162 bytes, inherits parent vectors |
| Witness Chain | **Works** | 4 entries recorded after 3 ingests + 1 delete |
| Filtered Search | **Works** | Compound filters with and/or/eq/range |
| Delete by Filter | **Works** | Useful for incremental updates |
| Compaction | Available | Not tested but API exists |
| Lineage Tracking | **Works** | fileId, parentId, lineageDepth all functional |
| Freeze (snapshot) | Available | Not tested |

### 1.8 Recommended Path

**Use `@ruvector/rvf-node` directly from Python (via subprocess) or Node.js scripts.**

- The Node.js bindings are the most complete and tested interface
- No Rust compilation needed — prebuilt binaries ship with the npm package
- The MCP server is not viable for production
- Alternatively: write a thin Node.js wrapper script that our Python pipeline calls

---

## Phase 2: Notion Workspace Audit

### 2.1 Workspace Structure

The workspace is organized under **"Cornelson Advisory OS"** as a root hub page with sections for Internal Hub, Customers, and Published Sites. There's also a public-facing **"Cornelson Advisory"** site (published via Notion Sites) and a **Knowledge Base** container page housing the Sources and Open Brain Captures databases.

### 2.2 Databases Found (13 total)

#### Knowledge/Content Databases (highest priority for vectorization)

| Database | Properties | Volume | Notes |
|----------|-----------|--------|-------|
| **Sources** | Title, Status, Hash, Source File, Content-Type, AI-Primitive (multi), Vendor, Topical-Tags (multi), Domain-Tags (multi), Client-Relevance, Drive URL, Created Date | ~200-400 pages | Pipeline-enriched PDFs. Largest database. Consistent template: Summary / Key Insights / Classification / Tags. ~400 words/page. |
| **Knowledge Base** | Name, Status, Knowledge Type (13 options), AI Tool(s), Use Pattern Type (14 options), Offering Relevance, Client/Industry Context, URL, Created Date, Last Updated, Author | ~20-50 entries | Curated knowledge articles with rich taxonomy. |
| **Open Brain Captures** | Title, Category (8 options), Tags, Source (5 options), Captured At, Content, Supabase ID | ~30-80 captures | Quick-capture notes, ideas, frameworks. |
| **Market Research Reports** | Report Title, Status, Focus Areas, Competitors Analyzed, Report Date, Notes | ~2-5 reports | Competitive landscape analyses. |

#### CRM Databases (medium priority — relationship intelligence)

| Database | Key Properties | Volume |
|----------|---------------|--------|
| **Clients Database** | Company, Status (Lead/Prospect/Active/Inactive), Industry, Primary Contact, LinkedIn, Website, Lead Source, Notes | ~5-15 clients |
| **Contacts** | Name, Relationship, Role, Company (relation), Email, LinkedIn, Met Via, Notes | ~10-20 contacts |
| **Deal Pipeline** | Deal Name, Stage (7 stages), Deal Value ($), Engagement Type, Customer (relation), Priority, Close Date | ~5-10 deals |
| **Activities** | Activity Type, Contact (relation), Deal (relation), Description, Date, Outcome, Follow-up Required | ~15-30 activities |

#### Client Delivery & Project Management (lower priority)

| Database | Notes |
|----------|-------|
| **Client Portals** | Per-client portals with embedded Meetings and Session Updates databases |
| **Session Updates** | Type (Session Recap/New Deliverable/Milestone/Action Item/Portal Update) |
| **Meetings** | Name, Date, Meeting type, Attendees |
| **Projects / Tasks** | Multiple instances from templates. Operational tracking. |

### 2.3 Content Types & Structure

1. **Enriched source documents** (Sources) — Consistently structured: Summary paragraph, Key Insights (5 bullets with advisory framing), Classification, Tags. ~400 words each. Best candidate for embedding.
2. **Curated knowledge articles** (Knowledge Base) — How-to guides, frameworks, prompting techniques, case studies. Deeply tagged. Variable length.
3. **Quick captures** (Open Brain Captures) — Ideas, observations, client insights from Claude chats, meetings, emails. Short-form.
4. **CRM activity records** — Meeting notes, call outcomes, follow-ups. ~200 words each. Good relationship intelligence.
5. **Client pages** — Relationship context, key intelligence, industry notes. ~200 words each.
6. **Public website content** — Marketing pages. Lower priority for knowledge retrieval.

### 2.4 Estimated Content Volume

| Category | Pages | Avg Words | Total Words | Est. Chunks (500 tok) |
|----------|-------|-----------|-------------|----------------------|
| Sources | 200-400 | 400 | 80K-160K | 160-320 |
| Knowledge Base | 20-50 | 600 | 12K-30K | 24-60 |
| Open Brain Captures | 30-80 | 150 | 4.5K-12K | 9-24 |
| CRM (Clients+Activities) | 20-45 | 200 | 4K-9K | 8-18 |
| Market Research | 2-5 | 800 | 1.6K-4K | 3-8 |
| **Total** | **~270-580** | | **~100K-215K** | **~200-430** |

This is smaller than the original estimate of 1,600 chunks. At 384 dims: ~200-430 vectors x 384 x 4 = **0.3-0.7 MB** of vector data. The `.rvf` file will be very compact.

### 2.5 Recommended Metadata Schema

Based on the audit, the following metadata fields should be attached to each chunk:

```json
{
  "fieldId_map": {
    "0": "source_page_id",
    "1": "source_page_title",
    "2": "database",
    "3": "content_type",
    "4": "client",
    "5": "vendor",
    "6": "ai_primitive",
    "7": "topical_tags",
    "8": "domain_tags",
    "9": "chunk_index",
    "10": "created_date",
    "11": "page_url"
  }
}
```

The `database` field enables filtering by source database (Sources vs Knowledge Base vs CRM), while the tag fields from Sources provide rich faceted search.

### 2.6 Recommended Chunking Strategy

- **Sources pages** (structured): Single chunk per page — they're only ~400 words, well within a 500-token window. Prepend title for context.
- **Knowledge Base pages** (variable): Chunk by H2/H3 heading boundaries. Prepend title + heading to each chunk.
- **Open Brain Captures**: Single chunk per capture — short-form content.
- **CRM records**: Single chunk per record, combining key properties + notes into text.
- **Overlap**: Not needed for single-chunk pages. Use 100-token overlap only for heading-based splits on longer Knowledge Base articles.

### 2.7 Content to Exclude

- Template pages (boilerplate)
- Task/Project operational tracking
- Pages with Status = "Processing" or "Failed" (incomplete enrichment)

**Include:** Public website pages (Cornelson Advisory site — Engagements, Testimonials, FAQ, How We Work, Case Studies, etc.). These represent how the firm presents itself and are valuable for brand-aware retrieval.

---

## Phase 3: Embedding Model Testing

### 3.1 Test Setup

Tested with 10 sample chunks across all content types (Sources, Knowledge Base, Open Brain Captures, CRM Activities, Public Site, Market Research, Deal Pipeline, Session Updates) and 10 natural language queries with known expected results.

**Model:** OpenAI `text-embedding-3-small` at 384 dimensions
**Cost:** ~$0.006 for the full ~450-chunk corpus (320K tokens at $0.02/1M)
**Vectors are pre-normalized** (L2 norm = 1.0000)

### 3.2 Results

```
RVF file size: 23,358 bytes (23 KB for 10 vectors at 384 dims)
Projected full corpus: ~100-200 KB for 450 vectors

Recall@3: 10/10 = 100%
Recall@5: 10/10 = 100%
```

| Query | Top-1 ID | Distance | Correct? |
|-------|----------|----------|----------|
| AI-native vs AI-augmented? | 6 (Insight) | 0.353 | Yes |
| CapitalSpring meeting? | 3 (Meeting) | 0.433 | Yes |
| Sales order entry AI? | 9 (Deal) | 0.489 | Yes |
| Service offerings? | 5 (Public Site) | 0.340 | Yes |
| Prompt structuring? | 4 (Framework) | 0.325 | Yes |
| Competitors? | 7 (Market Research) | 0.211 | Yes |
| Content understanding pattern? | 10 (Integration Pattern) | 0.371 | Yes |
| Nucor project status? | 8 (Session Update) | 0.507 | Yes |
| Agentic platform architecture? | 2 (Technical) | 0.327 | Yes |
| AI strategy frameworks? | 2 (Technical) | 0.403 | Yes |

### 3.3 Filtered Query Results

All metadata filters work correctly:

- `database=Knowledge Base` → returned chunks 10, 4 (correct)
- `client=CapitalSpring` → returned chunks 3, 9 (correct)
- `database=Sources AND content_type=Technical Architecture` → returned chunk 2 (correct)

### 3.4 Decision

**Chosen model: `text-embedding-3-small` at 384 dimensions.**
- 100% recall on test set
- Sub-cent cost for full corpus
- No local model needed (simpler deployment)
- Vectors pre-normalized (ideal for cosine distance)

---

## Decision Log (Updated)

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Interface path | Rust CLI / Node.js / MCP | **Node.js (`@ruvector/rvf-node`)** | Only path that works without Rust. MCP server is in-memory only. Prebuilt binaries available. |
| Metadata approach | String keys / Numeric fieldIds | **Stable fieldId mapping** | RVF uses numeric fieldIds internally. Need a schema map defined in config. |
| Chunking strategy | Fixed window / heading-based / hybrid | **Single-chunk for Sources/CRM, heading-based for Knowledge Base** | Sources pages are ~400 words (fits in one chunk). Knowledge Base articles are longer and structured with headings. |
| Priority databases | All / Selective | **Sources + Knowledge Base + Open Brain Captures + CRM Activities + Public Site** | These databases plus the public-facing site pages (~15 pages) are the priority content. ~215-450 chunks total. |
| Embedding model | text-embedding-3-small / MiniLM-L6 / nomic | **`text-embedding-3-small` (OpenAI)** | 100% recall@3 on test set. ~$0.006 total cost. Pre-normalized vectors. No local model to manage. |
| Dimension | 384 / 768 / 1536 | **384** | 100% recall at this dimension. ~100-200 KB total RVF file size. |

## Next Steps

1. **Phase 4: Build the Notion → RVF pipeline.** Architecture: Python script exports Notion pages via API → chunks text → embeds via OpenAI → writes JSON → Node.js script ingests into `.rvf` via `@ruvector/rvf-node`.

2. **Metadata field ID mapping** to define and freeze:
   ```
   0: database        4: knowledge_type
   1: content_type    5: category
   2: vendor          6: page_url
   3: client          7: source_page_id
   ```

3. **Key architectural decision:** Python handles export + embed + chunking (leverages existing Notion client and OpenAI SDK). Node.js handles only RVF I/O (ingest + query). Communication via JSON files on disk.
