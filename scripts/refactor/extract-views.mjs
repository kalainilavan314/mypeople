import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(path.resolve('app/package.json'));
const ts = require('typescript'), prettier = require('prettier');
const root = path.resolve('app/src');
const files = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()
  ? files(path.join(dir,e.name)) : /\.tsx?$/.test(e.name)&&!e.name.endsWith('.d.ts') ? [path.join(dir,e.name)] : []);
const format = s => prettier.format(s,{parser:'typescript',singleQuote:true,printWidth:100});
const alias = f => '@/'+path.relative(root,f).replaceAll('\\','/').replace(/\.tsx?$/,'');
const parsed=ts.parseJsonConfigFileContent(ts.readConfigFile('app/tsconfig.json',ts.sys.readFile).config,ts.sys,path.resolve('app'));
const requested = process.argv.slice(2).map(f => path.resolve(f));
if (!requested.length || requested.some(f => !f.startsWith(root + path.sep)))
  throw new Error('Pass the explicit source files to extract; broad runs are disabled.');
function program(){return ts.createProgram(files(root),parsed.options)}

// Correct type-only barrel exports and retain the welcome screen's public contract.
let p=program(), checker=p.getTypeChecker();
for(const f of requested) {
  let code=fs.readFileSync(f,'utf8'), sf=p.getSourceFile(f), edits=[];
  for(const n of sf.statements) if(ts.isExportDeclaration(n)&&n.exportClause&&ts.isNamedExports(n.exportClause)&&!n.isTypeOnly){
    const allTypes=n.exportClause.elements.every(e=>{
      let s=checker.getSymbolAtLocation(e.name);if(s?.flags&ts.SymbolFlags.Alias)s=checker.getAliasedSymbol(s);
      return s && !(s.flags&ts.SymbolFlags.Value);
    });
    if(allTypes)edits.push({start:n.getStart(sf)+6,end:n.getStart(sf)+6,value:' type'});
  }
  for(const e of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,e.start)+e.value+code.slice(e.end);
  fs.writeFileSync(f,await format(code));
}

function declarationInside(symbol,node){return symbol.declarations?.every(d=>d.pos>=node.pos&&d.end<=node.end)}
function topLevel(symbol){return symbol.declarations?.some(d=>{
  for(let n=d.parent;n;n=n.parent){if(ts.isSourceFile(n))return true;if(ts.isFunctionLike(n))return false}
  return false;
})}
function normalize(text){return text.replace(/import\("([^"\n]+)"\)/g,(_,name)=>{
  name=name.replaceAll('\\\\','/').replaceAll('\\','/');
  const src=name.indexOf('/app/src/'), modules=name.indexOf('/node_modules/');
  if(src>=0)name='@/'+name.slice(src+9).replace(/\.tsx?$/,'');
  else if(modules>=0){name=name.slice(modules+14); if(name.startsWith('@types/react'))name='react';else name=name.startsWith('@')?name.split('/').slice(0,2).join('/'):name.split('/')[0];}
  return `import('${name}')`;
}).replace(/\bReact\./g,"import('react').")}

