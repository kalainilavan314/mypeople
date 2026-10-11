import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-tamil/900.css';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { PalmyraMark } from './PalmyraMark';

export const CREDENTIAL_WIDTH=1000;
export const CREDENTIAL_HEIGHT=1000*1000/1573;
export type MembershipCredentialData={
  name:string;memberId:string;district:string;gsDivision:string;memberSince:string;
  membershipType:string;referralId:string;verified:boolean;verificationLabel:string;
  avatarUrl?:string|null;signatureUrl?:string|null;qrValue?:string|null;
};

/** Fit text within the canonical card cell without truncating identity information. */
function FitText({children,max=22,min=14,className=''}:{children:string;max?:number;min?:number;className?:string}){
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const el=ref.current;if(!el)return;
    let disposed=false;
    const fit=()=>{if(disposed)return;let size=max;el.style.fontSize=size+'px';while(size>min&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1)){size--;el.style.fontSize=size+'px';}};
    fit();void document.fonts.ready.then(fit);
    return()=>{disposed=true;};
  },[children,max,min]);
  return <div ref={ref} className={'credential-fit '+className} style={{fontSize:max}}>{children||'—'}</div>;
}

function CredentialQr({value}:{value:string}){
  const canvas=useRef<HTMLCanvasElement>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let live=true;const el=canvas.current;if(!el)return;
    el.dataset.ready='false';setError(false);
    void QRCode.toCanvas(el,value,{width:640,margin:4,errorCorrectionLevel:'M',color:{dark:'#061c28',light:'#ffffff'}}).then(()=>{if(live)el.dataset.ready='true';}).catch(()=>{if(live)setError(true);});
    return()=>{live=false;};
  },[value]);
  return error?<span className="credential-qr-unavailable">QR unavailable</span>:<canvas ref={canvas} role="img" aria-label="Membership verification QR code" className="credential-qr-canvas"/>;
}

function Guilloche(){
  const paths=Array.from({length:28},(_,n)=>Array.from({length:81},(_,i)=>{
    const x=i*13-20,y=200+n*9+Math.sin(i*.22+n*.13)*85+Math.sin(i*.7+n*.2)*16;
    return(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);
  }).join(' '));
  return <svg className="credential-art" viewBox={'0 0 1000 '+CREDENTIAL_HEIGHT} aria-hidden="true">
    <defs>
      <linearGradient id="credential-navy" x2="1" y2="1"><stop stopColor="#173f69"/><stop offset="1" stopColor="#09264f"/></linearGradient>
      <radialGradient id="credential-ice"><stop stopColor="#ffffff"/><stop offset="1" stopColor="#f1f8ff"/></radialGradient>
      <pattern id="credential-lines" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(14)"><path d="M-10 11Q11-11 33 11T77 11M-10 33Q11 11 33 33T77 33M11-10Q-11 11 11 33T11 77M33-10Q11 11 33 33T33 77" fill="none" stroke="#b8dcf6" strokeWidth=".65"/></pattern>
      <clipPath id="credential-body-clip"><path d="M0 98Q13 48 66 48H690C718 48 722 77 751 71C810 54 916 55 952 58Q1000 60 1000 93V545Q982 579 946 579H711C691 579 681 568 655 568H327C300 568 298 579 272 579H54Q18 579 0 549Z"/></clipPath>
    </defs>
    <rect width="1000" height={CREDENTIAL_HEIGHT} rx="35" fill="url(#credential-navy)"/>
    <rect width="1000" height={CREDENTIAL_HEIGHT} fill="url(#credential-lines)" opacity=".13"/>
    <g clipPath="url(#credential-body-clip)"><rect width="1000" height="600" fill="url(#credential-ice)"/><rect width="1000" height="600" fill="url(#credential-lines)" opacity=".14"/>
      <g fill="none" stroke="#b8dcf6" strokeWidth=".55" opacity=".18">{paths.map((d,i)=><path key={i} d={d}/>)}</g>
      <g fill="none" stroke="#b8dcf6" strokeWidth=".65" opacity=".18">{Array.from({length:18},(_,i)=><ellipse key={i} cx="205" cy="328" rx={185+i*8} ry={86+i*7} transform={'rotate('+(-32+i*1.6)+' 205 328)'}/>)}</g>
    </g>
    <path d="M0 549Q18 580 54 580H272C298 580 300 569 327 569H655C681 569 691 580 711 580H946Q982 580 1000 545" fill="none" stroke="#85b6df" strokeWidth="3" opacity=".42"/>
    <g fill="none" stroke="#8bc7ef" strokeWidth="1.8" opacity=".18">{[42,76,110,146,184,219,254].map(x=><g key={x} transform={'translate('+x+' 608)'}><path d="M0-12L10 0 0 12-10 0ZM-9-9L9 9M9-9L-9 9M0-17V17M-17 0H17"/></g>)}</g>
  </svg>;
}

