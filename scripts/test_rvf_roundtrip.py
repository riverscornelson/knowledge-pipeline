"""Phase 3: Embedding → RVF → Query roundtrip test.

Tests OpenAI text-embedding-3-small (384 dims) with @ruvector/rvf-node.
Embeds sample chunks, ingests into .rvf, queries with natural language.
"""

import json
import os
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

MODEL = "text-embedding-3-small"
DIMS = 384

# Sample chunks simulating real Notion content
CHUNKS = [
    {
        "id": 1,
        "text": "Executive Briefing: AI-Native Business Strategy. Organizations should stop bolting AI onto existing processes and instead redesign workflows from the ground up around AI capabilities. Key insight: companies that adopt AI-native approaches see 3x faster time-to-value compared to AI-augmented strategies.",
        "metadata": {"database": "Sources", "content_type": "Executive Briefing", "vendor": "Cornelson Advisory"},
    },
    {
        "id": 2,
        "text": "Agentic Platform Architecture: Systems Thinking approach to building AI agent platforms. Covers reactive digital workflows vs predictive AI operations. Key patterns include event-driven orchestration, tool-use loops, and human-in-the-loop checkpoints for high-stakes decisions.",
        "metadata": {"database": "Sources", "content_type": "Technical Architecture", "vendor": ""},
    },
    {
        "id": 3,
        "text": "Meeting notes: CapitalSpring discovery call. Discussed their current tech stack (SAP, Salesforce), pain points around manual data entry in sales order processing. They expressed interest in AI-assisted sales order entry and document understanding. Follow-up: send proposal for pilot engagement.",
        "metadata": {"database": "Activities", "content_type": "Meeting Notes", "client": "CapitalSpring"},
    },
    {
        "id": 4,
        "text": "Knowledge Base: Prompt Engineering for Enterprise Consulting. Framework for structuring prompts in advisory contexts: (1) Define the persona and expertise level, (2) Provide domain context from client materials, (3) Specify output format and constraints, (4) Include examples of good output. Works best with Claude and GPT-4 class models.",
        "metadata": {"database": "Knowledge Base", "content_type": "Framework", "knowledge_type": "Prompting Technique"},
    },
    {
        "id": 5,
        "text": "Cornelson Advisory helps organizations navigate AI transformation with hands-on guidance. Our engagements include AI Strategy Workshops, Technology Assessment, Pilot Development, and Organizational Change Management. We work with mid-market companies in manufacturing, financial services, and professional services.",
        "metadata": {"database": "Public Site", "content_type": "Marketing", "page": "How We Work"},
    },
    {
        "id": 6,
        "text": "Open Brain Capture: Insight from Claude chat — the distinction between AI-augmented and AI-native is crucial for positioning. Augmented = adding AI to existing process. Native = process designed around AI from scratch. This framing resonates strongly with C-suite executives who feel stuck in pilot purgatory.",
        "metadata": {"database": "Open Brain Captures", "content_type": "Insight", "category": "Framework"},
    },
    {
        "id": 7,
        "text": "Market Research: Competitive landscape for AI consulting in the mid-market. Key competitors include Slalom, West Monroe, and Resultant. Differentiators for Cornelson: deeper technical hands-on work, focus on AI-native vs augmented, and the knowledge pipeline approach to continuous learning.",
        "metadata": {"database": "Market Research", "content_type": "Competitive Analysis"},
    },
    {
        "id": 8,
        "text": "Client portal update for Nucor HSS project: Completed Phase 1 authentication module. Sales order entry AI prototype processes 85% of orders without human intervention. Next milestone: integration testing with SAP backend. Timeline on track for Q2 delivery.",
        "metadata": {"database": "Session Updates", "content_type": "Project Update", "client": "Nucor"},
    },
    {
        "id": 9,
        "text": "Deal Pipeline: CapitalSpring AI Sales Order Entry. Stage: Proposal. Deal value: $150K. Engagement type: Pilot + Production Build. Priority: High. Next action: finalize SOW and send for review. Close date target: March 2026.",
        "metadata": {"database": "Deal Pipeline", "content_type": "Deal Record", "client": "CapitalSpring"},
    },
    {
        "id": 10,
        "text": "Knowledge Base: Content Understanding Integration Pattern. Uses document AI to extract structured data from unstructured PDFs. Pipeline: PDF upload → OCR/extraction → schema mapping → validation → system of record update. Applicable to invoice processing, sales orders, compliance documents.",
        "metadata": {"database": "Knowledge Base", "content_type": "Integration Pattern", "knowledge_type": "Technical Guide"},
    },
]

