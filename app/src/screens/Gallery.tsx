import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceText } from '../components/MemberWorkspace';
import { Icon } from '../components/Icon';
import { ScreenTitle, IconButton, StatusTag } from '../components/Civic';
import { QueryBoundary } from '../components/ui';
import { useGallery, type GalleryAlbum, type GalleryPhoto } from '../data/gallery';

function Photo({ photo, label, alt }: { photo: GalleryPhoto; label: string; alt: string }) {
  const [failed,setFailed] = useState(false);
  return failed ? <div className="civic-photo-fallback"><Icon name="image" size={20} /><span>{label}</span></div> : <img src={photo.src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
export function Gallery() {
  const t = useWorkspaceText();
  const gallery = useGallery();
  const [filter,setFilter] = useState<'all'|'events'|'community'>('all');
  const [selected,setSelected] = useState<GalleryAlbum | null>(null);
  const [index,setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if(selected) dialog.current?.showModal(); },[selected]);
  return <main className="civic-page">
    <ScreenTitle title={t('Gallery','படத்தொகுப்பு')} subtitle={t('Community places and published moments','சமூக இடங்கள் மற்றும் வெளியிடப்பட்ட நிகழ்வுகள்')} />
    <div className="civic-filter-row" role="group" aria-label={t('Album categories','படத்தொகுப்பு வகைகள்')}>
      {(['all','events','community'] as const).map(key => <button type="button" key={key} className="civic-chip" aria-pressed={filter===key} onClick={() => setFilter(key)}>{key==='all' ? t('All','அனைத்தும்') : key==='events' ? t('Events','நிகழ்வுகள்') : t('Community','சமூகம்')}</button>)}
    </div>
    <QueryBoundary query={gallery}>{albums => {
      const filtered = albums.filter(a => filter==='all' || a.category===filter);
      return <>
        {albums.some(a=>a.sample) && <p className="civic-location">{t('Sample photo collections. Replace with approved community albums.','மாதிரிப் படத்தொகுப்புகள். அங்கீகரிக்கப்பட்ட சமூகப் படங்களால் மாற்றவும்.')}</p>}
        {filtered.length ? <div className="civic-album-grid">{filtered.map(a => <button type="button" key={a.id} className="civic-card civic-album-card" aria-label={t(a.titleEn,a.titleTa) + ', ' + a.count + ' ' + t('photos','படங்கள்')} onClick={()=>{setIndex(0);setSelected(a);}}>
          <div className="civic-album-photo"><Photo photo={a.photos[0]} alt={t(a.photos[0].altEn,a.photos[0].altTa)} label={t('Photo unavailable','படம் கிடைக்கவில்லை')} /><div className="civic-photo-counter"><Icon name="camera" size={12} />{a.count}</div></div>
          <div className="civic-album-caption"><strong>{t(a.titleEn,a.titleTa)}</strong><small>{new Date(a.publishedAt).toLocaleDateString(t('en-GB','ta-LK'),{month:'short',year:'numeric',timeZone:'Asia/Colombo'})}</small></div>
        </button>)}</div> : <div className="civic-card"><p>{t('No albums in this category yet.','இந்த வகையில் படத்தொகுப்புகள் இல்லை.')}</p><button type="button" className="civic-text-action" onClick={()=>setFilter('all')}>{t('View all albums','அனைத்தையும் பார்')}</button></div>}
      </>;
    }}</QueryBoundary>
    {selected && <dialog ref={dialog} className="civic-dialog" aria-labelledby="album-title" onCancel={()=>setSelected(null)} onClose={()=>setSelected(null)}>
      <div className="civic-dialog-head"><h2 id="album-title">{t(selected.titleEn,selected.titleTa)}</h2><IconButton icon="x" label={t('Close album','படத்தொகுப்பை மூடு')} onClick={()=>setSelected(null)} /></div>
      {selected.sample && <StatusTag>{t('Sample imagery','மாதிரிப் படம்')}</StatusTag>}
      <p>{selected.place} · {selected.publisher}</p>
      <div className="civic-album-photo"><Photo key={selected.photos[index].id} photo={selected.photos[index]} alt={t(selected.photos[index].altEn,selected.photos[index].altTa)} label={t('Photo unavailable','படம் கிடைக்கவில்லை')} /></div>
      <p>{t(selected.photos[index].altEn,selected.photos[index].altTa)}</p>
      <p>{selected.photos[index].credit} · <a className="civic-text-action" href={selected.photos[index].licenseUrl} target="_blank" rel="noreferrer">{selected.photos[index].license}</a> · <a className="civic-text-action" href={selected.photos[index].sourceUrl} target="_blank" rel="noreferrer">{t('Original photo','அசல் படம்')}</a></p>
      <div className="civic-dialog-head"><IconButton icon="chevronLeft" label={t('Previous photo','முந்தைய படம்')} onClick={()=>setIndex((index+selected.photos.length-1)%selected.photos.length)} /><span aria-live="polite">{index+1} / {selected.photos.length}</span><IconButton icon="chevron" label={t('Next photo','அடுத்த படம்')} onClick={()=>setIndex((index+1)%selected.photos.length)} /></div>
      <p>{t('For a photo concern, contact your area coordinator.','படம் தொடர்பான கோரிக்கைக்கு உங்கள் பகுதி ஒருங்கிணைப்பாளரைத் தொடர்பு கொள்ளவும்.')}</p><Link className="civic-text-action" to="/area" onClick={()=>setSelected(null)}>{t('Open my area','எனது பகுதியைத் திற')}</Link>
    </dialog>}
  </main>;
}
