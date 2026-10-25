import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MY_PEOPLE_PLAYWRIGHT_MODULE);
const base=process.env.MY_PEOPLE_BASE_URL||'http://127.0.0.1:5175';
const out='design/mobile/qa/membership';await fs.mkdir(out,{recursive:true});
let member={id:'fixture',fullName:'Kalai',memberCode:'WTL-26-5401749',districtName:'Jaffna',dsName:'Islands North (Kayts)',gsName:'Analaitivu North',tier:'volunteer',verificationStatus:'identity_confirmed',membershipStatus:'active',language:'en',referralCode:'KALA-8386',recruitCount:0,joinedAt:'2026-10-09T00:00:00Z',tierProgress:{next:'diamond',need:300,have:0,pct:0}};
const browser=await chromium.launch({headless:true,channel:'msedge'});
const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true,serviceWorkers:'block'});
await ctx.addInitScript(m=>{Object.defineProperty(navigator,'canShare',{value:()=>false,configurable:true});localStorage.setItem('npm.authed','1');localStorage.setItem('npm.member',JSON.stringify(m));localStorage.setItem('npm.lang','en');},member);
const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log(m.text());});
await page.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.continue();return r.fulfill({json:p==='/api/me'?{member}:p==='/api/me/card-token'?{token:'fixture-credential-local-qa-only'}:{}});});
const checks=[];
await page.goto(base+'/card');await page.locator('.credential-qr-canvas[data-ready=true]').waitFor();await page.evaluate(()=>document.fonts.ready);
for(const width of [320,390,768]){await page.setViewportSize({width,height:844});await page.waitForTimeout(200);const g=await page.locator('.credential-scale-wrap').first().boundingBox();assert(Math.abs(g.width/g.height-1.573)<.01);assert(await page.evaluate(()=>document.querySelector('.screen').scrollWidth<=document.querySelector('.screen').clientWidth));await page.screenshot({path:out+'/page-'+width+'.png'});}
checks.push('Proportional card and no horizontal page overflow at 320, 390 and 768 pixels');
await page.setViewportSize({width:1100,height:900});await page.locator('.membership-credential').first().screenshot({path:out+'/card.png'});
await page.getByRole('button',{name:'Open enlarged membership card'}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert(await page.locator('.mp-zoom-toolbar').innerText().then(s=>s.includes('205%')));await page.getByRole('button',{name:'Fit',exact:true}).click();assert(await page.locator('.mp-zoom-toolbar').innerText().then(s=>s.includes('100%')));await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});checks.push('Enlarged viewer, zoom, fit and Escape close');
await page.getByRole('button',{name:'View QR',exact:true}).click();await page.getByRole('dialog').getByRole('img',{name:'QR code',exact:true}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
await page.getByRole('button',{name:'Add to Wallet',exact:true}).click();assert(await page.getByText(/Wallet support is not available/).isVisible());await page.getByRole('button',{name:'Share',exact:true}).click();await page.getByRole('dialog').getByText(/excluded/i).waitFor();await page.keyboard.press('Escape');checks.push('QR, wallet availability and private-data-free share preview');
if(process.env.EXPORT_PDF==='1'){const d=page.waitForEvent('download',{timeout:90000});await page.getByRole('button',{name:'Download PDF',exact:true}).click();await(await d).saveAs(out+'/membership-card.pdf');checks.push('PDF generated from canonical card');}
member={...member,fullName:'கலைநிலவன் அருள்மொழிவர்மன் சிவசுப்பிரமணியம்',gsName:'அனலைதீவு வடக்கு கிராம சேவகர் பிரிவு',verificationStatus:'review_pending',membershipStatus:'pending'};
await page.evaluate(m=>{localStorage.setItem('npm.member',JSON.stringify(m));localStorage.setItem('npm.lang','ta');},member);await page.reload();await page.locator('.credential-qr-canvas[data-ready=true]').waitFor();await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.credential-verified').count(),0);
const fits=await page.locator('.credential-fit').evaluateAll(es=>es.map(e=>({text:e.textContent,ok:e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1})));assert(fits.every(f=>f.ok),JSON.stringify(fits));
await page.setViewportSize({width:320,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='200%');await page.waitForTimeout(300);assert(await page.evaluate(()=>document.querySelector('.screen').scrollWidth<=document.querySelector('.screen').clientWidth));await page.screenshot({path:out+'/tamil-320-200.png'});checks.push('Long Tamil fields fit; pending status is accurate; 200% page text fits at 320 pixels');
assert.deepEqual(errors,[]);await fs.writeFile(out+'/results.json',JSON.stringify({fixtureOnly:true,checks,fits},null,2));await browser.close();console.log('Passed '+checks.length+' membership checks');
