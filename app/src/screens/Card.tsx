import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMeQuery } from '../hooks/useMe';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { authApi } from '../data/authApi';
import { useBadges } from '../data/queries';
import { Icon, type IconName } from '../components/Icon';
import { QueryBoundary } from '../components/ui';
import { QR } from '../lib/qr';
import { tierDef } from '../theme/tiers';
import { ScaledMembershipCredential, CREDENTIAL_WIDTH, CREDENTIAL_HEIGHT, type MembershipCredentialData } from '../components/MembershipCredential';
import '../styles/membership-card.css';

export function Card() {
  const meQ=useMeQuery(), badgesQ=useBadges(), t=useWorkspaceText();
  const navigate=useNavigate(), location=useLocation(), [params]=useSearchParams();
  const [showQr,setShowQr]=useState(params.get('qr')==='1');
  const [viewer,setViewer]=useState(false),[wallet,setWallet]=useState(false),[share,setShare]=useState(false);
  const [pdfBusy,setPdfBusy]=useState(false),[feedback,setFeedback]=useState('');
  const cardHost=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(params.get('qr')==='1')setShowQr(true);},[params,location.key]);
  const token=useQuery({queryKey:['cardToken'],queryFn:()=>authApi.cardToken(),staleTime:5*60*1000,refetchInterval:8*60*1000});

  const downloadPdf=async()=>{
    const el=cardHost.current?.querySelector<HTMLElement>('.membership-credential');
    if(!el||pdfBusy)return;
    setPdfBusy(true);setFeedback('');
    try{
      await document.fonts.ready;
      await Promise.all([...el.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
      const started=Date.now();
      while(el.querySelector('canvas[data-ready="false"]')&&Date.now()-started<4000)await new Promise(resolve=>setTimeout(resolve,50));
      if(el.querySelector('canvas[data-ready="false"]'))throw new Error('QR still preparing');
      const [{toPng},{jsPDF}]=await Promise.all([import('html-to-image'),import('jspdf')]);
      const png=await toPng(el,{width:CREDENTIAL_WIDTH,height:CREDENTIAL_HEIGHT,pixelRatio:3.146,preferredFontFormat:'woff2',cacheBust:false,style:{transform:'none'},backgroundColor:'#f7fbff'});
      const widthMm=85.6,heightMm=widthMm*1000/1573;
      const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:[widthMm,heightMm],compress:true});
      pdf.addImage(png,'PNG',0,0,widthMm,heightMm,undefined,'FAST');
      const blob=pdf.output('blob'),file=new File([blob],'my-people-membership-id.pdf',{type:'application/pdf'});
      if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:'My People Membership ID'});
      else{
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
      }
      setFeedback(t('Your PDF is ready. Its QR has the same short-lived validity as the displayed code.','உங்கள் PDF தயார். அதிலுள்ள QR தற்போது காட்டப்படும் குறியீட்டின் அதே குறுகிய காலச் செல்லுபடியைக் கொண்டது.'));
    }catch(err){
      console.warn('Membership PDF export failed',err);
      if(!(err instanceof Error&&err.name==='AbortError'))setFeedback(t('Could not create the PDF. Please try again.','PDF உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    }finally{setPdfBusy(false);}
  };
  const copyReferral=async(code:string)=>{
    try{await navigator.clipboard.writeText(code);setFeedback(t('Referral ID copied.','அழைப்புக் குறியீடு நகலெடுக்கப்பட்டது.'));}
    catch{setFeedback(t('Could not copy the referral ID. Please try again.','அழைப்புக் குறியீட்டை நகலெடுக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'));}
  };

  return <main className="membership-page">
    <QueryBoundary query={meQ}>{me=>{
      if(!me)return <section className="mp-section"><h1>{t('Membership information unavailable','உறுப்பினர் விவரங்கள் கிடைக்கவில்லை')}</h1><Link to="/login">{t('Sign in again','மீண்டும் உள்நுழையுங்கள்')}</Link></section>;
      const confirmed=me.verificationStatus==='identity_confirmed',active=me.membershipStatus==='active';
      const verification=confirmed?(active?t('Verified Member','சரிபார்க்கப்பட்ட உறுப்பினர்'):t('Identity verified','அடையாளம் சரிபார்க்கப்பட்டது')):me.verificationStatus==='review_pending'?t('Under review','மதிப்பாய்வில்'):me.verificationStatus==='nic_format'?t('NIC format checked','அடையாள எண் வடிவம் சரிபார்க்கப்பட்டது'):t('Not verified','சரிபார்க்கப்படவில்லை');
      const joined=new Date(me.joinedAt),memberSince=Number.isNaN(joined.getTime())?'—':joined.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Colombo'});
      const tier=tierDef(me.tier),prog=me.tierProgress;
      const data:MembershipCredentialData={name:me.fullName,memberId:me.memberCode,district:me.districtName||'—',gsDivision:me.gsName||'—',memberSince,membershipType:t(tier.nameEn,tier.nameTa),referralId:me.referralCode||'—',verified:confirmed,verificationLabel:verification,avatarUrl:me.avatarUrl,qrValue:token.data};
      const status=me.membershipStatus==='active'?t('Active','செயலில்'):me.membershipStatus==='suspended'?t('Suspended','இடைநிறுத்தப்பட்டது'):me.membershipStatus==='inactive'?t('Inactive','செயலற்றது'):t('Pending','நிலுவையில்');
      return <>
        <header className="mp-header"><div><h1>{t('My Membership Card','எனது உறுப்பினர் அட்டை')}</h1><p>{t('Your community membership','உங்கள் சமூக உறுப்பினர் பதிவு')}</p></div><button className="mp-close" type="button" onClick={()=>navigate('/profile')} aria-label={t('More options','மேலும் விருப்பங்கள்')}><Icon name="menu" size={20}/></button></header>
        <figure className="mp-card-figure"><div className="mp-preview-stage" ref={cardHost}><ScaledMembershipCredential data={data}/><button className="mp-open-card" type="button" aria-label={t('Open enlarged membership card','பெரிதாக்கப்பட்ட உறுப்பினர் அட்டையைத் திற')} aria-haspopup="dialog" onClick={()=>setViewer(true)}/></div><figcaption><Icon name="eye" size={14}/>{t('Tap your card to enlarge','அட்டையைப் பெரிதாக்கத் தட்டவும்')}</figcaption></figure>
        <div className="mp-actions" aria-label={t('Card actions','அட்டைச் செயல்கள்')}>
          <Action icon="idCard" label={t('View QR','QR பார்க்க')} onClick={()=>setShowQr(true)} active={showQr}/>
          <Action icon="download" label={pdfBusy?t('Preparing PDF…','PDF தயாராகிறது…'):t('Download PDF','PDF பதிவிறக்கம்')} onClick={()=>void downloadPdf()} disabled={pdfBusy}/>
          <Action icon="card" label={t('Add to Wallet','வாலட்டில் சேர்')} onClick={()=>setWallet(true)}/>
          <Action icon="share" label={t('Share','பகிர்')} onClick={()=>setShare(true)}/>
        </div>
        {feedback&&<p className="mp-feedback" role="status">{feedback}</p>}
        {wallet&&<div className="mp-availability" role="status">{t('Apple and Google Wallet support is not available yet. You can download a PDF copy.','Apple மற்றும் Google Wallet இன்னும் கிடைக்கவில்லை. PDF நகலைப் பதிவிறக்கலாம்.')}<button type="button" onClick={()=>setWallet(false)}>{t('Dismiss','மூடு')}</button></div>}
        <section className="mp-section"><div className="mp-section-heading"><h2>{t('Membership Details','உறுப்பினர் விவரங்கள்')}</h2><button type="button" onClick={()=>navigate('/profile/edit')}><Icon name="pencil" size={16}/>{t('Edit','திருத்து')}</button></div><dl className="mp-details">
          <Detail icon="user" label={t('Full name','முழுப் பெயர்')} value={me.fullName}/>
          <Detail icon="idCard" label={t('Member ID','உறுப்பினர் எண்')} value={me.memberCode} mono/>
          <Detail icon="globe" label={t('District','மாவட்டம்')} value={me.districtName||'—'}/>
          <Detail icon="home" label={t('DS Division','பிரதேச செயலகப் பிரிவு')} value={me.dsName||'—'}/>
          <Detail icon="mapPin" label={t('GS Division','கிராம சேவகர் பிரிவு')} value={me.gsName||'—'}/>
          <Detail icon="calendar" label={t('Member since','உறுப்பினரான நாள்')} value={memberSince}/>
          <Detail icon="star" label={t('Membership type','உறுப்பினர் வகை')} value={t(tier.nameEn,tier.nameTa)}/>
          <Detail icon="shield" label={t('Identity verification','அடையாளச் சரிபார்ப்பு')} value={verification}/>
          <Detail icon="checkCircle" label={t('Membership status','உறுப்பினர் நிலை')} value={status}/>
          <div className="mp-detail"><dt><Icon name="users" size={16}/>{t('Referral ID','அழைப்புக் குறியீடு')}</dt><dd><span className="mp-mono">{me.referralCode||'—'}</span><button className="mp-copy" type="button" aria-label={t('Copy referral ID','அழைப்புக் குறியீட்டை நகலெடு')} onClick={()=>void copyReferral(me.referralCode)}><Icon name="share" size={17}/></button></dd></div>
        </dl></section>
        {prog&&<section className="mp-section"><div className="mp-section-heading"><h2>{t('Community progress','சமூகப் பங்களிப்பு முன்னேற்றம்')}</h2><button type="button" onClick={()=>navigate('/referral')}>{prog.next?t('View referrals','அழைப்புகளைப் பார்'):t('Membership recognition','உறுப்பினர் அங்கீகாரம்')}<Icon name="chevron" size={16}/></button></div>{prog.next&&prog.need?<><p className="mp-note">{Math.max(0,prog.need-prog.have)} {t('more to','மேலும்')} {t(tierDef(prog.next).nameEn,tierDef(prog.next).nameTa)}</p><div className="mp-progress" role="progressbar" aria-label={t('Community progress','சமூகப் பங்களிப்பு முன்னேற்றம்')} aria-valuemin={0} aria-valuemax={prog.need} aria-valuenow={Math.min(prog.need,Math.max(0,prog.have))}><span style={{width:Math.min(100,Math.max(0,prog.pct))+'%'}}/></div><p className="mp-progress-caption">{prog.have} / {prog.need} {t('recruits','அழைப்புகள்')}</p></>:<p className="mp-note">{t('Highest membership recognition reached.','உயர்ந்த உறுப்பினர் அங்கீகாரத்தை அடைந்துள்ளீர்கள்.')}</p>}<p className="mp-note">{t('Community recognition is separate from assigned organisational responsibilities.','சமூக அங்கீகாரமும் ஒதுக்கப்பட்ட அமைப்புப் பொறுப்புகளும் தனித்தனியானவை.')}</p></section>}
        <section className="mp-section"><div className="mp-section-heading"><h2>{t('Milestones','சாதனைகள்')}</h2><button type="button" onClick={()=>navigate('/milestones')}>{t('View All','அனைத்தையும் பார்')}<Icon name="chevron" size={16}/></button></div><QueryBoundary query={badgesQ}>{badges=><ul className="mp-milestones">{badges.map(b=>{
          // Badge definitions are still seeded. Never publish their demo earned
          // flags as the signed-in member's recorded accomplishments.
          const state=b.key==='refer_5'?(me.recruitCount>=5?'completed':'locked'):'unavailable';
          return <li key={b.id} data-status={state}><span><Icon name={state==='completed'?'checkCircle':state==='locked'?'lock':'info'} size={19}/></span><strong>{t(b.nameEn,b.nameTa)}</strong><small>{state==='completed'?t('Completed','நிறைவு'):state==='locked'?t('Locked','பூட்டப்பட்டது'):t('Not recorded','பதிவு இல்லை')}</small></li>;
        })}</ul>}</QueryBoundary></section>
        {viewer&&<CardViewer data={data} onClose={()=>setViewer(false)} t={t}/>}
        {showQr&&<QrDialog value={token.data} pending={token.isPending} name={me.fullName} code={me.memberCode} onRetry={()=>void token.refetch()} onClose={()=>setShowQr(false)} t={t}/>}
        {share&&<ShareDialog data={data} onClose={()=>setShare(false)} t={t}/>}
      </>;
    }}</QueryBoundary>
  </main>;
}

function Action({icon,label,onClick,active,disabled}:{icon:IconName;label:string;onClick:()=>void;active?:boolean;disabled?:boolean}){
  return <button className="mp-action" type="button" aria-pressed={active} disabled={disabled} onClick={onClick}><Icon name={icon} size={19}/><span>{label}</span></button>;
}
function Detail({icon,label,value,mono}:{icon:IconName;label:string;value:string;mono?:boolean}){
  return <div className="mp-detail"><dt><Icon name={icon} size={16}/>{label}</dt><dd className={mono?'mp-mono':undefined}>{value}</dd></div>;
}
type Text=(en:string,ta:string)=>string;
function Close({onClose,t}:{onClose:()=>void;t:Text}){
  return <button className="mp-close" type="button" onClick={onClose} aria-label={t('Close','மூடு')}><Icon name="x" size={20}/></button>;
}
function CardViewer({data,onClose,t}:{data:MembershipCredentialData;onClose:()=>void;t:Text}){
  const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null);
  const [zoom,setZoom]=useState(1.8),[fit,setFit]=useState(700);
  const points=useRef(new Map<number,{x:number;y:number}>()),gesture=useRef({distance:0,zoom:1});
  useEffect(()=>{dialog.current?.showModal();const el=viewport.current;if(!el)return;const measure=()=>setFit(Math.max(100,el.clientWidth-24));measure();const obs=new ResizeObserver(measure);obs.observe(el);return()=>obs.disconnect();},[]);
  const applyZoom=(value:number,x?:number,y?:number)=>{
    const el=viewport.current;if(!el)return;const next=Math.min(4,Math.max(.5,value)),r=el.getBoundingClientRect(),ax=x===undefined?el.clientWidth/2:x-r.left,ay=y===undefined?el.clientHeight/2:y-r.top;
    const cx=(el.scrollLeft+ax)/zoom,cy=(el.scrollTop+ay)/zoom;setZoom(next);
    requestAnimationFrame(()=>{el.scrollLeft=cx*next-ax;el.scrollTop=cy*next-ay;});
  };
  return <dialog ref={dialog} className="mp-dialog" aria-labelledby="card-view-title" onCancel={onClose} onClose={onClose}><div className="mp-dialog-header"><h2 id="card-view-title">{t('Your membership card','உங்கள் உறுப்பினர் அட்டை')}</h2><Close t={t} onClose={onClose}/></div><div className="mp-zoom-toolbar"><button type="button" aria-label={t('Zoom out','சிறிதாக்கு')} onClick={()=>applyZoom(zoom-.25)} disabled={zoom<=.5}>−</button><span aria-live="polite">{Math.round(zoom*100)}%</span><button type="button" aria-label={t('Zoom in','பெரிதாக்கு')} onClick={()=>applyZoom(zoom+.25)} disabled={zoom>=4}>+</button><button type="button" onClick={()=>applyZoom(1)}>{t('Fit','முழு அட்டை')}</button><span>{t('Drag or pinch to explore','இழுத்து அல்லது விரல்களால் பெரிதாக்கிப் பார்')}</span></div><div ref={viewport} className="mp-viewer-viewport" tabIndex={0} role="region" aria-label={t('Zoomable membership card','பெரிதாக்கக்கூடிய உறுப்பினர் அட்டை')}
    onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.current.size===2){const[a,b]=[...points.current.values()];gesture.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom};}}}
    onPointerMove={e=>{const previous=points.current.get(e.pointerId);if(!previous)return;points.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.current.size===2){const[a,b]=[...points.current.values()];applyZoom(gesture.current.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.current.distance),(a.x+b.x)/2,(a.y+b.y)/2);}else{e.currentTarget.scrollLeft-=e.clientX-previous.x;e.currentTarget.scrollTop-=e.clientY-previous.y;}}}
    onPointerUp={e=>points.current.delete(e.pointerId)} onPointerCancel={e=>points.current.delete(e.pointerId)}>
      <div className="mp-viewer-inner" style={{width:fit*zoom}}><ScaledMembershipCredential data={data}/></div>
    </div><p className="mp-note">{t('Your membership details remain readable below the card on the main page.','முதன்மைப் பக்கத்தில் அட்டைக்குக் கீழுள்ள உறுப்பினர் விவரங்களை எளிதாகப் படிக்கலாம்.')}</p></dialog>;
}
function QrDialog({value,pending,name,code,onRetry,onClose,t}:{value?:string|null;pending:boolean;name:string;code:string;onRetry:()=>void;onClose:()=>void;t:Text}){
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
  return <dialog ref={ref} className="mp-dialog mp-qr-dialog" aria-labelledby="qr-title" onCancel={onClose} onClose={onClose}><div className="mp-dialog-header"><h2 id="qr-title">{t('Membership verification','உறுப்பினர் சரிபார்ப்பு')}</h2><Close t={t} onClose={onClose}/></div><div className="mp-qr-content">{value?<div className="mp-qr-paper"><QR value={value} size={240} margin={4}/></div>:<p role="status">{pending?t('Preparing your code…','குறியீடு தயாராகிறது…'):t('Check-in code unavailable right now. Try again shortly.','வருகைப் பதிவுக் குறியீடு தற்போது கிடைக்கவில்லை. விரைவில் மீண்டும் முயற்சிக்கவும்.')}</p>}<strong>{name}</strong><span>{code}</span>{value?<p>{t('Show this QR to check in','வருகைப் பதிவுக்கு இந்த QR ஐக் காட்டுங்கள்')}</p>:<button className="mp-action" type="button" onClick={onRetry}>{t('Try again','மீண்டும் முயற்சி')}</button>}</div></dialog>;
}
function ShareDialog({data,onClose,t}:{data:MembershipCredentialData;onClose:()=>void;t:Text}){
  const ref=useRef<HTMLDialogElement>(null),[message,setMessage]=useState('');useEffect(()=>{ref.current?.showModal();},[]);
  const share=async()=>{try{const text=['My People',data.name,data.memberId,data.verificationLabel].join('\n');if(navigator.share)await navigator.share({title:'My People',text});else{await navigator.clipboard.writeText(text);setMessage(t('Copied','நகலெடுக்கப்பட்டது'));}}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setMessage(t('Could not share. Please try again.','பகிர முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'));}};
  return <dialog ref={ref} className="mp-dialog mp-qr-dialog" aria-labelledby="share-title" onCancel={onClose} onClose={onClose}><div className="mp-dialog-header"><h2 id="share-title">{t('Share preview','பகிர்வதற்கு முன்')}</h2><Close t={t} onClose={onClose}/></div><p>{data.name}<br/>{data.memberId}<br/>{data.verificationLabel}</p><p>{t('Only your name, member ID and identity status will be shared. Your private QR and portrait are excluded.','உங்கள் பெயர், உறுப்பினர் எண் மற்றும் அடையாள நிலை மட்டுமே பகிரப்படும். தனிப்பட்ட QR மற்றும் புகைப்படம் பகிரப்படாது.')}</p><button className="mp-share-submit" type="button" onClick={()=>void share()}>{t('Share','பகிர்')}</button><p role="status">{message}</p></dialog>;
}
