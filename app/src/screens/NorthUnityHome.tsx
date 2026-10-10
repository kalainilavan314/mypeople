import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeQuery } from '../hooks/useMe';
import { useEvents, useMyCommunityReports } from '../data/queries';
import { QueryBoundary } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { DateBadge } from '../components/Civic';
import { displayMemberName } from '../lib/memberDisplay';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { MemberAvatar, eventCover } from '../components/MemberVisuals';

const ACTIONS = [
  {to:'/skills',emoji:'🤝',tone:'volunteer',en:'Volunteer',ta:'தன்னார்வம்',subEn:'Help your community',subTa:'சமூகத்திற்கு உதவுங்கள்',wide:false},
  {to:'/survey',emoji:'📋',tone:'survey',en:'Surveys',ta:'கருத்துக்கணிப்புகள்',subEn:'Share your voice',subTa:'உங்கள் குரலைப் பகிருங்கள்',wide:false},
  {to:'/reports',emoji:'📍',tone:'report',en:'Report Issue',ta:'பிரச்சினை பதிவு',subEn:'Help improve your area',subTa:'உங்கள் பகுதியை மேம்படுத்துங்கள்',wide:true},
  {to:'/events',emoji:'📅',tone:'events',en:'Events',ta:'நிகழ்வுகள்',subEn:'Join activities',subTa:'நிகழ்வுகளில் பங்கேற்குங்கள்',wide:false},
  {to:'/community',emoji:'🌾',tone:'community',en:'Community',ta:'சமூகம்',subEn:'Discover local needs',subTa:'உள்ளூர் தேவைகளை அறியுங்கள்',wide:false},
  {to:'/fund',emoji:'💛',tone:'fund',en:'Party Fund',ta:'கட்சி நிதி',subEn:'Support the movement with a donation',subTa:'நன்கொடையுடன் இயக்கத்தை ஆதரியுங்கள்',wide:true},
];
const MORE: {to:string;icon:IconName;en:string;ta:string}[] = [
  {to:'/area',icon:'mapPin',en:'My area',ta:'எனது பகுதி'},
  {to:'/ideas',icon:'bulb',en:'My ideas',ta:'எனது யோசனைகள்'},
  {to:'/courses',icon:'book',en:'My courses',ta:'எனது பாடங்கள்'},
  {to:'/referral',icon:'users',en:'Invite people',ta:'மக்களை அழையுங்கள்'},
  {to:'/gallery',icon:'image',en:'Photo gallery',ta:'படத்தொகுப்பு'},
  {to:'/card',icon:'card',en:'Membership card',ta:'உறுப்பினர் அட்டை'},
];
const ACTION_ICONS: Record<string,IconName> = {volunteer:'handHeart',survey:'clipboard',report:'report',events:'calendar',community:'users',fund:'heart'};

