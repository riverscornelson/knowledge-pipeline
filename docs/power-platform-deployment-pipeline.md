# Power Platform Deployment Pipeline (Codex-Assisted)

This design describes an implementable CI/CD pipeline that promotes **unmanaged** Power Platform solutions from a development environment to **managed** solutions in pubdev, UAT, and production. It assumes a coding agent (Codex) can execute scripts and workflows stored in this repo.

## Goals
- Enforce source control as the system of record for solutions.
- Guarantee managed-only deployments to non-dev environments.
- Provide deterministic promotion gates (solution checker, tests, approvals).
- Keep the design executable by a coding agent with minimal customization.

## Repository layout
- `power-platform/solutions/<solution_name>/` – source-controlled solution unpacked with the Power Platform CLI (PAC) using the `unmanaged` type.
- `scripts/power-platform/` – automation scripts (PowerShell + Bash) that call PAC/PowerShell modules.
- `pipelines/` – pipeline YAML templates for GitHub Actions or Azure DevOps.
- `config/power-platform/` – environment-specific JSON for connection refs, data sources, and environment variables.

## Prerequisites
- Service principals with **Power Platform admin** and environment maker rights for dev, pubdev, UAT, prod.
- Azure Key Vault or repo-level secrets storing:
  - `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`
  - `DEV_ENV_URL`, `PUBDEV_ENV_URL`, `UAT_ENV_URL`, `PROD_ENV_URL`
- `pac` CLI and **Power Platform Build Tools** available in pipeline runners.
- Solution publishers aligned across environments.
- Branching model: `main` (prod), `release/*` (UAT), `develop` (dev/pubdev). Feature branches merge into `develop` via PR.

## Admin setup checklist (pre-pipeline)
Service connections already exist; ensure the underlying environments and security are correctly prepared before the agent runs the pipeline:

1. **Environment readiness**
   - Confirm dev, pubdev, UAT, and prod environments are provisioned in the same tenant with Dataverse enabled.
   - Align **solution publisher** (name, prefix) across all environments to avoid schema conflicts during managed imports.
   - Apply the org-wide **DLP policy** expected for production; ensure pubdev/UAT mirror it closely to avoid surprises.

2. **Identity and roles**
   - For each environment, assign the pipeline service principal:
     - *Power Platform admin* and *Environment Maker* (for solution import/export and config changes).
     - *System Administrator* role in Dataverse or equivalent privileges for solution import, connection reference updates, and environment variables.
   - Create a dedicated **connection owner** service account (per connector type if needed) and share it with the service principal if connectors require an owning user.

3. **Connections and references**
   - Pre-create required connectors in each environment (e.g., SharePoint, SQL, custom connectors) using the connection owner account.
   - Map connection references in `config/power-platform/*.json` to these connectors (name or ID) so `apply-config.ps1` can bind them post-import.
   - Verify connector runtime policies (e.g., data gateways, authentication methods) match across environments.

4. **Environment variables & secrets**
   - Seed baseline environment variables in each environment with placeholders; the pipeline will overwrite values during deployment.
   - Store sensitive values only in Key Vault or pipeline secrets; the JSON config files should reference secret names, not raw secrets.

5. **Solution health & tools**
   - Install **Solution Checker** and ALM Accelerator (optional) in the dev environment to enable automated checks.
   - Enable **Managed Environments** monitoring (telemetry, usage analytics) in UAT/prod if licensed, so post-deploy health signals are available.

6. **Approvals & governance**
   - Configure environment-level approvals in the pipeline platform for UAT/prod stages (manual approvers, change record links).
   - Document rollback owners and incident contacts; ensure they have rights to trigger redeployments or imports of the last known good artifact.

## Pipeline stages
Each stage is fully automatable and script-driven so a coding agent can run it end-to-end.

### Deterministic gates and AI judge flow
Codex is a **judge** that inserts checks *between* pipeline stages instead of orchestrating the whole pipeline. It runs as its own YAML job (or gated task) that consumes artifacts from the prior stage and emits a signed decision file that the next stage must verify. Every promotion stage must succeed at all of the following deterministic checks before moving forward:

**How Codex jobs run**
- Each judge job boots the agent, **retrieves the managed ZIP via PAC/Power Platform CLI** (never from untrusted locations), and executes a fixed review script; Codex does not orchestrate the full pipeline.
- Support **N configured judge prompts** (e.g., different policy packs) that all run independently against the same artifact; promotion pauses until *all* reports are ready and reviewed.
- Pipeline requires a **human approval after viewing every judge report** before import to any managed-only environment.

