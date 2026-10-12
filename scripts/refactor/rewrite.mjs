import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.resolve('app/package.json'));
const ts = require('typescript');
const prettier = require('prettier');
const root = process.cwd();
const { moves } = JSON.parse(fs.readFileSync('docs/refactor/move-map.json', 'utf8'));
const mapping = new Map(moves.map(m => [path.resolve(m.from), path.resolve(m.to)]));
const extensions = ['', '.ts', '.tsx', '.json', '.css', '/index.ts', '/index.tsx'];
function alias(oldFile, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const [name, query] = specifier.split('?');
  const stem = path.resolve(path.dirname(oldFile), name);
  const found = extensions.map(ext => path.resolve(stem + ext)).find(candidate => mapping.has(candidate));
  if (!found) throw new Error(`Unresolved local import ${specifier} in ${oldFile}`);
  const target = mapping.get(found);
  let rel = path.relative(path.resolve('app/src'), target).replaceAll('\\', '/');
  rel = rel.replace(/\.(tsx?|jsx?)$/, '').replace(/\/index$/, '');
  return '@/' + rel + (query ? '?' + query : '');
}
for (const { from, to } of moves) {
  if (!/\.(tsx?|mjs)$/.test(to) || to.endsWith('.d.ts')) continue;
  let text = fs.readFileSync(to, 'utf8');
  const file = ts.createSourceFile(from, text, ts.ScriptTarget.Latest, true,
    to.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const changes = [], comments = new Map();
  function walk(node) {
    if (ts.isJsxExpression(node) && !node.expression)
      changes.push({ start: node.getStart(file), end: node.end, value: '' });
    const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
      ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith('.'))
      changes.push({ start: specifier.getStart(file), end: specifier.end,
        value: JSON.stringify(alias(path.resolve(from), specifier.text)) });
    for (const range of [...(ts.getLeadingCommentRanges(text, node.pos) ?? []),
      ...(ts.getTrailingCommentRanges(text, node.end) ?? [])]) {
      const content = text.slice(range.pos, range.end);
      if (!/@ts-|eslint|@license|copyright/i.test(content)) comments.set(range.pos, range);
    }
    ts.forEachChild(node, walk);
  }
  walk(file);
  for (const range of comments.values()) changes.push({ start: range.pos, end: range.end, value: '' });
  const unique = changes.filter(c => !changes.some(d => d !== c && d.start <= c.start &&
    d.end >= c.end && d.end-d.start > c.end-c.start));
  const ordered = [...new Map(unique.map(c => [c.start, c])).values()].sort((a,b) => b.start-a.start);
  for (const c of ordered) text = text.slice(0, c.start) + c.value + text.slice(c.end);
  fs.writeFileSync(to, await prettier.format(text, { parser: to.endsWith('.tsx') ? 'typescript' : 'typescript',
    singleQuote: true, printWidth: 100, trailingComma: 'all' }));
}
const config = JSON.parse(fs.readFileSync('app/tsconfig.json', 'utf8'));
config.compilerOptions.baseUrl = '.';
config.compilerOptions.paths = { '@/*': ['src/*'] };
fs.writeFileSync('app/tsconfig.json', JSON.stringify(config, null, 2) + '\n');
let vite = fs.readFileSync('app/vite.config.ts', 'utf8');
vite = "import { fileURLToPath } from 'node:url';\n" + vite;
vite = vite.replace('export default defineConfig({',
  "export default defineConfig({\n  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },");
fs.writeFileSync('app/vite.config.ts', await prettier.format(vite, { parser:'typescript', singleQuote:true }));
for (const name of ['screens', 'components', 'styles', 'theme', 'hooks', 'state', 'lib', 'data', 'i18n']) {
  const dir = path.join(root, 'app/src', name);
  function cleanEmpty(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes:true }))
      if (entry.isDirectory()) cleanEmpty(path.join(current, entry.name));
    if (fs.readdirSync(current).length === 0) fs.rmdirSync(current);
  }
  cleanEmpty(dir);
}
for (const feature of fs.readdirSync('app/src/features'))
  fs.mkdirSync(`app/src/features/${feature}/components`, { recursive:true });
console.log('Imports migrated to @/ aliases; legacy source folders removed');
