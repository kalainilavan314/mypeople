import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(path.join(root, 'app/package.json'));
const ts = require('typescript');
const config = ts.readConfigFile('app/tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.resolve('app'));
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const files = program.getSourceFiles().filter(f => f.fileName.replaceAll('\\', '/').includes('/app/src/'));
const graph = new Map();
for (const file of files) {
  const imports = [];
  function walk(node) {
    const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
      ? node.moduleSpecifier
      : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
        ? node.arguments[0] : undefined;
    if (specifier && ts.isStringLiteral(specifier)) {
      const resolved = ts.resolveModuleName(specifier.text, file.fileName, parsed.options, ts.sys).resolvedModule;
      if (resolved?.resolvedFileName.includes('src')) imports.push(path.resolve(resolved.resolvedFileName));
    }
    ts.forEachChild(node, walk);
  }
  walk(file);
  graph.set(path.resolve(file.fileName), imports);
}
const live = new Set();
function visit(name) {
  if (live.has(name)) return;
  live.add(name);
  for (const target of graph.get(name) ?? []) visit(target);
}
visit(path.resolve('app/src/main.tsx'));
visit(path.resolve('app/src/sw.ts'));
const dead = files.filter(f => !live.has(path.resolve(f.fileName)) && !f.fileName.endsWith('.d.ts'));
console.log('UNREACHABLE', dead.map(f => path.relative(root, f.fileName)));
for (const file of files) {
  if (!live.has(path.resolve(file.fileName)) || file.text.split('\n').length <= 200) continue;
  console.log('\nFILE', path.relative(root, file.fileName));
  for (const statement of file.statements) {
    const name = statement.name?.getText(file) ?? (ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map(d => d.name.getText(file)).join(',') : '');
    if (!name) continue;
    const length = statement.getText(file).split('\n').length;
    console.log(name, length);
  }
}
const login = program.getSourceFile(path.resolve('app/src/screens/auth/Login.tsx'));
if (login) {
  function sample(node) {
    if (ts.isIdentifier(node) && ['setNic', 't', 'doLogin'].includes(node.text)) {
      console.log('TYPE', node.text, checker.typeToString(checker.getTypeAtLocation(node), undefined,
        ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType));
    }
    ts.forEachChild(node, sample);
  }
  sample(login);
}