1. **Static governance** (pre-import)
   - Run `pac solution checker` with the **Managed Environment** ruleset (if available) and fail on any high/critical findings.
   - Validate solution metadata:
     - `SolutionType == Managed` for pubdev/UAT/prod artifacts.
     - Publisher name/prefix match the canonical value from `config/power-platform/publisher.json`.
     - Version follows SemVer with build number (e.g., `major.minor.patch.build`).
   - Confirm the artifact hash matches the build artifact published from the build stage to ensure immutability.
   - Ensure connection reference names in the solution are present in the target environment config JSON.
   - **Data-loss guard:** for upgrades, block imports where solution layering indicates component removal or downgrade (diff unmanaged vs managed unpacked files and require explicit override flag).
   - **Dependency guard:** verify new dependency IDs are in an allowlist (`config/power-platform/dependency-allowlist.json`) to prevent silent connector/library drift.

2. **AI policy vetting** (Codex judge job)
   - Codex reviews Solution Checker output, ALM Accelerator logs (if used), and pipeline metadata.
   - Codex enforces best-practice heuristics before allowing `pac solution import` to run:
     - Disallow importing **unmanaged** packages outside dev.
     - Block if solution contains canvas app hard-coded URLs pointing to dev (regex check over unpacked files).
     - Block if any new connector or custom connector is not listed in an allowlist (`config/power-platform/connector-allowlist.json`).
     - Require that environment variables are parameterized (no literal secrets in the unpacked XML/JSON).
     - Reject deployments if `pac solution online-version` for the target environment reports a newer major/minor than the artifact (protects against overwriting hotfixes).
     - Require that solution `UpgradeMode` matches an explicit input (update vs. stage-and-upgrade) to avoid accidental destructive upgrades.
   - If all rules pass, Codex emits a signed JSON decision artifact stored as a build attachment ("ai-judge.json") that the next job validates before proceeding. The decision includes a hash of the checked zip and a replay-protection nonce.

3. **Runtime validation** (post-import smoke tests)
   - Execute minimal deterministic smoke tests (API pings to critical flows/Dataverse tables) defined in `scripts/power-platform/smoke-tests.ps1`.
   - Fail fast and auto-roll back by re-importing the previous managed artifact if smoke tests fail.
   - Capture Dataverse plug-in trace logs or flow run IDs for evidence, stored as build artifacts.

4. **Approvals**
   - UAT and prod deployments require manual environment approvals plus verification that the AI judge decision artifact corresponds to the imported build ID.
   - Add an approval gate that checks for change record references and evidence uploads (Solution Checker report, smoke-test output).

### 1) Export & source control (dev)
- Trigger: merge to `develop` or manual run.
- Steps:
  1. Authenticate with PAC using service principal targeting the **dev** environment.
  2. `pac solution export --path out/<solution>.zip --name <solution> --managed false --environment $DEV_ENV_URL`.
  3. `pac solution unpack --zipFile out/<solution>.zip --folder power-platform/solutions/<solution> --solutionType Unmanaged`.
  4. Run `pac solution checker` and `pac canvas unpack` for apps if needed.
  5. Commit updated unpacked files to the repo (Codex can open PRs for humans to review).

### 2) Build managed artifact
- Trigger: PR merge to `develop` or manual.
- Steps:
  1. Ensure working tree matches repository state (no unmanaged exports).
  2. `pac solution pack --zipFile out/<solution>-unmanaged.zip --folder power-platform/solutions/<solution> --packagetype Unmanaged`.
  3. `pac solution pack --zipFile out/<solution>-managed.zip --folder power-platform/solutions/<solution> --packagetype Managed`.
  4. Publish build artifacts (`out/*.zip`) for downstream stages.
  5. Run unit tests for supporting code (plugins, pipelines) and lint scripts.
  6. Generate **Solution Checker**, **connector allowlist**, and **metadata diff** reports as artifacts consumed by the AI judge job.

### 3) Deploy to pubdev (managed)
- Trigger: successful build on `develop`.
- Steps:
  1. Authenticate against **pubdev** using service principal secrets.
  2. Verify the AI judge artifact matches the downloaded build (`scripts/power-platform/validate-ai-judge.ps1`).
  3. Import managed artifact: `pac solution import --path out/<solution>-managed.zip --environment $PUBDEV_ENV_URL --async --publish-changes`.
  4. Apply environment variable values and connection references using `config/power-platform/pubdev.json` and `pac application lifecycle upgrade data` or custom script.
  5. Run deterministic smoke tests and ALM checker; auto-roll back on failure.
  6. Export audit evidence (Solution Checker report, AI judge decision, smoke-test logs) for UAT approvers.

### 4) Promote to UAT
- Trigger: tag or PR merge to `release/*` branch plus manual approval gate.
- Steps identical to pubdev, pointing to `$UAT_ENV_URL` and `config/power-platform/uat.json`.
- Run automated regression suite and capture test evidence.
- Require Codex AI judge artifact attestation before import.
- Capture **solution layer report** (`pac solution list --solutions` plus `pac solution online-version`) before and after import to prove managed-only layering.

