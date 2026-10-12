import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MY_PEOPLE_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MY_PEOPLE_BASE_URL||'http://127.0.0.1:5175';
const out=process.env.MY_PEOPLE_QA_OUT||'docs/refactor/after';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const member={id:'fixture',fullName:'Kalaiyarasan Sinnathamby Thiruchelvam',memberCode:'WTL-26-5401749',districtName:'Jaffna',dsName:'Islands North (Kayts)',gsName:'Analaitivu North',tier:'volunteer',verificationStatus:'identity_confirmed',membershipStatus:'active',recruitCount:0,language:'en',joinedAt:'2026-10-03T00:00:00Z'};
await context.addInitScript(m=>{localStorage.setItem('npm.authed','1');localStorage.setItem('npm.member',JSON.stringify(m));localStorage.setItem('npm.name',m.fullName);},member);
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>{errors.push(e.message);console.log('Browser error:',e.message)});
page.on('console',m=>{if(m.type()==='error')console.log('Console:',m.text())});
page.on('requestfailed',r=>console.log('Failed request:',r.url(),r.failure()));
await page.route('**/api/**',route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(!pathname.startsWith('/api/')) return route.continue();
  return route.fulfill({json:pathname==='/api/me'?{member}:pathname==='/api/events'?{events:[]}:pathname==='/api/reports/mine'?{reports:[]}:pathname.includes('card-token')?{token:null}:{}});
});
for(const lang of ['en','ta'])for(const width of [320,375,390,768,1280]){
  await page.setViewportSize({width,height:844});
  await page.goto(base+'/');
  await page.evaluate(l=>localStorage.setItem('npm.lang',l),lang);await page.reload();
  try { await page.locator('.home-screen').waitFor(); } catch(e) {
    console.log('URL',page.url(),'body',(await page.locator('body').innerText()).slice(0,1500));
    console.log('Storage',await page.evaluate(()=>({authed:localStorage.getItem('npm.authed')})));
    throw e;
  }
  await page.waitForTimeout(400);
  await page.waitForFunction(()=>{
    const img=document.querySelector('.home-community-photo img');
    return img&&img.complete&&img.naturalWidth>0;
  });
  assert(await page.locator('.home-community-photo img').evaluate(img=>img.complete&&img.naturalWidth>0),'Community picture must load');
  const layout=await page.evaluate(()=>{
    const screen=document.querySelector('.screen'),nav=document.querySelector('nav.work-nav');
    const buttons=[...nav.querySelectorAll('button')],icons=buttons.map(b=>b.querySelector('svg').getBoundingClientRect());
    screen.scrollTop=screen.scrollHeight;
    return {overflow:screen.scrollWidth>screen.clientWidth,icons:icons.map(r=>r.y),
      targets:buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44}),
      clearance:document.querySelector('.home-footer').getBoundingClientRect().bottom<=nav.getBoundingClientRect().top,
      background:getComputedStyle(document.querySelector('.home-screen')).backgroundColor,
      navBackground:getComputedStyle(nav).backgroundColor,
      active:buttons.filter(b=>b.getAttribute('aria-current')==='page').length,
      metricBaselines:[...document.querySelectorAll('.home-activity-grid strong')].map(e=>e.getBoundingClientRect().y)};
  });
  assert.equal(layout.overflow,false,`${width}/${lang} overflow`);assert.equal(layout.targets,true);
  assert.equal(layout.clearance,true,`${width}/${lang} clearance`);assert.equal(layout.active,1);
  assert(Math.max(...layout.icons)-Math.min(...layout.icons)<1,'Navigation icons must align');
  assert(Math.max(...layout.metricBaselines)-Math.min(...layout.metricBaselines)<1,'Activity values must align');
  assert.equal(layout.background,'rgb(244, 246, 250)');assert.equal(layout.navBackground,'rgb(255, 255, 255)');
  await page.evaluate(()=>document.querySelector('.screen').scrollTop=0);
  await page.screenshot({path:`${out}/home-${lang}-${width}.png`});checks.push({lang,width,...layout});
}
await page.evaluate(()=>localStorage.setItem('npm.lang','en'));await page.reload();
await page.setViewportSize({width:390,height:844});
await page.locator('.home-service-grid').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.waitForFunction(()=>[...document.querySelectorAll('.home-service-photo img')].every(img=>img.complete&&img.naturalWidth>0));
assert(await page.locator('.home-service-photo img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)), 'Home feature photos must load');
await page.screenshot({path:`${out}/home-features-en-390.png`});
await page.evaluate(()=>document.querySelector('.screen').scrollTop=0);
await page.getByRole('searchbox').fill('Party Fund');
assert.equal(await page.locator('.home-service-grid a').count(),1);
await page.getByRole('searchbox').fill('does not exist');await page.getByRole('status').filter({hasText:'No matching services'}).waitFor();
await page.getByRole('button',{name:'Clear search'}).click();
assert.equal(await page.locator('.home-quick-grid a').count(),5);
assert.equal(await page.locator('.home-service-grid a').count(),7);
await page.getByRole('button',{name:'Card and check-in QR'}).click();
assert.equal(new URL(page.url()).pathname,'/card');assert.equal(new URL(page.url()).search,'?qr=1');
await page.getByRole('dialog').waitFor();
await page.waitForFunction(()=>{
  const active=document.querySelector('nav.work-nav button[aria-current]');
  return active&&getComputedStyle(active).color==='rgb(185, 87, 22)';
});
assert.equal(await page.locator('nav.work-nav button[aria-current]').evaluate(e=>getComputedStyle(e).color),'rgb(185, 87, 22)','Other tabs retain their current navigation styling');
assert.deepEqual(errors,[]);
await fs.writeFile(`${out}/home-results.json`,JSON.stringify({fixtureOnly:true,checks,search:true,cardQr:true},null,2));
await browser.close();console.log(`Passed ${checks.length} responsive Home layouts, search and Card QR.`);
