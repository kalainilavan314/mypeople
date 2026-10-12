import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MY_PEOPLE_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MY_PEOPLE_BASE_URL||'http://127.0.0.1:5175';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
const member={id:'fixture',fullName:'Kalai',memberCode:'WTL-26-5401749',districtName:'Jaffna',dsName:'Islands North (Kayts)',gsName:'Analaitivu North',tier:'volunteer',verificationStatus:'identity_confirmed',membershipStatus:'active',recruitCount:0,language:'en',joinedAt:'2026-10-03T00:00:00Z'};
await context.addInitScript(m=>{localStorage.setItem('npm.member',JSON.stringify(m));localStorage.setItem('npm.lang','en');localStorage.setItem('npm.welcome.seen','1');},member);
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',r=>{
  const p=new URL(r.request().url()).pathname;if(!p.startsWith('/api/'))return r.continue();
  return r.fulfill({json:p==='/api/me'?{member}:p==='/api/auth/login'?{ok:true,member,token:'fixture-only'}:p==='/api/events'?{events:[]}:p==='/api/reports/mine'?{reports:[]}:{}});
});
await page.goto(base+'/login');
await page.locator('form').waitFor();
await page.locator('input').first().fill('199012345678');
await page.locator('input[type=password]').fill('fixture-password');
await page.locator('form').evaluate(f=>f.requestSubmit());
await page.locator('.home-screen').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('npm.authed')),'1');
for(const route of ['/survey','/ideas','/skills','/courses','/referral','/privacy','/notifications','/area','/reports','/community']){
  await page.goto(base+route);await page.locator('nav.work-nav').waitFor();
  await page.waitForTimeout(700);
  assert((await page.locator('.screen').innerText()).trim().length>0,route+' should render');
  assert.equal(await page.evaluate(()=>document.querySelector('.screen').scrollWidth>document.querySelector('.screen').clientWidth),false,route+' overflow');
}
assert.deepEqual(errors,[]);await browser.close();console.log('Passed login submission and 10 retained feature routes.');
