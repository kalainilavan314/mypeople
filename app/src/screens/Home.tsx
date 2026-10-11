import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMeQuery } from '../hooks/useMe';
import { useEvents, useMyCommunityReports } from '../data/queries';
import { QueryBoundary } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { DateBadge, QuickAction, StatusTag } from '../components/Civic';
import { displayMemberName } from '../lib/memberDisplay';
import { useWorkspaceText } from '../components/MemberWorkspace';

const ACTIONS: { to: string; icon: IconName; en: string; ta: string; subEn: string; subTa: string }[] = [
  { to: '/reports', icon: 'report', en: 'Report issue', ta: 'பிரச்சினை பதிவு', subEn: 'Local concerns', subTa: 'உள்ளூர் பிரச்சினைகள்' },
  { to: '/skills', icon: 'handHeart', en: 'Volunteer', ta: 'தன்னார்வம்', subEn: 'Share skills', subTa: 'திறன்களைப் பகிர்' },
  { to: '/area', icon: 'mapPin', en: 'My area', ta: 'எனது பகுதி', subEn: 'GN updates', subTa: 'பகுதி புதுப்பிப்புகள்' },
  { to: '/community', icon: 'users', en: 'Community', ta: 'சமூகம்', subEn: 'Hub & services', subTa: 'சேவைகள்' },
];

const MORE: {to:string;icon:IconName;en:string;ta:string}[] = [
  {to:'/survey',icon:'clipboard',en:'Surveys',ta:'கருத்துக்கணிப்புகள்'},
  {to:'/events',icon:'calendar',en:'Events',ta:'நிகழ்வுகள்'},
  {to:'/ideas',icon:'bulb',en:'My ideas',ta:'எனது யோசனைகள்'},
  {to:'/courses',icon:'book',en:'My courses',ta:'எனது பாடங்கள்'},
  {to:'/referral',icon:'users',en:'Invite people',ta:'மக்களை அழையுங்கள்'},
  {to:'/fund',icon:'heart',en:'Party Fund',ta:'கட்சி நிதி'},
  {to:'/gallery',icon:'image',en:'Photo gallery',ta:'படத்தொகுப்பு'},
  {to:'/card',icon:'card',en:'Membership card',ta:'உறுப்பினர் அட்டை'},
];

