# Deploying to Cloud Run — one-time setup

This uses the same approach as `yeapkl/ai-assisted-api`: GitHub Actions
builds the image, pushes it to GHCR, and deploys to Cloud Run in your
existing project **`ai-deployment-509116`**. Authentication uses **Workload
Identity Federation**, so no service-account key is stored anywhere.

| | ai-assisted-api | **Designerweb (this repo)** |
|---|---|---|
| Cloud Run service | `hello-world-api` | **`imili-design-studio`** |
| Region | `us-central1` | **`asia-southeast1`** (Singapore, closest to Malaysian visitors) |
| Image | `ghcr.io/yeapkl/ai-assisted-api` | **`ghcr.io/yeapkl/designerweb`** |
| Secrets | `jwt-secret-key` in Secret Manager | **none** (static site) |
| Runtime SA | `cloud-run-runtime` | **`designerweb-runtime`**, a new account with zero roles |

> To use `us-central1` like the API, change `region:` in
> `.github/workflows/ci-cd.yml`. Both regions are covered by the Cloud Run
> free tier.

## Why a new WIF provider is needed

The existing `github-provider` only accepts tokens where
`assertion.repository == 'yeapkl/ai-assisted-api'`, so tokens from this repo
are rejected. The script below adds a second provider to the **same pool**,
scoped to `yeapkl/Designerweb`, and lets it use the **same deployer service
account**. The API project's setup is left untouched.

## 1. Run this once (Cloud Shell or any machine with `gcloud`)

Easiest: open Cloud Shell and run the ready-made, re-runnable script
[`scripts/gcp-setup.sh`](../../scripts/gcp-setup.sh). The commands below are what it does.

```bash
export PROJECT_ID="ai-deployment-509116"
export REPO="yeapkl/Designerweb"            # exact case as GitHub reports it
export POOL_ID="github-pool"                 # existing pool from the API setup
export PROVIDER_ID="github-designerweb"      # new provider for this repo
export DEPLOYER_SA="github-actions-deployer" # existing deployer SA
export RUNTIME_SA="designerweb-runtime"      # new, zero-permission runtime SA

gcloud config set project "$PROJECT_ID"
export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

# --- WIF provider that trusts only this repo -------------------------------
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --location="global" \
  --workload-identity-pool="$POOL_ID" \
  --display-name="GitHub Designerweb" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${REPO}' && assertion.ref=='refs/heads/main'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Let this repo (main branch only, per the condition above) act as the deployer.
gcloud iam service-accounts add-iam-policy-binding \
  "${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"

# --- Runtime identity: a static site needs no GCP permissions at all -------
gcloud iam service-accounts create "$RUNTIME_SA" \
  --display-name="Cloud Run runtime identity (imili-design-studio)"

# The deployer may attach this runtime SA to new revisions.
gcloud iam service-accounts add-iam-policy-binding \
  "${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# --- Values for step 3 ----------------------------------------------------
echo "GCP_PROJECT_ID=${PROJECT_ID}"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo "GCP_SERVICE_ACCOUNT=${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "GCP_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
```

The deployer already has `roles/run.admin` from the API setup, and the
required APIs (`run`, `iamcredentials`, `sts`) are already enabled.

## 2. Make the image pullable

This repo is private, so its GHCR package starts private too, and Cloud
Run can't pull a private GHCR image. After the **first** push to `main`
(the deploy job will fail once at this point), go to
`https://github.com/users/yeapkl/packages/container/designerweb/settings`
→ **Change visibility → Public**. The image contains only the public
website files.

## 3. Add repository variables on GitHub

In **Designerweb → Settings → Secrets and variables → Actions →
Variables**, add the four values printed in step 1. They are identifiers,
not secrets:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | `ai-deployment-509116` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/<number>/locations/global/workloadIdentityPools/github-pool/providers/github-designerweb` |
| `GCP_SERVICE_ACCOUNT` | `github-actions-deployer@ai-deployment-509116.iam.gserviceaccount.com` |
| `GCP_RUNTIME_SERVICE_ACCOUNT` | `designerweb-runtime@ai-deployment-509116.iam.gserviceaccount.com` |

## 4. Deploy

Merge to `main`. The pipeline runs:

1. **test**: HTML validation, `npm audit`, image build, the full QA and
   security suite, and Trivy scans. Any failure stops the pipeline.
2. **docker-publish**: pushes `ghcr.io/yeapkl/designerweb:sha-<commit>`.
3. **deploy-cloud-run**: authenticates via WIF, deploys that exact image
   to `imili-design-studio` (0–3 instances, 256 MiB), smoke-tests
   `/healthz`, then re-runs the security suite against the live HTTPS URL.

The URL appears in the job output and under the repo's **Environments →
gcp-production** tab.

## Custom domain (optional)

```bash
gcloud beta run domain-mappings create --service=imili-design-studio \
  --domain=www.example.com --region=asia-southeast1
```

Then add the DNS records it prints at your domain registrar. Google
provisions the TLS certificate automatically.

## Tearing down

```bash
gcloud run services delete imili-design-studio --region=asia-southeast1
gcloud iam workload-identity-pools providers delete github-designerweb \
  --location=global --workload-identity-pool=github-pool
gcloud iam service-accounts delete designerweb-runtime@ai-deployment-509116.iam.gserviceaccount.com
```