### 5) Promote to production
- Trigger: annotated tag or merge to `main` after change advisory approval.
- Steps:
  1. Validate AI judge artifact and release approval ticket reference.
  2. Import managed artifact to `$PROD_ENV_URL`.
  3. Apply production environment variables from `config/power-platform/prod.json`.
  4. Run post-deploy smoke tests and notify operations.
  5. If failure, roll back by re-importing last known good managed artifact from build artifacts.
  6. Capture **Managed Environment analytics** snapshots (if licensed) to validate usage and health after deployment.

## YAML skeleton (GitHub Actions)
```yaml
name: power-platform-ci
on:
  push:
    branches: [develop]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: microsoft/powerplatform-actions/actions-install@v2
      - name: Export unmanaged
        run: |
          pac auth create --kind DATAVERSE --url $DEV_ENV_URL \
            --tenant $TENANT_ID --applicationId $CLIENT_ID --clientSecret $CLIENT_SECRET
          pac solution export --path out/$SOLUTION-unmanaged.zip --name $SOLUTION --managed false --environment $DEV_ENV_URL
          pac solution unpack --zipFile out/$SOLUTION-unmanaged.zip --folder power-platform/solutions/$SOLUTION --solutionType Unmanaged
      - name: Pack managed/unmanaged
        run: |
          pac solution pack --zipFile out/$SOLUTION-unmanaged.zip --folder power-platform/solutions/$SOLUTION --packagetype Unmanaged
          pac solution pack --zipFile out/$SOLUTION-managed.zip --folder power-platform/solutions/$SOLUTION --packagetype Managed
      - uses: actions/upload-artifact@v4
        with:
          name: solutions
          path: out/

  deploy-pubdev:
    needs: build
    runs-on: ubuntu-latest
    environment: pubdev
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with: {name: solutions, path: out}
      - uses: microsoft/powerplatform-actions/actions-install@v2
      - name: Deploy managed to pubdev
        run: |
          pac auth create --kind DATAVERSE --url $PUBDEV_ENV_URL \
            --tenant $TENANT_ID --applicationId $CLIENT_ID --clientSecret $CLIENT_SECRET
          pac solution import --path out/$SOLUTION-managed.zip --environment $PUBDEV_ENV_URL --async --publish-changes
          scripts/power-platform/apply-config.ps1 -Config config/power-platform/pubdev.json -Environment $PUBDEV_ENV_URL
```

The same pattern can be duplicated for UAT and production with approvals on environments.

## Rollback and drift control
- Always archive managed artifacts with build numbers (e.g., `out/<solution>-managed-$(RunId).zip`).
- To roll back, re-import the previous managed artifact; Dataverse supports in-place downgrade when the previous version is greater or equal.
- Nightly job can re-export from prod as managed and compare unpacked content to `main` to detect drift.
- Add a **read-only monitor job** that runs `pac solution online-version` across environments to detect accidental unmanaged edits.

## How Codex fits
- Codex runs the scripts, updates unpacked solutions, and opens PRs after exports.
- It can inject environment secrets at runtime from Key Vault/GitHub secrets, keeping the repo free of credentials.
- For troubleshooting, Codex can read build logs, rerun `pac solution checker`, and suggest remediation steps directly in PR comments.

## Deliverables to implement now
- Populate `power-platform/solutions/<solution>/` with the unpacked dev solution.

## User-stated requirements recap
Use this checklist if handing the task to another coding agent; it consolidates all requirements from prior prompts:

1. **Pipeline scope** – Promote **unmanaged dev** solutions to **managed** artifacts for pubdev, UAT, and production using PAC/Power Platform CLI.
2. **Codex role** – Acts only as a **judge between stages**, not a full orchestrator. It boots, pulls the ZIP via PAC, runs deterministic checks, and emits reports/decision files.
3. **Multiple judge prompts** – Allow **N configured judge prompts** (e.g., different policy packs) that all must run before promotion continues; humans must review every report and approve.
4. **Deterministic gates** – Enforce Solution Checker, metadata/allowlist validation, drift and upgrade guards, connector/variable hygiene, and smoke tests before imports.
5. **Managed-only deployments** – Non-dev environments accept only managed packages; block unmanaged imports.
6. **Admin/setup** – Environments share publisher/DLP alignment, pre-created connectors/connection refs, environment variables, and service principals with admin + maker rights; secrets stored securely.
7. **Approvals & rollback** – Manual approvals for UAT/prod, evidence capture (checker reports, AI decision, smoke tests), and rollback plan via prior managed artifacts.
8. **Evidence & monitoring** – Capture layer reports, allowlists, Managed Environment analytics, and drift monitors across environments.
- Add `pipelines/` YAML using the skeleton above and environment-specific configs in `config/power-platform/`.
- Create `scripts/power-platform/apply-config.ps1` to set connection references and environment variables based on JSON.
- Register service principal secrets in pipeline environment settings and lock down approvals for UAT/prod.
