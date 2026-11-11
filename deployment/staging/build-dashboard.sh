set -euo pipefail
REL=$1; B=$2
cd "$B/releases/$REL"
set -a; . "$B/shared/.env"; set +a
start=$(date +%s)
npm ci --include=dev --workspace @my-people/admin-web --no-audit --no-fund --loglevel=error > /tmp/admin-npm-ci.log 2>&1 || { tail -20 /tmp/admin-npm-ci.log; exit 1; }
echo "npm ci ok in $(( $(date +%s) - start ))s; node_modules $(du -sh node_modules | cut -f1)"
NODE_OPTIONS=--max-old-space-size=1536 npm run build --workspace @my-people/admin-web > /tmp/admin-build.log 2>&1 || { tail -30 /tmp/admin-build.log; exit 1; }
echo "build ok in $(( $(date +%s) - start ))s"
grep -E "Compiled|Generating|Finished" /tmp/admin-build.log | head -5
node -e "console.log('next binary:', require.resolve('next/dist/bin/next', {paths: ['apps/admin-web']}))"