export function MembershipCredential({data}:{data:MembershipCredentialData}){
  const [portraitFailed,setPortraitFailed]=useState(false),[signatureFailed,setSignatureFailed]=useState(false);
  useEffect(()=>setPortraitFailed(false),[data.avatarUrl]);useEffect(()=>setSignatureFailed(false),[data.signatureUrl]);
  return <article lang="en" className="membership-credential" style={{width:CREDENTIAL_WIDTH,height:CREDENTIAL_HEIGHT}} aria-label="My People membership credential">
    <Guilloche/>
    <div className="credential-motto">PEOPLE&nbsp; • &nbsp;COMMUNITY&nbsp; • &nbsp;A BRIGHTER NORTHERN PROVINCE</div>
    <div className="credential-service">SERVICE TODAY<br/>STRONGER TOMORROW</div>
    <div className="credential-portrait">{data.avatarUrl&&!portraitFailed?<img src={data.avatarUrl} alt={'Portrait of '+data.name} onError={()=>setPortraitFailed(true)}/>:<div className="credential-portrait-missing"><Icon name="user" size={74}/><span>Member portrait<br/>not provided</span></div>}</div>
    <div className="credential-signature">{data.signatureUrl&&!signatureFailed?<img src={data.signatureUrl} alt="Authorized e-signature" onError={()=>setSignatureFailed(true)}/>:<span className="credential-signature-missing">Signature not provided</span>}<div className="credential-signature-rule"/><span>Authorized e-signature</span><small>My People – Northern Province</small></div>
    <div className="credential-brand"><div className="credential-tamil" lang="ta">என் மக்கள்</div><div className="credential-english">MY PEOPLE</div><div className="credential-brand-rule"/><div className="credential-subtitle">Northern Province Community Membership</div></div>
    <div className="credential-name"><div className="credential-label">MEMBER NAME</div><FitText max={44} min={18} className="credential-name-value">{data.name}</FitText></div>
    <dl className="credential-fields-left">
      <div className="credential-field credential-field--id" data-card-field="member-id"><dt>MEMBER ID</dt><dd><FitText max={22}>{data.memberId}</FitText></dd></div>
      <div className="credential-field credential-field--district" data-card-field="district"><dt>DISTRICT</dt><dd><FitText max={22}>{data.district}</FitText></dd></div>
      <div className="credential-field credential-field--since" data-card-field="member-since"><dt>MEMBER SINCE</dt><dd><FitText max={21}>{data.memberSince}</FitText></dd></div>
    </dl>
    <div className="credential-column-rule"/>
    <dl className="credential-fields-right">
      <div className="credential-field credential-field--type" data-card-field="membership-type"><dt>MEMBERSHIP TYPE</dt><dd><span className="credential-type"><Icon name="star" size={17} fill="#fff"/><span>{data.membershipType}</span></span></dd></div>
      <div className="credential-field credential-field--gs" data-card-field="gs-division"><dt>GS DIVISION</dt><dd><FitText max={20} min={13}>{data.gsDivision}</FitText></dd></div>
      <div className="credential-field credential-field--verification" data-card-field="verification"><dt>VERIFICATION</dt><dd className={data.verified?'credential-verified':'credential-pending'}><Icon name={data.verified?'checkCircle':'clock'} size={24}/><FitText max={20} min={13}>{data.verificationLabel}</FitText></dd></div>
      <div className="credential-field credential-field--referral" data-card-field="referral"><dt>REFERRAL ID</dt><dd><FitText max={22}>{data.referralId}</FitText></dd></div>
    </dl>
    <div className="credential-official"><Logo size={112}/><strong lang="ta">என் மக்கள்</strong><span>MY PEOPLE</span><small>NORTHERN PROVINCE</small></div>
    <div className="credential-watermark" aria-hidden="true"><svg viewBox="0 0 130 220" className="credential-map"><path d="M34 3L48 7 52 16 62 17 66 27 78 31 79 43 87 50 89 62 97 74 97 88 105 102 109 117 117 132 120 152 114 175 104 194 84 207 64 215 47 210 31 194 22 177 18 158 15 142 9 130 6 114 3 95 11 81 8 70 13 58 18 50 14 36 23 33 18 21 29 20 26 11Z" fill="currentColor"/></svg><PalmyraMark size={110}/><div>PEOPLE<br/>PLACES<br/>POTENTIAL<br/>PROGRESS</div></div>
    <div className="credential-qr-panel">{data.qrValue?<CredentialQr value={data.qrValue}/>:<div className="credential-qr-unavailable"><Icon name="idCard" size={34}/><span>QR unavailable</span></div>}<span>SCAN TO VERIFY</span></div>
    <div className="credential-footer"><span>A STRONGER NORTHERN PROVINCE<br/>THROUGH ITS PEOPLE</span><small>UNITY&nbsp; | &nbsp;OPPORTUNITY&nbsp; | &nbsp;RESPONSIBILITY</small></div>
  </article>;
}

export function ScaledMembershipCredential({data}:{data:MembershipCredentialData}){
  const ref=useRef<HTMLDivElement>(null);const [scale,setScale]=useState(.32);
  useLayoutEffect(()=>{const el=ref.current;if(!el)return;const measure=()=>setScale(el.clientWidth/CREDENTIAL_WIDTH);measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[]);
  return <div ref={ref} className="credential-scale-wrap" style={{aspectRatio:'1573 / 1000'}}><div className="credential-scaled" style={{transform:`scale(${scale})`}}><MembershipCredential data={data}/></div></div>;
}
