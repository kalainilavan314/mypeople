import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require=createRequire(path.resolve('app/package.json'));
const ts=require('typescript'),prettier=require('prettier');
export const root=path.resolve('app/src');
const files=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):/\.tsx?$/.test(e.name)?[path.join(d,e.name)]:[]);
const alias=f=>'@/'+path.relative(root,f).replaceAll('\\','/').replace(/\.tsx?$/,'');
const format=s=>prettier.format(s,{parser:'typescript',singleQuote:true,printWidth:100});
export const mapping=new Map();
export async function merge(dir,target,selected){
  if(!fs.existsSync(dir))return;
  const group=selected?selected.map(n=>path.join(dir,n+'.ts')):fs.readdirSync(dir).filter(n=>n.endsWith('.ts')).map(n=>path.join(dir,n));
  const sources=group.map(f=>({f,sf:ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true)}));
  const imports=new Set(),bodies=[],seen=new Set();
  function append(item){
    if(seen.has(item.f))return;seen.add(item.f);
    for(const n of item.sf.statements)if(ts.isImportDeclaration(n)){
      const dep=sources.find(s=>alias(s.f)===n.moduleSpecifier.text);
      if(dep)append(dep);else imports.add(n.getText(item.sf));
    }
    bodies.push(...item.sf.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getText(item.sf)));
  }
  sources.forEach(append);
  const content=await format([...imports].join('\n')+'\n'+bodies.join('\n'));
  if(content.split('\n').length>200)return;
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);
  for(const f of group){mapping.set(alias(f),alias(target));fs.unlinkSync(f);}
  if(!fs.readdirSync(dir).length)fs.rmdirSync(dir);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
for(const feature of fs.readdirSync(path.join(root,'features'))){
  const base=path.join(root,'features',feature);
  for(const dir of fs.readdirSync(base,{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name.endsWith('Model')))
    await merge(path.join(base,dir.name),path.join(base,dir.name.replace(/ScreenModel$/,'').replace(/Model$/,'')+'.model.ts'));
}
await merge(path.join(root,'core/api/authApiModel'),path.join(root,'core/api/auth/models.ts'),['ServerMember','TierProgress','SignupPayload','ProfileUpdate']);
await merge(path.join(root,'core/api/authApiModel'),path.join(root,'core/api/auth/session.ts'),['TOKEN_KEY','cachedMember','clearSession','getToken','saveMember','saveSession']);
await merge(path.join(root,'core/api/authApiModel'),path.join(root,'core/api/auth/request.ts'),['ApiError','get','post']);
await merge(path.join(root,'core/theme/tokensModel'),path.join(root,'core/theme/auth.ts'),['authC','green','greenGradient']);
await merge(path.join(root,'core/theme/tokensModel'),path.join(root,'core/theme/foundations.ts'));
await merge(path.join(root,'AppModel'),path.join(root,'core/router/screens.ts'));
const domains={
  membership:['Lang','Tier','NicStatus','Member','Referral','Badge','Notification','ConsentKind','Consents'],
  events:['Bilingual','AgendaItem','NpmEvent','RsvpStatus'],
  geography:['District','Electorate','Ward'],
  reports:['Report','ReportCategory','ReportStatus','ReportEventEntry','CommunityReport','CommunityReportCategory','CommunityReportPriority','CommunityReportStatus','NewCommunityReport'],
  participation:['Survey','SurveyQuestion','SurveyOption','Idea','Skill','Course'],
  donations:['Donation','DonationBoard','DonationMethod','DonationStatus'],
};
for(const [domain,names] of Object.entries(domains))
  await merge(path.join(root,'core/api/typesModel'),path.join(root,'core/api/models',domain+'.ts'),names.filter(n=>fs.existsSync(path.join(root,'core/api/typesModel',n+'.ts'))));
for(const f of files(root)){
  let content=fs.readFileSync(f,'utf8');
  for(const [from,to] of mapping)content=content.replaceAll(`'${from}'`,`'${to}'`).replaceAll(`"${from}"`,`"${to}"`);
  fs.writeFileSync(f,await format(content));
}
console.log('Consolidated',mapping.size,'small model modules into domain files.');
}
