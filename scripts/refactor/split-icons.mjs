import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(path.resolve('app/package.json'));
const ts=require('typescript'),prettier=require('prettier');
const file='app/src/shared/components/Icon.tsx',code=fs.readFileSync(file,'utf8');
const sf=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true);
const declaration=sf.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations[0].name.getText(sf)==='paths');
if(!declaration)throw new Error('Original icon map required.');
const map=declaration.declarationList.declarations[0].initializer;
if(!ts.isObjectLiteralExpression(map)||map.properties.some(p=>!ts.isPropertyAssignment(p)))throw new Error('Already split.');
const families={
  navigation:new Set('bell info chevron chevronLeft home calendar mapPin plus check flag bars globe logout moon sun search clock compass menu dotsVertical arrowRight settings dotsHorizontal x'.split(' ')),
  identity:new Set('card user users usersGroup shield idCard eye eyeOff lock phone crown star checkCircle male female genderOther'.split(' ')),
  participation:new Set('report mic camera heart share sprout megaphone handHeart forum trending coins landmark road droplet trash bolt leaf send'.split(' ')),
};
const buckets={navigation:[],identity:[],participation:[],content:[]};
for(const prop of map.properties){const name=prop.name.getText(sf);const family=Object.keys(families).find(k=>families[k].has(name))||'content';buckets[family].push(prop.getText(sf));}
const format=s=>prettier.format(s,{parser:'typescript',singleQuote:true,printWidth:100});
const generated=[];
for(const [name,props] of Object.entries(buckets)){
  const value=await format(`import type { IconName } from '../Icon';\nexport const ${name}Icons: Partial<Record<IconName,React.ReactNode>>={${props.join(',\n')}};`);
  if(value.split('\n').length>200)throw new Error(`${name} exceeds 200 lines`);
  generated.push({name,value});
}
fs.mkdirSync('app/src/shared/components/icons',{recursive:true});
for(const {name,value} of generated)fs.writeFileSync(`app/src/shared/components/icons/${name}.tsx`,value);
const imports=generated.map(({name})=>`import { ${name}Icons } from './icons/${name}';`).join('\n');
const combined=`const paths={${generated.map(({name})=>'...'+name+'Icons').join(',')}} as Record<IconName,React.ReactNode>;`;
fs.writeFileSync(file,await format(imports+'\n'+code.slice(0,declaration.getStart(sf))+combined+code.slice(declaration.end)));
console.log('Original SVG paths preserved in four named icon families.');
