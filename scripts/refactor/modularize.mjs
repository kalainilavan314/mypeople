import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('app/package.json'));
const ts = require('typescript');
const prettier = require('prettier');
const sourceRoot = path.resolve('app/src');
const format = code => prettier.format(code, { parser: 'typescript', singleQuote: true, printWidth: 100 });
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [path.join(dir, e.name)] : []);
const alias = file => '@/' + path.relative(sourceRoot, file).replaceAll('\\', '/').replace(/\.tsx?$/, '');
const names = node => ts.isVariableStatement(node)
  ? node.declarationList.declarations.flatMap(d => ts.isIdentifier(d.name) ? [d.name.text] : [])
  : node.name && ts.isIdentifier(node.name) ? [node.name.text] : [];
const exported = text => /^export\b/.test(text) ? text : 'export ' + text;
const config = ts.readConfigFile('app/tsconfig.json', ts.sys.readFile).config;
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.resolve('app'));
function program() { return ts.createProgram(files(sourceRoot), parsed.options); }
function references(node, checker, candidates) {
  const found = new Set();
  function visit(n) {
    if (ts.isIdentifier(n)) {
      const s = checker.getSymbolAtLocation(n);
      if (s && candidates.has(s)) found.add(s);
    }
    ts.forEachChild(n, visit);
  }
  visit(node);
  return found;
}

// Preserve inline style insertion order while moving static CSS out of controllers.
for (const file of files(sourceRoot)) {
  let code = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const edits = [];
  let index = 0;
  function visit(n) {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === 'style') {
      const expression = n.children.find(ts.isJsxExpression)?.expression;
      if (expression && ts.isNoSubstitutionTemplateLiteral(expression)) {
        const stem = path.basename(file, '.tsx');
        const css = path.join(sourceRoot, 'core/theme/embedded', `${stem}${index ? '-' + index : ''}.css`);
        fs.mkdirSync(path.dirname(css), { recursive: true });
        fs.writeFileSync(css, expression.text + '\n');
        const name = `embeddedStyles${index++}`;
        edits.push({ start: expression.getStart(sf), end: expression.end, value: name });
        code = code; // offsets belong to the original source until edits are applied.
        edits.push({ start: 0, end: 0, value: `import ${name} from '${alias(css)}?inline';\n` });
      }
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  for (const e of edits.sort((a,b) => b.start-a.start)) code = code.slice(0,e.start)+e.value+code.slice(e.end);
  fs.writeFileSync(file, await format(code));
}

// Extract named components and models, retaining symbol-based dependencies.
let p = program(), checker = p.getTypeChecker();
for (const file of files(sourceRoot)) {
  const code = fs.readFileSync(file, 'utf8');
  if (code.split('\n').length <= 200 || /Icon\.tsx$/.test(file)) continue;
  const sf = p.getSourceFile(file);
  const imports = sf.statements.filter(ts.isImportDeclaration).map(n => n.getText(sf)).join('\n');
  const declarations = sf.statements.filter(n => names(n).length);
  const feature = file.includes(`${path.sep}features${path.sep}`);
  const screen = /Screen\.tsx$/.test(file);
  const primary = screen ? declarations.find(n => ts.isFunctionDeclaration(n) && n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) : undefined;
  const destinations = new Map(), symbols = new Map();
  for (const n of declarations) {
    if (n === primary) continue;
    const name = names(n)[0];
    const component = ts.isFunctionDeclaration(n) && /^[A-Z]/.test(name);
    const dir = feature && component ? path.join(path.dirname(file), 'components')
      : path.join(path.dirname(file), path.basename(file).replace(/\.tsx?$/, '') + (component ? '' : 'Model'));
    const dest = path.join(dir, name + (component ? '.tsx' : '.ts'));
    destinations.set(n, dest);
    for (const id of ts.isVariableStatement(n) ? n.declarationList.declarations.map(d => d.name) : [n.name]) {
      const symbol = checker.getSymbolAtLocation(id);
      if (symbol) symbols.set(symbol, { node: n, name: id.getText(sf) });
    }
  }
  const dependencyImports = node => [...references(node, checker, symbols)].filter(s => symbols.get(s).node !== node)
    .map(s => { const dep = symbols.get(s); return `import { ${dep.name} } from '${alias(destinations.get(dep.node))}';`; }).join('\n');
  for (const [node, dest] of destinations) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, await format(imports + '\n' + dependencyImports(node) + '\n' + exported(node.getText(sf))));
  }
  const main = screen && primary ? imports + '\n' + dependencyImports(primary) + '\n' + primary.getText(sf)
    : [...destinations].map(([node,dest]) => `export { ${names(node).join(', ')} } from '${alias(dest)}';`).join('\n');
  fs.writeFileSync(file, await format(main));
}

// Remove copied imports that are no longer used after extraction.
export async function organize() {
  const all = files(sourceRoot);
  const host = {
    getScriptFileNames: () => all, getScriptVersion: () => '0',
    getScriptSnapshot: f => fs.existsSync(f) ? ts.ScriptSnapshot.fromString(fs.readFileSync(f,'utf8')) : undefined,
    getCurrentDirectory: () => process.cwd(), getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: o => ts.getDefaultLibFilePath(o), fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile, readDirectory: ts.sys.readDirectory,
  };
  const service = ts.createLanguageService(host);
  for (const f of all) {
    let text = fs.readFileSync(f,'utf8');
    for (const result of service.organizeImports({ type:'file', fileName:f }, {}, {}))
      for (const e of [...result.textChanges].sort((a,b)=>b.span.start-a.span.start))
        text=text.slice(0,e.span.start)+e.newText+text.slice(e.span.start+e.span.length);
    fs.writeFileSync(f,await format(text));
  }
  service.dispose();
}
await organize();
console.log('Static styles and named components extracted.');
