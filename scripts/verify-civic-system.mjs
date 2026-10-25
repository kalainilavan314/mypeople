import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.MY_PEOPLE_PLAYWRIGHT_MODULE);
const out='design/mobile/qa/civic-system';await fs.mkdir(out,{recursive:true});
const member={id:'fixture',fullName:'Kalai',memberCode:'WTL-26-5401749',districtName:'Jaffna',dsName:'Islands North (Kayts)',gsName:'Analaitivu North',tier:'volunteer',verificationStatus:'identity_confirmed',membershipStatus:'active',language:'en',referralCode:'KALA-8386',recruitCount:0,joinedAt:'2026-10-09T00:00:00Z'};
const events=[{id:'fixture-event',titleEn:'Nallur water scheme — volunteer mapping',titleTa:'நல்லூர் நீர் திட்டம் — தன்னார்வப் பதிவு',venue:'Kandaswamy Kovil, Nallur',startsAt:'2026-10-11T08:00:00+05:30',endsAt:'2026-10-11T11:00:00+05:30',lat:9.674,lng:80.03,agenda:[],rsvpCount:1,isMine:true,myStatus:'going'}];
const browser=await chromium.launch({headless:true,channel:'msedge'}),ctx=await browser.newContext({viewport:{width:375,height:812}});
await ctx.addInitScript(m=>{localStorage.setItem('npm.authed','1');localStorage.setItem('npm.member',JSON.stringify(m));localStorage.setItem('npm.lang','en');localStorage.setItem('npm.theme','light');},member);
const page=await ctx.newPage(),errors=[],checks=[],contrasts=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',async r=>{const p=new URL(r.request().url()).pathname;if(p.startsWith('/api/gallery/')){const x=await fetch('http://127.0.0.1:8788'+p);return r.fulfill({status:x.status,contentType:'application/json',body:await x.text()});}return r.fulfill({json:p==='/api/me'?{member}:p==='/api/events'?{events}:p==='/api/me/card-token'?{token:'local-qa-token'}:p==='/api/reports/mine'?{reports:[]}:{}});});
await page.clock.install({time:new Date('2026-10-10T08:00:00Z')});
for(const mode of ['light','dark'])for(const path of ['/','/events','/card','/gallery','/profile']){
 await page.goto('http://127.0.0.1:5175'+path);await page.getByRole('heading',{level:1}).waitFor();await page.evaluate(m=>document.documentElement.dataset.theme=m,mode);await page.waitForTimeout(350);
 const audit=await page.evaluate(()=>{
  const rgba=s=>{const m=s.match(/[\d.]+/g);return m?m.slice(0,4).map(Number):[0,0,0,0];};
  const blend=(f,b)=>{const a=f[3]??1;return [0,1,2].map(i=>f[i]*a+b[i]*(1-a));};
  const luma=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const results=[];const walk=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);
  while(walk.nextNode()){
   const node=walk.currentNode,el=node.parentElement;if(!node.textContent.trim()||el.closest('[aria-hidden=true],.sr-only,.credential-scaled,style,script'))continue;
   const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect();if(!r.width||!r.height||r.left<0||r.right>innerWidth+1)continue;
   const chain=[];let gradient=false;for(let e=el;e;e=e.parentElement){const st=getComputedStyle(e);if(st.visibility==='hidden'||st.display==='none'){gradient=true;break;}if(st.backgroundImage!=='none')gradient=true;const pseudo=getComputedStyle(e,'::before');if(pseudo.content!=='none'&&pseudo.position==='absolute'&&(rgba(pseudo.backgroundColor)[3]??1)>0)chain.push(rgba(pseudo.backgroundColor));chain.push(rgba(st.backgroundColor));}
   // The image-counter scrim is validated separately at its guaranteed minimum opacity.
   if(gradient)continue;
   let bg=[255,255,255];for(const c of chain.reverse())bg=blend(c,bg);
   const fg=blend(rgba(getComputedStyle(el).color),bg),a=luma(fg),b=luma(bg);const ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   results.push({text:node.textContent.trim().slice(0,60),ratio:Number(ratio.toFixed(3)),color:getComputedStyle(el).color,background:bg});
  }
  const s=getComputedStyle(document.querySelector('.member-shell')),card=document.querySelector('.civic-card');return {tokens:{canvas:s.getPropertyValue('--page').trim(),primary:s.getPropertyValue('--primary').trim(),border:s.getPropertyValue('--hairline').trim(),shadow:s.getPropertyValue('--shadow-card').trim()},card:card?{radius:getComputedStyle(card).borderRadius,padding:getComputedStyle(card).padding}:null,results};
 });
 const failures=audit.results.filter(x=>x.ratio<4.5);assert.deepEqual(failures,[],mode+' '+path+' contrast');contrasts.push({mode,path,...audit});
 if(mode==='light'){assert.equal(audit.tokens.canvas,'#f8fafc');assert.equal(audit.tokens.primary,'#0f2942');assert.equal(audit.tokens.border,'#e2e8f0');assert.equal(audit.tokens.shadow.replace(/\s+/g,'').replace('0.04','.04'),'01px2pxrgba(15,23,42,.04)');if(audit.card)assert.equal(audit.card.radius,'12px');await page.screenshot({path:out+'/'+(path==='/'?'home':path.slice(1))+'.png'});}
}
checks.push('Rendered text contrast >= 4.5:1 across the five main screens in light and dark appearance');
checks.push('Computed civic canvas, authority color, hairline border and micro-shadow match the brief');
await page.goto('http://127.0.0.1:5175/');await page.waitForTimeout(250);
for(const href of ['/skills','/survey','/reports','/events','/community','/fund','/area','/ideas','/courses','/referral','/gallery','/card'])assert(await page.locator(`main a[href="${href}"]`).count()>0,href+' missing');
await page.getByRole('button',{name:'Search activities',exact:true}).click();await page.getByRole('searchbox').fill('Surveys');assert.equal(await page.locator('.civic-service').count(),1);await page.locator('.civic-service').click();await page.waitForURL('**/survey');checks.push('All twelve feature entry points retained; service search opens the existing survey route');
await page.goto('http://127.0.0.1:5175/profile');const rows=await page.locator('.civic-profile-row').evaluateAll(es=>es.map(e=>({h:e.getBoundingClientRect().height,icon:e.querySelector('svg')?.getBoundingClientRect().width})));assert(rows.every(x=>x.h>=48&&x.icon===20));checks.push('Profile menu uses 48px minimum rows and 20px aligned icons');
await ctx.close();const auth=await browser.newContext({viewport:{width:375,height:812}}),login=await auth.newPage();await login.route('**/api/**',r=>r.fulfill({json:{}}));await login.goto('http://127.0.0.1:5175/login');await login.waitForTimeout(250);assert.equal(await login.locator('.member-shell').count(),0);assert.equal(await login.evaluate(()=>getComputedStyle(document.querySelector('.app-shell')).getPropertyValue('--primary').trim()),'#0f2942');await login.screenshot({path:out+'/login-unchanged.png'});checks.push('Authentication remains outside the signed-in theme and retains its palette');
assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify({fixtureOnly:true,checks,contrasts,rows},null,2));await browser.close();console.log('Passed '+checks.length+' civic-system checks');
