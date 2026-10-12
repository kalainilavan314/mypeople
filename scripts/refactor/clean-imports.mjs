import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(path.resolve('app/package.json'));
const ts=require('typescript'),prettier=require('prettier');
const root=path.resolve('app/src');
const files=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.tsx?$/.test(e.name)&&!e.name.endsWith('.d.ts')?[path.join(dir,e.name)]:[]);
const all=files(root);
const parsed=ts.parseJsonConfigFileContent(ts.readConfigFile('app/tsconfig.json',ts.sys.readFile).config,ts.sys,path.resolve('app'));
const p=ts.createProgram(all,parsed.options),types=new Map();
for(const f of all){const sf=p.getSourceFile(f);for(const n of sf.statements){if((ts.isTypeAliasDeclaration(n)||ts.isInterfaceDeclaration(n))&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))types.set(n.name.text,f)}}
const modules={TFunction:'i18next',i18n:'i18next',Dispatch:'react',SetStateAction:'react',RefObject:'react',ReactNode:'react',CSSProperties:'react',ChangeEvent:'react'};
for(const f of all){
  const errors=ts.getPreEmitDiagnostics(p,p.getSourceFile(f)).filter(d=>d.code===2304);
  let code=fs.readFileSync(f,'utf8');const original=code;const added=new Set();
  for(const d of errors){const name=original.slice(d.start,d.start+d.length);if(added.has(name))continue;
    let spec=modules[name];if(!spec&&types.has(name))spec='@/'+path.relative(root,types.get(name)).replaceAll('\\','/').replace(/\.tsx?$/,'');
    if(spec){added.add(name);code=`import type { ${name} } from '${spec}';\n`+code;}
  }
  fs.writeFileSync(f,code);
}
const host={getScriptFileNames:()=>all,getScriptVersion:()=> '0',getScriptSnapshot:f=>fs.existsSync(f)?ts.ScriptSnapshot.fromString(fs.readFileSync(f,'utf8')):undefined,getCurrentDirectory:()=>process.cwd(),getCompilationSettings:()=>parsed.options,getDefaultLibFileName:o=>ts.getDefaultLibFilePath(o),fileExists:ts.sys.fileExists,readFile:ts.sys.readFile,readDirectory:ts.sys.readDirectory};
const service=ts.createLanguageService(host);
for(const f of all){let code=fs.readFileSync(f,'utf8');for(const r of service.organizeImports({type:'file',fileName:f},{},{}))for(const e of [...r.textChanges].sort((a,b)=>b.span.start-a.span.start))code=code.slice(0,e.span.start)+e.newText+code.slice(e.span.start+e.span.length);fs.writeFileSync(f,await prettier.format(code,{parser:'typescript',singleQuote:true,printWidth:100}));}
service.dispose();console.log('Type imports repaired and unused imports removed.');
