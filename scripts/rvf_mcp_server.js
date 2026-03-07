#!/usr/bin/env node
/**
 * Minimal MCP stdio server for RVF knowledge base queries.
 *
 * Exposes two tools:
 *   - rvf_query: semantic vector search (requires embedding via OpenAI)
 *   - rvf_status: get store stats
 *
 * Usage (Claude Code .mcp.json):
 *   { "command": "node", "args": ["scripts/rvf_mcp_server.js"] }
 */

const readline = require('readline');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load .env if OPENAI_API_KEY is not already in the environment
if (!process.env.OPENAI_API_KEY) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (_) {}
}

const RVF_PATH = process.env.RVF_STORE_PATH ||
  path.join(__dirname, '..', 'data', 'notion-knowledge.rvf');
const INDEX_PATH = RVF_PATH.replace(/\.rvf$/, '.index.json');
const INGEST_SCRIPT = path.join(__dirname, 'rvf_ingest.js');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Load text index for enriching results
let textIndex = {};
try {
  textIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
} catch (_) {}

const SERVER_INFO = {
  name: 'rvf-knowledge-base',
  version: '0.1.0',
};

const TOOLS = [
  {
    name: 'rvf_query',
    description:
      'Semantic vector search over the Cornelson Advisory knowledge base. ' +
      'Finds content by meaning using 384-dim embeddings. Returns chunks ' +
      'with title, database, URL, text preview, and similarity score.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        k: { type: 'number', description: 'Number of results (default 5, max 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'rvf_status',
    description: 'Get status of the RVF vector store (vector count, file size, etc.).',
    inputSchema: { type: 'object', properties: {} },
  },
];

function embedQuery(text) {
  // Shell out to a tiny Python script for embedding
  const py = `
import sys, json
from openai import OpenAI
c = OpenAI(api_key="${OPENAI_API_KEY}")
r = c.embeddings.create(input=[sys.argv[1]], model="text-embedding-3-small", dimensions=384)
print(json.dumps(r.data[0].embedding))
`;
  const result = execFileSync('python3', ['-c', py, text], {
    encoding: 'utf8',
    timeout: 30000,
  });
  return JSON.parse(result.trim());
}

function handleQuery(args) {
  if (!OPENAI_API_KEY) {
    return { error: 'OPENAI_API_KEY not set — cannot embed query' };
  }
  if (!fs.existsSync(RVF_PATH)) {
    return { error: `RVF store not found at ${RVF_PATH}` };
  }

  const vector = embedQuery(args.query);
  const k = Math.min(args.k || 5, 20);

  const tmpFile = `/tmp/rvf_mcp_query_${Date.now()}.json`;
  fs.writeFileSync(tmpFile, JSON.stringify({ vector, k }));

  try {
    const raw = execFileSync('node', [INGEST_SCRIPT, 'query', RVF_PATH, tmpFile], {
      encoding: 'utf8',
      timeout: 15000,
    });
    const { results } = JSON.parse(raw);
    return results.map(r => {
      const entry = textIndex[String(r.id)] || {};
      return {
        title: entry.title || '',
        database: entry.database || '',
        url: entry.url || '',
        text: (entry.text || '').slice(0, 500),
        score: r.distance,
      };
    });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

function handleStatus() {
  if (!fs.existsSync(RVF_PATH)) {
    return { error: `RVF store not found at ${RVF_PATH}` };
  }
  const raw = execFileSync('node', [INGEST_SCRIPT, 'status', RVF_PATH], {
    encoding: 'utf8',
    timeout: 10000,
  });
  return JSON.parse(raw);
}

// --- MCP JSON-RPC stdio transport ---

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: '2.0', id, result });
  process.stdout.write(msg + '\n');
}

function sendError(id, code, message) {
  const msg = JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message },
  });
  process.stdout.write(msg + '\n');
}

function handleMessage(line) {
  let req;
  try {
    req = JSON.parse(line);
  } catch (_) {
    return;
  }

  const { id, method, params } = req;

  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      break;

    case 'notifications/initialized':
      // No response needed for notifications
      break;

    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};
      try {
        let result;
        if (toolName === 'rvf_query') {
          result = handleQuery(args);
        } else if (toolName === 'rvf_status') {
          result = handleStatus();
        } else {
          sendError(id, -32601, `Unknown tool: ${toolName}`);
          return;
        }
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
      } catch (e) {
        sendResponse(id, {
          content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }],
          isError: true,
        });
      }
      break;
    }

    default:
      if (id !== undefined) {
        sendError(id, -32601, `Method not found: ${method}`);
      }
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', handleMessage);
