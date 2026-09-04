#!/usr/bin/env node
/**
 * deploy-doctor — pre-flight and post-deploy checks for a Vercel deployment.
 *
 *   node scripts/deploy-doctor.mjs                     pre-flight only
 *   node scripts/deploy-doctor.mjs --url https://x.app  also probe the live site
 *   node scripts/deploy-doctor.mjs --env server/.env.production
 *
 * Every check here exists because it cost real time on a previous deployment.
 * The failures this catches are the quiet kind: the push succeeds, the build is
 * green or silently skipped, and the site keeps serving an older version with no
 * error anywhere obvious.
 *
 * Exit code 1 if any FAIL. Warnings do not fail the run.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const URL_ARG = argOf('--url');
const ENV_FILE = argOf('--env');

let pass = 0, warn = 0, fail = 0;
const ok = (m, d = '') => { pass++; console.log(`  \x1b[32mPASS\x1b[0m  ${m}${d ? `  ${d}` : ''}`); };
const wa = (m, d = '') => { warn++; console.log(`  \x1b[33mWARN\x1b[0m  ${m}${d ? `\n        ${d}` : ''}`); };
const no = (m, d = '') => { fail++; console.log(`  \x1b[31mFAIL\x1b[0m  ${m}${d ? `\n        ${d}` : ''}`); };
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};
const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

/* ---------------------------------------------------------------- 1. git */
head('Git');