for(let pass=0;pass<15;pass++) {
  p=program();checker=p.getTypeChecker();let changes=0;
  for(const f of requested.filter(f=>f.endsWith('.tsx')&&!f.endsWith('Icon.tsx'))){
    const code=fs.readFileSync(f,'utf8');if(code.split('\n').length<=200)continue;
    const sf=p.getSourceFile(f), candidates=[];
    function visit(n){
      if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)||ts.isJsxFragment(n)){
        const text=n.getText(sf), lines=text.split('\n').length;
        if(lines>=30&&lines<=155){
          const free=new Map();
          function scan(id){
            if(ts.isIdentifier(id)){
              const s=checker.getSymbolAtLocation(id);
              if(s&&!topLevel(s)&&!declarationInside(s,n)&&s.declarations?.some(d=>d.getSourceFile()===sf)
                &&!(s.flags&(ts.SymbolFlags.Property|ts.SymbolFlags.Method|ts.SymbolFlags.TypeParameter))){
                const d=s.valueDeclaration;
                if(d)free.set(s,{name:id.text,node:id,decl:d});
              }
            }
            ts.forEachChild(id,scan);
          }
          scan(n);
          if(free.size<=8)candidates.push({node:n,free,lines});
        }
      }
      ts.forEachChild(n,visit);
    }
    visit(sf);candidates.sort((a,b)=>b.lines-a.lines);
    const pick=candidates[0];if(!pick)continue;
    const node=pick.node, opening=ts.isJsxElement(node)?node.openingElement:node;
    const attr=opening.attributes?.properties.find(a=>ts.isJsxAttribute(a)&&a.name.text==='className'&&a.initializer&&ts.isStringLiteral(a.initializer));
    const label=attr?.initializer.text.split(' ')[0]||opening.tagName?.getText(sf)||'Fields';
    const stem=path.basename(f,'.tsx').replace(/Screen$/,'');
    const suffix=label.replace(/[^a-zA-Z0-9]+/g,' ').split(' ').filter(Boolean).map(s=>s[0].toUpperCase()+s.slice(1)).join('');
    let name=stem+suffix, index=2;
    const dir=f.includes(path.sep+'features'+path.sep)&&!f.includes(path.sep+'components'+path.sep)
      ?path.join(path.dirname(f),'components'):path.join(path.dirname(f),stem+'Sections');
    while(fs.existsSync(path.join(dir,name+'.tsx')))name=stem+suffix+index++;
    const target=path.join(dir,name+'.tsx'),imports=sf.statements.filter(ts.isImportDeclaration).map(n=>n.getText(sf)).join('\n');
    const props=[...pick.free.values()].filter(p=>p.name!=='undefined');
    let bad=false;
    const types=props.map(({name,node,decl})=>{
      let type=normalize(checker.typeToString(checker.getTypeAtLocation(node),node,ts.TypeFormatFlags.NoTruncation|ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope));
      if(ts.isVariableDeclaration(decl)&&decl.initializer&&ts.isCallExpression(decl.initializer)&&ts.isIdentifier(decl.initializer.expression)){
        const fn=checker.getSymbolAtLocation(decl.initializer.expression);
        if(fn&&topLevel(fn)&&!['useMemo','useRef','useState'].includes(decl.initializer.expression.text))type=`ReturnType<typeof ${decl.initializer.expression.text}>`;
      }
      if(type.includes('...')||type.includes('__type'))bad=true;
      return `${name==='ref'?'reference':name}: ${type};`;
    });
    if(bad)continue;
    const localTypes=[];
    function findTypes(n){if(ts.isTypeAliasDeclaration(n)&&n.parent!==sf)localTypes.push(n.getText(sf));ts.forEachChild(n,findTypes)}
    findTypes(sf);
    const view=await format(imports+'\n'+localTypes.join('\n')+'\ntype Props={'+types.join('\n')+'};\nexport function '+name+'({'+props.map(p=>p.name==='ref'?'reference: ref':p.name).join(',')+'}:Props){return ('+node.getText(sf)+');}\n');
    if(view.split('\n').length>200)continue;
    fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(target,view);
    const key=opening.attributes?.properties.find(a=>ts.isJsxAttribute(a)&&a.name.text==='key');
    const replacement='<'+name+' '+(key?key.getText(sf)+' ':'')+props.map(p=>(p.name==='ref'?'reference':p.name)+'={'+p.name+'}').join(' ')+' />';
    fs.writeFileSync(f,await format(`import { ${name} } from '${alias(target)}';\n`+code.slice(0,node.getStart(sf))+replacement+code.slice(node.end)));
    changes++;
  }
  console.log('View extraction pass',pass+1,changes);
  if(!changes)break;
}
console.log('Views extracted; run typecheck and organize imports before committing.');