export function Home() {
  const meQ = useMeQuery();
  const [searchOpen,setSearchOpen]=useState(false),[search,setSearch]=useState('');
  const events = useEvents();
  const reports = useMyCommunityReports();
  const t = useWorkspaceText();
  const me = meQ.data;
  const name = (displayMemberName(me ?? null) ?? t('Member','உறுப்பினர்')).split(' ')[0];
  const location = [me?.districtName, me?.gsName].filter(Boolean).join(' / ') || t('Your GN division', 'உங்கள் கிராம சேவகர் பிரிவு');
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Colombo' }).format(new Date()));
  const greeting = hour < 12 ? t('Good morning', 'காலை வணக்கம்') : hour < 17 ? t('Good afternoon', 'மதிய வணக்கம்') : t('Good evening', 'மாலை வணக்கம்');
  const pending = me?.verificationStatus === 'review_pending';
  const upcoming = (events.data ?? []).filter(e => Date.parse(e.startsAt) >= Date.now()).sort((a,b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const next = upcoming.find(e => e.isMine) ?? upcoming[0];
  return <main className="civic-page">
    <header className="civic-greeting">
      <div><h1>{greeting}, {name}</h1><div className="civic-location"><Icon name="mapPin" size={16} strokeWidth={2} /><span>{location}</span></div></div>
      <Link to="/notifications" className="civic-icon-button" aria-label={t('Notifications', 'அறிவிப்புகள்')}><span><Icon name="bell" size={20} strokeWidth={2} /></span></Link>
    </header>
    {pending ? <section className="civic-card civic-next-step" aria-label={t('Verification in progress', 'சரிபார்ப்பு நடைபெறுகிறது')}>
      <StatusTag tone="pending">{t('Verification in progress', 'சரிபார்ப்பு நடைபெறுகிறது')}</StatusTag>
      <h2>{t('Your documents are awaiting review', 'உங்கள் ஆவணங்கள் மதிப்பாய்விற்காகக் காத்திருக்கின்றன')}</h2>
      <p className="civic-location">{t('We will notify you when the team completes the review.', 'மதிப்பாய்வு முடிந்ததும் உங்களுக்கு அறிவிப்போம்.')}</p>
      <Link className="civic-primary civic-primary--40" to="/profile">{t('View verification', 'சரிபார்ப்பைப் பார்')}</Link>
    </section> : <section className="civic-card civic-next-step" aria-label={t('Your next step', 'உங்கள் அடுத்த படி')}>
      <span className="civic-eyebrow">{t('YOUR NEXT STEP', 'உங்கள் அடுத்த படி')}</span>
      <QueryBoundary query={events}>{() => <>
        <h2>{next ? t(next.titleEn, next.titleTa) : t('Explore your community', 'உங்கள் சமூகத்தை அறியுங்கள்')}</h2>
        <div className="civic-location"><Icon name={next ? 'mapPin' : 'users'} size={14} strokeWidth={2} /><span>{next?.venue || t('Find local services and opportunities to participate.', 'உள்ளூர் சேவைகள் மற்றும் பங்கேற்கும் வாய்ப்புகளைக் கண்டறியுங்கள்.')}</span></div>
        <Link to={next ? '/events/' + next.id : '/community'} className="civic-primary civic-primary--40">{next ? t('View event', 'நிகழ்வைப் பார்') : t('Open community hub', 'சமூக மையத்தைத் திற')}<Icon name="arrowRight" size={16} strokeWidth={2} /></Link>
      </>}</QueryBoundary>
    </section>}
    <section className="civic-action-grid" aria-label={t('Quick actions', 'விரைவுச் செயல்கள்')}>
      {ACTIONS.map(a => <QuickAction key={a.to} to={a.to} icon={a.icon} label={t(a.en,a.ta)} caption={t(a.subEn,a.subTa)} />)}
    </section>
    <section className="civic-section" aria-labelledby="nearby-title">
      <div className="civic-section-heading"><h2 id="nearby-title">{t('Coming up nearby', 'அருகில் வரவிருப்பவை')}</h2><Link className="civic-text-action" to="/events">{t('See all', 'அனைத்தும்')}<Icon name="chevron" size={16} /></Link></div>
      <QueryBoundary query={events}>{() => next ? <Link to={'/events/' + next.id} className="civic-card civic-event-preview">
        <DateBadge iso={next.startsAt} /><div><strong>{t(next.titleEn,next.titleTa)}</strong><p>{new Date(next.startsAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Colombo'})} · {next.venue}</p><StatusTag tone={next.myStatus === 'going' ? 'verified' : 'neutral'}>{next.myStatus === 'going' ? t('Going', 'செல்கிறேன்') : t('Open', 'திறந்துள்ளது')}</StatusTag></div>
      </Link> : <div className="civic-card"><p className="civic-location">{t('No upcoming events nearby.', 'அருகில் வரவிருக்கும் நிகழ்வுகள் இல்லை.')}</p><Link to="/events" className="civic-text-action">{t('Browse all events', 'அனைத்து நிகழ்வுகளையும் பார்')}</Link></div>}</QueryBoundary>
    </section>
    <section className="civic-section" aria-labelledby="services-title"><div className="civic-section-heading"><h2 id="services-title">{t('More ways to take part','பங்கேற்க மேலும் வழிகள்')}</h2><button className="civic-icon-button" type="button" aria-label={t('Search activities','செயல்களைத் தேடு')} aria-expanded={searchOpen} onClick={()=>{setSearchOpen(!searchOpen);setSearch('');}}><span><Icon name={searchOpen?'x':'search'} size={20}/></span></button></div>{searchOpen&&<input className="civic-service-search" type="search" autoFocus value={search} onChange={e=>setSearch(e.target.value)} aria-label={t('Search activities','செயல்களைத் தேடு')} placeholder={t('Search surveys, courses and services','கருத்துக்கணிப்புகள், பாடங்கள் மற்றும் சேவைகளைத் தேடு')}/>}<div className="civic-service-grid">{MORE.filter(a=>!search.trim()||t(a.en,a.ta).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(a=><Link key={a.to} className="civic-card civic-service" to={a.to}><Icon name={a.icon} size={20}/><strong>{t(a.en,a.ta)}</strong><Icon name="chevron" size={16}/></Link>)}</div>{searchOpen&&!MORE.some(a=>t(a.en,a.ta).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))&&<p className="civic-location" role="status">{t('No matching services. Try another search.','பொருத்தமான சேவைகள் இல்லை. மீண்டும் தேடுங்கள்.')}</p>}</section>
    <section className="civic-section" aria-labelledby="impact-title"><h2 id="impact-title">{t('Your activity','உங்கள் செயல்பாடு')}</h2><div className="civic-activity-grid"><Link className="civic-card" to="/events"><strong>{events.isSuccess?(events.data??[]).filter(e=>e.myStatus==='going').length:'—'}</strong><span>{t('Events joined','பங்கேற்ற நிகழ்வுகள்')}</span></Link><Link className="civic-card" to="/reports"><strong>{reports.isSuccess?reports.data.length:'—'}</strong><span>{t('Reports submitted','பதிவிட்ட பிரச்சினைகள்')}</span></Link><Link className="civic-card" to="/referral"><strong>{me?.recruitCount??'—'}</strong><span>{t('People referred','அழைத்த மக்கள்')}</span></Link></div></section>
    <footer className="civic-footer">{t('Local needs, shared action, visible progress.', 'உள்ளூர் தேவைகள், கூட்டு செயல், தெரியும் முன்னேற்றம்.')}</footer>
  </main>;
}
