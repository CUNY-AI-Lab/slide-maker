#!/bin/bash
# Deploy slide-maker to staging (tools.cuny.qzz.io/slide-maker)
# Run from a machine on the Tailscale/CUNY VPN network
#
# Usage: ./deploy-staging.sh
# Requires: sshpass, Tailscale/VPN connection
# Set DEPLOY_PASS env var or it will prompt

set -e

SERVER="smorello.adm@gc.cuny.edu@100.111.252.53"

if [ -z "$DEPLOY_PASS" ]; then
  echo -n "Server password: "
  read -s DEPLOY_PASS
  echo ""
fi

echo "Pushing to GitHub (upstream/CUNY-AI-Lab)..."
git push upstream main

echo "Deploying to server..."
sshpass -p "$DEPLOY_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "
set -e
echo '$DEPLOY_PASS' | sudo -S /data/slide-maker/deploy.sh
echo '$DEPLOY_PASS' | sudo -S /data/slide-maker/scripts/staging-processes.sh
"

echo ""
echo "Deployed! https://tools.cuny.qzz.io/slide-maker/"
