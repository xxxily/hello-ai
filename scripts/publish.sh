#!/bin/bash

# Configuration and colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 1. Generate docs
log_info "Step 1: Running npm run ai:generate-docs..."
if npm run ai:generate-docs; then
    log_info "Step 1 Success."
else
    log_error "Step 1 Failed. Aborting."
    exit 1
fi

# 2. Build docs
log_info "Step 2: Running npm run docs:build..."
if npm run docs:build; then
    log_info "Step 2 Success."
else
    log_error "Step 2 Failed. Aborting."
    exit 1
fi

# 3. Git add & commit
log_info "Step 3: Running git add and commit..."
git add .
if git diff-index --quiet HEAD --; then
    log_warn "No changes to commit. Skipping git commit."
else
    if git commit -m "docs: Update docs"; then
        log_info "Step 3 Success."
    else
        log_error "Step 3 Failed. Aborting."
        exit 1
    fi
fi

# 4. Git push
log_info "Step 4: Running git push..."
if git push -u origin main; then
    log_info "Step 4 Success."
else
    log_error "Step 4 Failed. Aborting."
    exit 1
fi

# 5. Optional deploy script
DEPLOY_SCRIPT="./scripts/deploy-hello-ai.sh"
if [ -f "$DEPLOY_SCRIPT" ]; then
    log_info "Step 5: Running private deploy script: $DEPLOY_SCRIPT --yes"
    chmod +x "$DEPLOY_SCRIPT"
    if "$DEPLOY_SCRIPT" --yes; then
        log_info "Step 5 Success."
    else
        log_error "Step 5 Failed. Aborting."
        exit 1
    fi
else
    log_warn "Step 5: File $DEPLOY_SCRIPT not found. Skipping."
fi

log_info "=========================================="
log_info "  Workflow completed successfully! ✨"
log_info "=========================================="