# Test queries with expected relevant chunk IDs
QUERIES = [
    ("What is the difference between AI-native and AI-augmented?", [1, 6]),
    ("What was discussed in the CapitalSpring meeting?", [3, 9]),
    ("How does the sales order entry AI work?", [8, 3]),
    ("What are Cornelson Advisory's service offerings?", [5]),
    ("How should I structure prompts for consulting work?", [4]),
    ("Who are our competitors in AI consulting?", [7]),
    ("What is the content understanding integration pattern?", [10, 2]),
    ("What is the status of the Nucor project?", [8]),
    ("How does agentic platform architecture work?", [2]),
    ("What frameworks do we use for AI strategy?", [1, 6, 4]),
]


def embed_texts(client: OpenAI, texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(input=texts, model=MODEL, dimensions=DIMS)
    return [item.embedding for item in resp.data]


def main() -> None:
    client = OpenAI()

    # Step 1: Embed all chunks
    print(f"Embedding {len(CHUNKS)} chunks with {MODEL} ({DIMS} dims)...")
    texts = [c["text"] for c in CHUNKS]
    vectors = embed_texts(client, texts)
    print(f"  Done. First vector norm check: {sum(v**2 for v in vectors[0]):.4f}")

    # Step 2: Write embedded chunks to JSON for Node.js ingestion
    embedded_chunks = []
    for chunk, vector in zip(CHUNKS, vectors):
        embedded_chunks.append(
            {
                "id": chunk["id"],
                "vector": vector,
                "text": chunk["text"],
                "metadata": chunk["metadata"],
            }
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        chunks_path = Path(tmpdir) / "chunks.json"
        rvf_path = Path(tmpdir) / "notion-knowledge.rvf"
        queries_path = Path(tmpdir) / "queries.json"
        results_path = Path(tmpdir) / "results.json"

        with open(chunks_path, "w") as f:
            json.dump(embedded_chunks, f)

        # Step 3: Embed queries
        print(f"Embedding {len(QUERIES)} queries...")
        query_texts = [q[0] for q in QUERIES]
        query_vectors = embed_texts(client, query_texts)

        query_data = [
            {"text": q[0], "vector": qv, "expected": q[1]}
            for q, qv in zip(QUERIES, query_vectors)
        ]
        with open(queries_path, "w") as f:
            json.dump(query_data, f)

        # Step 4: Run Node.js script for RVF ingest + query
        node_script = Path(tmpdir) / "rvf_test.js"
        node_script.write_text(NODE_SCRIPT)

        print("Running RVF ingest + query via Node.js...")
        result = subprocess.run(
            ["node", str(node_script)],
            capture_output=True,
            text=True,
            cwd=tmpdir,
            env={**os.environ, "RVF_NODE_PATH": "/tmp/rvf-test/node_modules/@ruvector/rvf-node"},
        )

        if result.returncode != 0:
            print(f"Node.js error:\n{result.stderr}")
            return

        # Step 5: Parse and evaluate results
        results = json.loads(result.stdout)

        print(f"\nRVF file size: {results['file_size']} bytes")
        print(f"Vectors ingested: {results['total_vectors']}")
        print(f"\n{'='*80}")
        print(f"{'Query':<55} {'Top-3 IDs':<15} {'Hit?':<6} {'Dist'}")
        print(f"{'='*80}")

        hits_at_3 = 0
        hits_at_5 = 0
        total = len(QUERIES)

        for qr in results["query_results"]:
            top3_ids = [r["id"] for r in qr["results"][:3]]
            top5_ids = [r["id"] for r in qr["results"][:5]]
            expected = qr["expected"]
            hit3 = any(e in top3_ids for e in expected)
            hit5 = any(e in top5_ids for e in expected)
            if hit3:
                hits_at_3 += 1
            if hit5:
                hits_at_5 += 1

            dist = f"{qr['results'][0]['distance']:.4f}" if qr["results"] else "N/A"
            mark = "Y" if hit3 else "N"
            query_short = qr["query"][:53]
            print(f"{query_short:<55} {str(top3_ids):<15} {mark:<6} {dist}")

        print(f"\n{'='*80}")
        print(f"Recall@3: {hits_at_3}/{total} = {hits_at_3/total:.1%}")
        print(f"Recall@5: {hits_at_5}/{total} = {hits_at_5/total:.1%}")

        # Step 6: Test filtered query
        print(f"\n--- Filtered Query Test ---")
        for fr in results.get("filtered_results", []):
            print(f"Filter: {fr['filter']}")
            print(f"  Results: {[r['id'] for r in fr['results']]}")


NODE_SCRIPT = r"""
const path = require('path');
const fs = require('fs');
const { RvfDatabase } = require(process.env.RVF_NODE_PATH);

const chunks = JSON.parse(fs.readFileSync('chunks.json', 'utf8'));
const queries = JSON.parse(fs.readFileSync('queries.json', 'utf8'));

// Field ID mapping
const FIELD_MAP = {
  database: 0,
  content_type: 1,
  vendor: 2,
  client: 3,
  knowledge_type: 4,
  category: 5,
  page: 6,
};

// Create store
const db = RvfDatabase.create('notion-knowledge.rvf', {
  dimension: 384,
  metric: 'cosine',
});

// Ingest chunks with metadata
for (const chunk of chunks) {
  const vec = new Float32Array(chunk.vector);
  const meta = [];
  for (const [key, val] of Object.entries(chunk.metadata)) {
    if (FIELD_MAP[key] !== undefined && val) {
      meta.push({
        fieldId: FIELD_MAP[key],
        valueType: 'string',
        value: String(val),
      });
    }
  }
  db.ingestBatch(vec, [chunk.id], meta.length > 0 ? meta : null);
}

const status = db.status();

// Run queries
const queryResults = queries.map(q => {
  const vec = new Float32Array(q.vector);
  const results = db.query(vec, 5, null);
  return {
    query: q.text,
    expected: q.expected,
    results: results,
  };
});

// Run filtered queries
const filteredResults = [];

// Filter: database = "Knowledge Base"
const kbFilter = JSON.stringify({op: 'eq', fieldId: 0, valueType: 'string', value: 'Knowledge Base'});
const kbResults = db.query(new Float32Array(queries[0].vector), 5, { filter: kbFilter });
filteredResults.push({ filter: 'database=Knowledge Base', results: kbResults });

// Filter: client = "CapitalSpring"
const csFilter = JSON.stringify({op: 'eq', fieldId: 3, valueType: 'string', value: 'CapitalSpring'});
const csResults = db.query(new Float32Array(queries[1].vector), 5, { filter: csFilter });
filteredResults.push({ filter: 'client=CapitalSpring', results: csResults });

// Compound filter: database = "Sources" AND content_type = "Technical Architecture"
const compoundFilter = JSON.stringify({
  op: 'and',
  children: [
    {op: 'eq', fieldId: 0, valueType: 'string', value: 'Sources'},
    {op: 'eq', fieldId: 1, valueType: 'string', value: 'Technical Architecture'},
  ]
});
const compResults = db.query(new Float32Array(queries[0].vector), 5, { filter: compoundFilter });
filteredResults.push({ filter: 'database=Sources AND content_type=Technical Architecture', results: compResults });

const fileSize = fs.statSync('notion-knowledge.rvf').size;

db.close();

console.log(JSON.stringify({
  file_size: fileSize,
  total_vectors: status.totalVectors,
  query_results: queryResults,
  filtered_results: filteredResults,
}));
"""

if __name__ == "__main__":
    main()