const insideRepo = sh('git rev-parse --is-inside-work-tree') === 'true';
if (!insideRepo) {
  no('not a git repository', 'Vercel deploys from a repo. Run: git init && git add . && git commit');
} else {
  ok('git repository present');

  const email = sh('git config user.email') || '';
  const name = sh('git config user.name') || '';
  if (!email) {
    no('no commit author email configured', 'git config user.email "<id>+<login>@users.noreply.github.com"');
  } else if (/@users\.noreply\.github\.com$/.test(email)) {
    ok('commit author is a GitHub noreply identity', email);
  } else {
    // This is THE silent killer. Vercel blocks deployments whose commit author
    // it cannot tie to a GitHub account, and reports only "Deployment was
    // blocked" — the site keeps serving the last good build indefinitely.
    wa(
      `commit author "${name} <${email}>" may not be verifiable by GitHub`,
      'If it is not an email on your GitHub account, Vercel BLOCKS every deployment.\n' +
      '        Safest: git config user.email "$(gh api user -q \'.id\')+$(gh api user -q \'.login\')@users.noreply.github.com"',
    );
  }

  const dirty = sh('git status --porcelain');
  if (dirty) wa('working tree has uncommitted changes', 'Those changes will NOT be deployed.');
  else ok('working tree clean');

  const tracked = sh('git ls-files') || '';
  const leaked = tracked.split('\n').filter((f) => /(^|\/)\.env$|(^|\/)\.env\.(?!example)/.test(f));
  if (leaked.length) no('secret files are tracked by git', leaked.join(', '));
  else ok('no .env files tracked');

  const heavy = tracked.split('\n').filter((f) => /(^|\/)node_modules\//.test(f));
  if (heavy.length) no(`${heavy.length} node_modules files tracked`, 'Add node_modules/ to .gitignore');
  else ok('node_modules not tracked');
}

/* ------------------------------------------------------------ 2. gitignore */
head('Secrets');

const gi = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
if (!gi) no('no .gitignore', 'A committed .env publishes your database password.');
else {
  if (/^\.env/m.test(gi)) ok('.gitignore covers .env files');
  else no('.gitignore does not cover .env', 'Add: .env and .env.*');
  if (/node_modules/.test(gi)) ok('.gitignore covers node_modules');
  else wa('.gitignore does not cover node_modules');
}

/* --------------------------------------------------------- 3. vercel.json */
head('Vercel config');

const vercel = readJson('vercel.json');
const rootPkg = readJson('package.json');

if (!vercel) {
  wa('no vercel.json', 'Fine for zero-config projects; required once you override build or routing.');
} else {
  ok('vercel.json present');

  const build = vercel.buildCommand || '';
  // npm ci drops devDependencies when NODE_ENV=production. Build tools almost
  // always live in devDependencies, so setting that variable removes the entire
  // toolchain and the build dies with "vite: not found".
  if (/npm (ci|install)/.test(build) && !/--include=dev/.test(build)) {
    wa(
      'buildCommand installs without --include=dev',
      'If NODE_ENV=production is set as an env var, npm ci OMITS devDependencies\n' +
      '        and the build loses vite/tsc. Use: npm ci --include=dev',
    );
  } else if (build) {
    ok('buildCommand installs dev dependencies');
  }

  if (vercel.outputDirectory) {
    if (fs.existsSync(vercel.outputDirectory)) ok('outputDirectory exists locally', vercel.outputDirectory);
    else wa(`outputDirectory "${vercel.outputDirectory}" not built yet`, 'Run the build once to confirm it lands there.');
  }

  const rw = vercel.rewrites || [];
  const apiRw = rw.find((r) => String(r.source).includes('/api'));
  const hasApiDir = fs.existsSync('api');
  if (hasApiDir) {
    const catchAll = fs.existsSync('api') && fs.readdirSync('api').some((f) => f.startsWith('[...'));
    if (catchAll && !apiRw) {
      // A [...path].js catch-all was observed matching only ONE segment:
      // /api/health worked, /api/auth/login returned NOT_FOUND.
      wa(
        'api/ uses a [...] catch-all with no /api rewrite',
        'A catch-all can match only one path segment, so /api/a/b 404s while /api/a works.\n' +
        '        More reliable: api/index.js plus {"source":"/api/(.*)","destination":"/api"}',
      );
    } else if (apiRw) {
      ok('/api requests are routed by an explicit rewrite');
    }
    const spaRw = rw.find((r) => String(r.destination).includes('index.html'));
    if (spaRw) {
      if (String(spaRw.source).includes('?!api')) ok('SPA fallback excludes /api');
      else no('SPA fallback does not exclude /api', 'It will swallow API requests and return HTML.');
    }
  }
}

if (rootPkg && fs.existsSync('api')) {
  const deps = Object.keys(rootPkg.dependencies || {});
  if (!deps.length) wa('root package.json declares no dependencies', 'Serverless functions resolve deps from the repo root.');
  else ok(`root package.json declares ${deps.length} runtime dependencies`);
}

/* ------------------------------------------------------- 4. env variables */
head('Environment variables');

if (ENV_FILE) {
  if (!fs.existsSync(ENV_FILE)) {
    no(`env file not found: ${ENV_FILE}`);
  } else {
    const txt = fs.readFileSync(ENV_FILE, 'utf8');
    const keys = txt.split('\n').filter((l) => /^\w+=/.test(l)).map((l) => l.split('=')[0]);
    ok(`${ENV_FILE} defines ${keys.length} variables`, keys.join(', '));
    const placeholders = txt.split('\n').filter((l) => /=(PASTE|CHANGE|REPLACE|<|your-)/i.test(l));
    if (placeholders.length) no('env file still contains placeholders', placeholders.map((l) => l.split('=')[0]).join(', '));
    else ok('no placeholder values left');
    const sslmode = txt.match(/^DATABASE_URL=.*[?&]sslmode=/m);
    if (sslmode) {
      wa(
        'DATABASE_URL carries ?sslmode=',
        'node-postgres lets URL parameters OVERRIDE an ssl config passed alongside them,\n' +
        '        which silently discards a pinned CA. Drop sslmode if you configure TLS in code.',
      );
    }
  }
} else {
  wa('no --env file given', 'Pass --env <file> to check the variables you intend to upload.');
}

/* --------------------------------------------------------- 5. live probe */
if (URL_ARG) {
  head(`Live deployment — ${URL_ARG}`);
  const base = URL_ARG.replace(/\/+$/, '');

  const get = async (p) => {
    try {
      const res = await fetch(base + p, { signal: AbortSignal.timeout(25000) });
      const body = await res.text();
      return { status: res.status, body };
    } catch (e) {
      return { status: 0, body: String(e.message) };
    }
  };

  const health = await get('/api/health');
  if (health.status === 200) ok('GET /api/health -> 200');
  else if (health.body.includes('server_misconfigured')) {
    let missing = '';
    try { missing = (JSON.parse(health.body).missing || []).join(', '); } catch {}
    no('deployment is missing environment variables', missing || health.body.slice(0, 160));
  } else if (health.body.includes('FUNCTION_INVOCATION_FAILED')) {
    no('the function crashes before it can respond',
       'Import the app lazily inside the handler so the real error is returned as JSON.');
  } else {
    no(`GET /api/health -> ${health.status}`, health.body.slice(0, 160));
  }

  // Depth matters: a mis-registered catch-all serves one segment and 404s deeper.
  const deep = await get('/api/auth/login');
  if (deep.body.includes('NOT_FOUND')) {
    no('nested /api paths return NOT_FOUND while shallow ones work',
       'The catch-all is matching a single segment. Use api/index.js plus an /api/(.*) rewrite.');
  } else ok('nested /api paths reach the function');

  const root = await get('/');
  if (root.status === 200 && /<div id="root"|<!doctype html/i.test(root.body)) ok('frontend is served');
  else no(`GET / -> ${root.status}`);
}

/* ------------------------------------------------------------- summary */
console.log(`\n${pass} passed, ${warn} warnings, ${fail} failed`);
if (fail) {
  console.log('\nFix the failures above before deploying.');
  process.exit(1);
}
