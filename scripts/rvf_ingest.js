#!/usr/bin/env node
/**
 * RVF ingest + query script.
 *
 * Usage:
 *   node rvf_ingest.js ingest <rvf_path> <chunks_json>
 *   node rvf_ingest.js query  <rvf_path> <query_json>
 *   node rvf_ingest.js status <rvf_path>
 *
 * Chunks JSON: [{id, vector, metadata: {fieldId: value, ...}}]
 * Query JSON:  {vector: [...], k: 5, filter?: {...}}
 */

const fs = require('fs');
const path = require('path');

// Resolve rvf-node from the installed location
let RvfDatabase;
const searchPaths = [
  path.join(__dirname, '..', 'node_modules', '@ruvector', 'rvf-node'),
  '/tmp/rvf-test/node_modules/@ruvector/rvf-node',
];
for (const p of searchPaths) {
  try {
    RvfDatabase = require(p).RvfDatabase;
    break;
  } catch (_) {}
}
if (!RvfDatabase) {
  console.error(JSON.stringify({ error: 'Cannot find @ruvector/rvf-node. Run: npm install @ruvector/rvf-node' }));
  process.exit(1);
}

const DIMENSION = 384;
const METRIC = 'cosine';
const BATCH_SIZE = 200;

function ingest(rvfPath, chunksPath) {
  const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf8'));

  let db;
  if (fs.existsSync(rvfPath)) {
    db = RvfDatabase.open(rvfPath);
  } else {
    db = RvfDatabase.create(rvfPath, { dimension: DIMENSION, metric: METRIC });
  }

  let accepted = 0;
  let rejected = 0;

  // Batch ingest: group chunks and send as a single ingestBatch call
  for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
    const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE);
    const n = batch.length;

    // Build flat vector array
    const flatVec = new Float32Array(n * DIMENSION);
    const ids = [];
    // Metadata is per-vector but the API takes a flat array shared across the batch.
    // Since each vector may have different metadata, we ingest metadata-bearing
    // vectors individually within the batch when metadata differs.
    // For simplicity and correctness with per-vector metadata, ingest one at a time
    // but within a single open session (the close() at the end writes the manifest).

    for (const chunk of batch) {
      const vec = new Float32Array(chunk.vector);
      const meta = [];

      if (chunk.metadata) {
        for (const [fieldIdStr, val] of Object.entries(chunk.metadata)) {
          const fieldId = parseInt(fieldIdStr, 10);
          if (isNaN(fieldId) || val === null || val === undefined || val === '') continue;
          meta.push({
            fieldId,
            valueType: typeof val === 'number' ? 'u64' : 'string',
            value: String(val),
          });
        }
      }

      try {
        const result = db.ingestBatch(vec, [chunk.id], meta.length > 0 ? meta : null);
        accepted += result.accepted;
        rejected += result.rejected;
      } catch (e) {
        rejected++;
      }
    }
  }

  // Compact to consolidate segments into a single manifest
  try {
    const compactResult = db.compact();
    // compact merges segments and writes a clean manifest
  } catch (e) {
    // Compaction is best-effort
  }

  const status = db.status();
  const witness = db.verifyWitness();
  db.close();

  console.log(JSON.stringify({
    accepted,
    rejected,
    totalVectors: status.totalVectors,
    fileSize: status.fileSize,
    witnessEntries: witness.entries,
    witnessValid: witness.valid,
  }));
}

function query(rvfPath, queryPath) {
  const queryData = JSON.parse(fs.readFileSync(queryPath, 'utf8'));
  const db = RvfDatabase.openReadonly(rvfPath);

  const vec = new Float32Array(queryData.vector);
  const k = queryData.k || 5;
  const opts = {};
  if (queryData.filter) {
    opts.filter = JSON.stringify(queryData.filter);
  }

  const results = db.query(vec, k, Object.keys(opts).length > 0 ? opts : null);
  db.close();

  console.log(JSON.stringify({ results }));
}

function status(rvfPath) {
  const db = RvfDatabase.openReadonly(rvfPath);
  const s = db.status();
  const w = db.verifyWitness();
  const dim = db.dimension();
  const met = db.metric();
  db.close();

  console.log(JSON.stringify({
    totalVectors: s.totalVectors,
    fileSize: s.fileSize,
    dimension: dim,
    metric: met,
    epoch: s.currentEpoch,
    compactionState: s.compactionState,
    deadSpaceRatio: s.deadSpaceRatio,
    witnessEntries: w.entries,
    witnessValid: w.valid,
  }));
}

// CLI
const [,, command, ...args] = process.argv;

switch (command) {
  case 'ingest':
    if (args.length < 2) { console.error('Usage: rvf_ingest.js ingest <rvf_path> <chunks_json>'); process.exit(1); }
    ingest(args[0], args[1]);
    break;
  case 'query':
    if (args.length < 2) { console.error('Usage: rvf_ingest.js query <rvf_path> <query_json>'); process.exit(1); }
    query(args[0], args[1]);
    break;
  case 'status':
    if (args.length < 1) { console.error('Usage: rvf_ingest.js status <rvf_path>'); process.exit(1); }
    status(args[0]);
    break;
  default:
    console.error('Commands: ingest, query, status');
    process.exit(1);
}
