#!/bin/bash
set -e

# Install all workspace dependencies
pnpm install

# Rebuild lib/db TypeScript (schema types must be compiled before api-server build)
cd lib/db && npx tsc -b && cd ../..

# Push schema changes to DB (force to skip interactive prompts)
pnpm --filter @workspace/db run push-force
