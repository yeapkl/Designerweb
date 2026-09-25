#!/usr/bin/env bash
# One-time GCP setup for deploying yeapkl/Designerweb to Cloud Run.
# Run in Google Cloud Shell (or anywhere gcloud is logged in as a project
# owner). Safe to re-run: anything that already exists is skipped.
# Reuses the pool + deployer SA from ai-assisted-api; creates only what this
# site needs. See docs/deploy/gcp-cloud-run-setup.md.
set -euo pipefail

PROJECT_ID="ai-deployment-509116"
REPO="yeapkl/Designerweb"             # exact case as GitHub reports it
POOL_ID="github-pool"                  # shared with ai-assisted-api
PROVIDER_ID="github-designerweb"       # new, trusts only this repo's main branch
DEPLOYER_SA="github-actions-deployer"  # shared deployer identity
RUNTIME_SA="designerweb-runtime"       # new, zero-permission runtime identity

gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEPLOYER_EMAIL="${DEPLOYER_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> Enabling required APIs (no-op if already on)"
gcloud services enable run.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com

echo "==> Workload Identity pool"
if ! gcloud iam workload-identity-pools describe "$POOL_ID" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global --display-name="GitHub Actions pool"
fi

echo "==> WIF provider for ${REPO} (main branch only)"
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
     --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --location=global \
    --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub Designerweb" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition="assertion.repository=='${REPO}' && assertion.ref=='refs/heads/main'" \
    --issuer-uri="https://token.actions.githubusercontent.com"
fi

echo "==> Deployer service account"
if ! gcloud iam service-accounts describe "$DEPLOYER_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$DEPLOYER_SA" \
    --display-name="GitHub Actions deployer (CI/CD)"
fi
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" --role="roles/run.admin" \
  --condition=None >/dev/null

echo "==> Allow ${REPO} to act as the deployer"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}" \
  >/dev/null

echo "==> Runtime service account (no roles — a static site needs none)"
if ! gcloud iam service-accounts describe "$RUNTIME_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA" \
    --display-name="Cloud Run runtime identity (imili-design-studio)"
fi
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_EMAIL" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" --role="roles/iam.serviceAccountUser" \
  >/dev/null

cat <<EOF

✅ Done. Add these under GitHub → yeapkl/Designerweb → Settings →
   Secrets and variables → Actions → Variables (they are identifiers, not secrets):

GCP_PROJECT_ID=${PROJECT_ID}
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}
GCP_SERVICE_ACCOUNT=${DEPLOYER_EMAIL}
GCP_RUNTIME_SERVICE_ACCOUNT=${RUNTIME_EMAIL}

Then make the image public:
  https://github.com/users/yeapkl/packages/container/designerweb/settings → Change visibility → Public
and re-run the failed "Deploy to Cloud Run" job.
EOF
