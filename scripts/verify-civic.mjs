import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MY_PEOPLE_PLAYWRIGHT_MODULE || 'playwright');
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const out=new URL('../design/qa/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const member={id:'design-member',fullName:'Kalai',memberCode:'WTL-26-5401749',districtName:'Jaffna',dsName:'Islands North (Kayts)',gsName:'Analaitivu North',tier:'volunteer',verificationStatus:'identity_confirmed',membershipStatus:'active',phone:'',nicStatus:'verified',dob:null,gender:null,gsCode:null,dsCode:null,districtCode:null,referralCode:'SAMPLE',recruitCount:0,language:'en',joinedAt:'2026-10-03T00:00:00Z'};
const events=[{id:'sample-event',titleEn:'Nallur water scheme — volunteer mapping',titleTa:'நல்லூர் நீர் திட்டம் — தன்னார்வப் பதிவு',venue:'Kandaswamy Kovil, Nallur',startsAt:'2026-10-11T08:00:00+05:30',endsAt:'2026-10-11T11:00:00+05:30',lat:9.674,lng:80.03,electorateId:null,agenda:[],rsvpCount:1,isMine:true,myStatus:'going'}];
const browser=await chromium.launch({headless:true,channel:'msedge'});
const results=[];
const context=await browser.newContext({viewport:{width:375,height:812},deviceScaleFactor:1});
await context.addInitScript(m=>{localStorage.setItem('npm.authed','1');localStorage.setItem('npm.member',JSON.stringify(m));localStorage.setItem('npm.name',m.fullName);if(!localStorage.getItem('npm.lang')) localStorage.setItem('npm.lang','en');},member);
const page=await context.newPage();
let errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/gallery/')) {
    const response=await fetch('http://127.0.0.1:8788'+url.pathname+url.search);
    return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
  }
  if(url.pathname==='/api/me') return route.fulfill({json:{member}});
  if(url.pathname==='/api/me/card-token') return route.fulfill({json:{token:null}});
  if(url.pathname==='/api/events') return route.fulfill({json:{events}});
  if(url.pathname==='/api/reports/mine') return route.fulfill({json:{reports:[]}});
  if(url.pathname==='/api/events/sample-event/rsvp') return route.fulfill({status:503,json:{error:'test_failure'}});
  if(url.pathname==='/api/events/sample-event') return route.fulfill({json:{event:events[0]}});
  return route.fulfill({json:{}});
});
await page.clock.install({time:new Date('2026-10-09T11:00:00Z')});
for(const [name,route] of [['home','/'],['events','/events'],['card','/card'],['gallery','/gallery'],['profile','/profile']]) {
  await page.goto('http://127.0.0.1:5175'+route);
  await page.locator('nav.work-nav').waitFor();
  await page.getByRole('heading',{level:1}).waitFor();
  await page.waitForTimeout(1000);
  const overflow=await page.evaluate(()=>document.querySelector('.screen').scrollWidth>document.querySelector('.screen').clientWidth);
  assert.equal(overflow,false,name+' horizontal overflow');
  const smallTargets=await page.evaluate(()=>[...document.querySelectorAll('main button,nav.work-nav button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<43.9||r.height<43.9);}).map(e=>e.textContent||e.getAttribute('aria-label')));
  assert.deepEqual(smallTargets,[],name+' undersized targets');
  await page.screenshot({path:fileURLToPath(new URL(name+'.png',out))});
  results.push({screen:name,width:375,overflow});
}
await page.goto('http://127.0.0.1:5175/events');
await page.getByRole('button',{name:/Going/}).click();
await page.getByRole('alert').filter({hasText:'Your response could not be saved'}).waitFor();
assert(await page.getByRole('button',{name:/Going/}).getAttribute('aria-pressed')==='true');
results.push({test:'Failed RSVP preserves confirmed status',pass:true});
await page.goto('http://127.0.0.1:5175/gallery');
await page.locator('.civic-album-card').first().click();
await page.getByRole('dialog').waitFor();
assert(await page.getByRole('dialog').getByText('Sample imagery',{exact:true}).isVisible());
await page.keyboard.press('Escape');
await page.getByRole('dialog').waitFor({state:'detached'});
results.push({test:'Gallery loads API photos and dialog closes with Escape',pass:true});
await page.goto('http://127.0.0.1:5175/card');
await page.getByRole('button',{name:'Add to Wallet',exact:true}).click();
assert(await page.getByText(/Apple and Google Wallet support is not available/).isVisible());
await page.getByRole('button',{name:'Share',exact:true}).click();
assert(await page.getByRole('dialog').getByText(/Only your name/).isVisible());
await page.keyboard.press('Escape');
results.push({test:'Wallet availability and public-share disclosure are honest',pass:true});
for(const lang of ['en','ta']) for(const width of [320,430]) for(const route of ['/','/events','/card','/gallery','/profile']) {
  await page.setViewportSize({width,height:812});
  await page.goto('http://127.0.0.1:5175'+route);
  await page.evaluate(l=>localStorage.setItem('npm.lang',l),lang);await page.reload();
  await page.getByRole('heading',{level:1}).waitFor();await page.waitForTimeout(500);
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  const overflow=await page.evaluate(()=>document.querySelector('.screen').scrollWidth>document.querySelector('.screen').clientWidth);
  if(overflow) {
    console.log(await page.evaluate(()=>{const s=document.querySelector('.screen');return {width:s.clientWidth,scroll:s.scrollWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>s.clientWidth || e.scrollWidth>e.clientWidth+1).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent?.slice(0,60),right:e.getBoundingClientRect().right,width:e.clientWidth,scroll:e.scrollWidth}))};}));
    await page.screenshot({path:fileURLToPath(new URL('overflow.png',out))});
  }
  assert.equal(overflow,false,route+' '+lang+' '+width+' at 200% text');
  results.push({screen:route,width,lang,textScale:'200%',overflow});
  if(lang==='ta'&&width===320&&['/card','/profile'].includes(route)) await page.screenshot({path:fileURLToPath(new URL(route.slice(1)+'-ta-200.png',out))});
}
assert.deepEqual(errors,[]);
member.fullName='Kalaiyarasan Sinnathamby Thiruchelvam';
await page.goto('http://127.0.0.1:5175/card');
await page.waitForTimeout(500);
await page.evaluate(()=>document.documentElement.style.fontSize='200%');
const passFits=await page.evaluate(()=>{
  const pass=document.querySelector('.civic-pass');
  const p=pass.getBoundingClientRect();
  const blocks=[...pass.children].map(e=>e.getBoundingClientRect());
  return blocks.every(b=>b.top>=p.top&&b.bottom<=p.bottom)&&blocks.every((b,i)=>!i||b.top>=blocks[i-1].bottom);
});
assert.equal(passFits,true,'Long legal name and large Tamil text remain inside the pass');
results.push({test:'Long legal name and enlarged Tamil pass have no vertical overlap',pass:true});
for(const [path,status] of [['/api/gallery/albums',200],['/api/gallery/albums?category=events',200],['/api/gallery/albums?category=bogus',400],['/api/gallery/albums/library',200],['/api/gallery/albums/missing',404]]) {
  const r=await fetch('http://127.0.0.1:8788'+path);assert.equal(r.status,status);results.push({endpoint:path,status});
}
const albums=(await (await fetch('http://127.0.0.1:8788/api/gallery/albums')).json()).albums;
assert.equal(albums.length,5);
for(const album of albums){assert.equal(album.count,album.photos.length);for(const photo of album.photos){assert(photo.credit&&photo.licenseUrl);await fs.access(new URL('../app/public'+photo.src,import.meta.url));}}
await fs.writeFile(new URL('results.json',out),JSON.stringify({fixtureOnly:true,productionServerContacted:false,checks:results},null,2));
console.log('Passed',results.length,'checks; screenshots in design/qa.');
await browser.close();