export function Home() {
  const meQ=useMeQuery(), events=useEvents(), reports=useMyCommunityReports();
  const t=useWorkspaceText();
  const [searchOpen,setSearchOpen]=useState(false), [search,setSearch]=useState('');
  const me=meQ.data;
  const fullName=displayMemberName(me??null)??t('Member','உறுப்பினர்');
  const district=me?.districtName||t('Your area','உங்கள் பகுதி');
  const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Colombo'}).format(new Date()));
  const greeting=hour<12?'காலை வணக்கம்':hour<17?'மதிய வணக்கம்':'மாலை வணக்கம்';
  const upcoming=(events.data??[]).filter(e=>Date.parse(e.startsAt)>=Date.now()).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const nearby=upcoming.filter(e=>e.isMine);
  const q=search.trim().toLocaleLowerCase();
  const matches=(value:string)=>!q||value.toLocaleLowerCase().includes(q);
  const shortDate=(iso:string)=>new Date(iso).toLocaleDateString(t('en-GB','ta-LK'),{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Colombo'});
  return <main className="unity-home">
    <header className="unity-header">
      <div className="unity-header-row">
        <Link to="/profile" aria-label={t('Open my profile','எனது சுயவிவரத்தைத் திற')}><MemberAvatar name={fullName} src={me?.avatarUrl}/></Link>
        <div className="unity-greeting"><span lang="ta">{greeting}</span><h1>{t('Vanakkam','வணக்கம்')}, {fullName.split(' ')[0]}!</h1></div>
        <button type="button" className="unity-icon-btn" aria-label={t('Search activities','செயல்களைத் தேடு')} aria-expanded={searchOpen} onClick={()=>{setSearchOpen(!searchOpen);setSearch('');}}><Icon name={searchOpen?'x':'search'} size={22}/></button>
        <Link to="/notifications" className="unity-icon-btn" aria-label={t('Notifications','அறிவிப்புகள்')}><Icon name="bell" size={22}/></Link>
      </div>
      <Link to="/area" className="unity-district"><Icon name="mapPin" size={13}/><span>{district} · {t('Northern Province','வட மாகாணம்')}</span></Link>
      {searchOpen&&<div className="unity-search"><Icon name="search" size={18}/><input type="search" autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('Search activities, surveys, events…','செயல்கள், கருத்துக்கணிப்புகள், நிகழ்வுகளைத் தேடு…')} aria-label={t('Search activities','செயல்களைத் தேடு')}/></div>}
    </header>
    <div className="unity-home-content">
      <section className="unity-hero" aria-labelledby="unity-hero-title"><img src="/member/coast-hero.webp" alt="" fetchPriority="high"/><div className="unity-hero-scrim"/><div className="unity-hero-content"><span className="unity-hero-badge">{t('Community','சமூகம்')}</span><h2 id="unity-hero-title">{t("Let's build our","நம் வடக்கை")}<br/>{t('North together.','ஒன்றாகக் கட்டுவோம்.')}</h2><div className="unity-hero-bottom"><Link className="unity-primary-button" to="/community">{t('Get Involved','பங்கேற்க')}</Link><span>{t('Your voice. Your community.','உங்கள் குரல். உங்கள் சமூகம்.')}</span></div></div></section>
      {me?.verificationStatus==='review_pending'&&<Link to="/profile" className="unity-review"><Icon name="clock" size={18}/><span>{t('Verification in progress','சரிபார்ப்பு நடைபெறுகிறது')}</span><Icon name="chevron" size={16}/></Link>}
      <section className="unity-section" aria-labelledby="unity-actions-title"><h2 id="unity-actions-title">{q?t('Search results','தேடல் முடிவுகள்'):t('What would you like to do?','நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?')}</h2><div className="unity-action-grid">{ACTIONS.filter(a=>matches(t(a.en,a.ta)+' '+t(a.subEn,a.subTa))).map(a=><Link key={a.to} to={a.to} className={'unity-action unity-action--'+a.tone+(a.wide?' unity-action--wide':'')}><span className="unity-action-icon" aria-hidden="true"><Icon name={ACTION_ICONS[a.tone]} size={22}/></span><div><strong>{t(a.en,a.ta)}</strong><small>{t(a.subEn,a.subTa)}</small></div>{a.wide&&<span className="unity-action-arrow"><Icon name="chevron" size={20}/></span>}</Link>)}</div>{q&&!ACTIONS.some(a=>matches(t(a.en,a.ta)+' '+t(a.subEn,a.subTa)))&&<p className="unity-muted">{t('No matching shortcuts. Try another search.','பொருத்தமான செயல்கள் இல்லை. மீண்டும் தேடுங்கள்.')}</p>}</section>
      <section className="unity-section" aria-labelledby="unity-near-title"><div className="unity-section-head"><h2 id="unity-near-title">{t('Near You in','உங்கள் அருகில்')} {district}</h2><Link to="/events">{t('See All','அனைத்தும்')}</Link></div><QueryBoundary query={events}>{()=>{
        const list=(nearby.length?nearby:upcoming).filter(e=>matches(t(e.titleEn,e.titleTa)+' '+e.venue)).slice(0,4);
        return list.length?<div className="unity-near-scroll">{list.map(e=><Link className="unity-near-card" key={e.id} to={'/events/'+e.id}><div className="unity-near-photo"><img src={eventCover(e.titleEn)} alt="" loading="lazy"/><span className="unity-open-tag">{e.myStatus==='going'?t('Going ✓','செல்கிறேன் ✓'):t('Open','திறந்துள்ளது')}</span><small>{t('Illustrative photo','விளக்கப் படம்')}</small></div><div className="unity-near-details"><strong>{t(e.titleEn,e.titleTa)}</strong><span><Icon name="mapPin" size={12}/>{e.venue}</span><span><Icon name="calendar" size={12}/>{shortDate(e.startsAt)}</span></div></Link>)}</div>:<div className="unity-empty"><Icon name="calendar" size={26}/><p>{t('No upcoming events nearby.','அருகில் வரவிருக்கும் நிகழ்வுகள் இல்லை.')}</p><Link to="/events">{t('Browse events','நிகழ்வுகளைப் பார்')}</Link></div>;
      }}</QueryBoundary></section>
      <section className="unity-section" aria-labelledby="unity-events-title"><div className="unity-section-head"><h2 id="unity-events-title">{t('Upcoming Events','வரவிருக்கும் நிகழ்வுகள்')}</h2><Link to="/events">{t('View All','அனைத்தும்')}</Link></div><QueryBoundary query={events}>{()=>upcoming.slice(0,3).map(e=><Link className="unity-event-row" key={e.id} to={'/events/'+e.id}><DateBadge iso={e.startsAt}/><div><strong>{t(e.titleEn,e.titleTa)}</strong><small>{new Date(e.startsAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Colombo'})} · {e.venue}</small></div><Icon name="chevron" size={18}/></Link>)}</QueryBoundary></section>
      <section className="unity-section" aria-labelledby="unity-more-title"><h2 id="unity-more-title">{t('More ways to take part','பங்கேற்க மேலும் வழிகள்')}</h2><div className="unity-more-grid">{MORE.filter(a=>matches(t(a.en,a.ta))).map(a=><Link key={a.to} to={a.to}><Icon name={a.icon} size={22}/><strong>{t(a.en,a.ta)}</strong><Icon name="chevron" size={16}/></Link>)}</div></section>
      <section className="unity-impact" aria-labelledby="unity-impact-title"><div className="unity-section-head"><h2 id="unity-impact-title"><Icon name="sparkles" size={18}/>{t('Your Impact','உங்கள் பங்களிப்பு')}</h2><Link to="/profile">{t('View All','அனைத்தும்')}</Link></div><div className="unity-impact-grid"><Link to="/events"><strong>{events.isSuccess?(events.data??[]).filter(e=>e.myStatus==='going').length:'—'}</strong><small>{t('Events joined','பங்கேற்ற நிகழ்வுகள்')}</small></Link><Link to="/reports"><strong>{reports.isSuccess?reports.data.length:'—'}</strong><small>{t('Reports submitted','பதிவிட்ட பிரச்சினைகள்')}</small></Link><Link to="/referral"><strong>{me?.recruitCount??'—'}</strong><small>{t('People referred','அழைத்த மக்கள்')}</small></Link></div></section>
      <footer className="unity-footer">{t('Local needs. Shared action. Visible progress.','உள்ளூர் தேவைகள். கூட்டு செயல். தெரியும் முன்னேற்றம்.')}<br/><span>MY PEOPLE · <span lang="ta">என் மக்கள்</span></span></footer>
    </div>
  </main>;
}
