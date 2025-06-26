#!/usr/bin/env bash
set -euo pipefail            # abort on first error, unset var, or pipe failure
cd "$(dirname "$0")"         # repo root (directory of this script)

source .venv/bin/activate    # adjust if your venv lives elsewhere

for step in ingest_drive capture_rss capture_websites capture_emails enrich enrich_rss
do
  echo "▶ Running $step.py"
  python "$step.py"
done

deactivate
echo "✅ Pipeline completed at $(date)"
