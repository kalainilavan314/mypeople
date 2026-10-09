import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { c, font, grad, radius, shadow, type as ty } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { Chip } from '../components/ui';
import { NetImage } from '../components/nn';

/* ============================================================= Gallery — G01-G03
   A curated community archive, not an unmoderated feed (spec §6).
   - G01 albums grid: 2-col masonry, All/Events/Community filters, each card
     shows cover, title, photo count and publication date.
   - G02 album detail: context header (linked event, date, GN, summary) then a
     chronological photo grid.
   - G03 photo viewer: full-screen, caption, "Photo n of N", and an ethical
     "Report a concern / request removal" route (24-hour review SLA).
   Member uploads are not permitted; only authorised media teams publish, so the
   photos here are branded placeholders (no third-party image hosts).
============================================================================= */

interface Album {
  id: string;
  titleTa: string;
  titleEn: string;
  place: string;
  date: string;
  publisher: string;
  summaryEn: string;
  summaryTa: string;
  count: number;
  category: 'events' | 'community';
  src?: string;
  alt: string;
  grad: string;
  span?: boolean;
}

const ALBUMS: Album[] = [
  { id: 'convention', titleTa: 'மாவட்ட மாநாடு', titleEn: 'District convention', place: 'Jaffna Town Hall', date: 'Oct 2026', publisher: 'Northern Media Team', summaryEn: 'Members from across the district gathered to review local priorities.', summaryTa: 'உள்ளூர் முன்னுரிமைகளை மதிப்பாய்வு செய்ய மாவட்டம் முழுவதும் உறுப்பினர்கள் கூடினர்.', count: 48, category: 'events', span: true, grad: grad.primary, alt: 'Volunteers gathered at the district members convention in Jaffna' },
  { id: 'water', titleTa: 'நல்லூர் நீர் திட்டம்', titleEn: 'Nallur water drive', place: 'Nallur, Jaffna', date: 'Oct 2026', publisher: 'Nallur GN Media', summaryEn: 'Volunteers supported the community water supply scheme.', summaryTa: 'சமூக நீர் விநியோகத் திட்டத்திற்கு தன்னார்வலர்கள் உதவினர்.', count: 21, category: 'community', grad: grad.primary, alt: 'Community members working together at the Nallur water drive' },
  { id: 'youth', titleTa: 'இளைஞர் பயிற்சி', titleEn: 'Youth workshop', place: 'Vavuniya', date: 'Sep 2026', publisher: 'Northern Media Team', summaryEn: 'A leadership and digital skills workshop for young members.', summaryTa: 'இளம் உறுப்பினர்களுக்கான தலைமைத்துவ மற்றும் டிஜிட்டல் திறன் பயிற்சி.', count: 33, category: 'events', grad: grad.primary, alt: 'Young Tamil students at a leadership workshop in the Northern Province' },
  { id: 'palmyra', titleTa: 'பனை மீட்பு', titleEn: 'Palmyra planting', place: 'Mullaitivu', date: 'Sep 2026', publisher: 'Mullaitivu DS Media', summaryEn: 'Planting season along the paddy and palmyra fields.', summaryTa: 'நெல் மற்றும் பனை வயல்களில் நடவுப் பருவம்.', count: 64, category: 'community', span: true, grad: grad.primary, alt: 'Green paddy and palmyra fields in Mullaitivu during the planting season' },
  { id: 'library', titleTa: 'நூலக நிகழ்வு', titleEn: 'Library event', place: 'Jaffna Public Library', date: 'Aug 2026', publisher: 'Northern Media Team', summaryEn: 'Youth learning digital skills at the public library.', summaryTa: 'பொது நூலகத்தில் இளைஞர்கள் டிஜிட்டல் திறன்களைக் கற்றனர்.', count: 12, category: 'events', grad: grad.primary, alt: 'Youth learning digital skills at the Jaffna public library' },
  { id: 'cleanup', titleTa: 'கடற்கரை சுத்தம்', titleEn: 'Coast clean-up', place: 'Mannar Beach', date: 'Aug 2026', publisher: 'Mannar GN Media', summaryEn: 'A community clean-up along the Mannar coastline.', summaryTa: 'மன்னார் கடற்கரையோரம் சமூக சுத்தம்.', count: 27, category: 'community', grad: grad.primary, alt: 'Volunteers cleaning the coastal beach at Mannar' },
];

const PHOTO_CAPTIONS: { en: string; ta: string }[] = [
  { en: 'Morning briefing', ta: 'காலை விளக்கம்' },
  { en: 'Teamwork in action', ta: 'கூட்டுப் பணி' },
  { en: 'Local action', ta: 'உள்ளூர் செயல்' },
  { en: 'Community members working together', ta: 'சமூக உறுப்பினர்கள் ஒன்றிணைந்து' },
  { en: 'Wrap-up and thanks', ta: 'நிறைவும் நன்றியும்' },
];

export function Gallery() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [filter, setFilter] = useState<'all' | 'events' | 'community'>('all');
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const albums = ALBUMS.filter((a) => filter === 'all' || a.category === filter);
  const title = (a: Album) => (lang === 'en' ? a.titleEn : a.titleTa);
  const photosOf = (a: Album) => Array.from({ length: Math.min(a.count, 12) }, (_, i) => PHOTO_CAPTIONS[i % PHOTO_CAPTIONS.length]);

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      {/* ---------- G01 header ---------- */}
      <div style={{ background: c.card, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 'none', width: 40, height: 40, borderRadius: radius.md, background: 'var(--soft-blue)', display: 'grid', placeItems: 'center' }}>
          <Icon name="image" size={21} color={c.primary} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: `700 ${ty.section.size}px/1.15 ${font.head}`, color: c.ink0 }}>{t('gallery.title')}</div>
          <div style={{ font: `400 ${ty.secondary.size}px/1.35 ${font.ui}`, color: c.ink2, marginTop: 2 }}>{t('gallery.subtitle')}</div>
        </div>
      </div>

      {/* ---------- Filters ---------- */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 4px', overflowX: 'auto' }}>
        <Chip label={t('gallery.all')} active={filter === 'all'} onClick={() => setFilter('all')} />
        <Chip label={t('gallery.events')} active={filter === 'events'} onClick={() => setFilter('events')} />
        <Chip label={t('gallery.community')} active={filter === 'community'} onClick={() => setFilter('community')} />
      </div>

      {/* ---------- Masonry grid ---------- */}
      <div style={{ padding: '12px 16px 28px', columnCount: 2, columnGap: 12 }}>
        {albums.map((a) => (
          <div key={a.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setOpenAlbum(a)}
              className="press"
              aria-label={`${title(a)} — ${a.count} ${t('gallery.photos', 'photos')}`}
              style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ position: 'relative', height: a.span ? 220 : 150, borderRadius: radius.lg, overflow: 'hidden', boxShadow: shadow.card }}>
                <NetImage src={a.src} alt={a.alt} width="100%" height={a.span ? 220 : 150} fallbackIcon="camera" fallbackGrad={a.grad} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.15) 55%, transparent 100%)' }} />
                <div style={{ position: 'absolute', top: 10, right: 10, display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px', borderRadius: radius.pill, background: 'rgba(0,0,0,.45)' }}>
                  <Icon name="image" size={12} color="#fff" />
                  <span style={{ font: `700 11px/1 ${font.ui}`, color: '#fff' }}>{a.count}</span>
                </div>
                <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                  <div style={{ font: `700 15px/1.25 ${font.ta}`, color: '#fff' }}>{title(a)}</div>
                  <div style={{ font: `500 11px/1.3 ${font.ui}`, color: 'rgba(255,255,255,.85)', marginTop: 3 }}>
                    {a.count} {t('gallery.photos', 'photos')} · {a.date}
                  </div>
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* ---------- G02 album detail ---------- */}
      {openAlbum && (
        <AlbumDetail
          album={openAlbum}
          title={title(openAlbum)}
          summary={lang === 'en' ? openAlbum.summaryEn : openAlbum.summaryTa}
          photos={photosOf(openAlbum)}
          lang={lang}
          t={t}
          onClose={() => setOpenAlbum(null)}
          onOpenPhoto={(i) => setViewer(i)}
        />
      )}

      {/* ---------- G03 photo viewer ---------- */}
      {openAlbum && viewer !== null && (
        <PhotoViewer
          grad={openAlbum.grad}
          index={viewer}
          total={photosOf(openAlbum).length}
          caption={(() => { const p = photosOf(openAlbum)[viewer]; return lang === 'en' ? p.en : p.ta; })()}
          albumTitle={title(openAlbum)}
          t={t}
          onPrev={() => setViewer((v) => (v === null ? v : Math.max(0, v - 1)))}
          onNext={() => setViewer((v) => (v === null ? v : Math.min(photosOf(openAlbum).length - 1, v + 1)))}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- AlbumDetail */
function AlbumDetail({
  album, title, summary, photos, lang, t, onClose, onOpenPhoto,
}: {
  album: Album; title: string; summary: string; photos: { en: string; ta: string }[]; lang: string;
  t: (k: string, d: string) => string; onClose: () => void; onOpenPhoto: (i: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      style={{ width: 'min(100%, 448px)', maxWidth: '100%', height: '100%', maxHeight: '100%', margin: 0, padding: 0, border: 'none', background: c.page }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* context header */}
        <header style={{ background: c.card, borderBottom: `1px solid ${c.hairline}`, padding: 'calc(14px + var(--safe-top,0px)) 16px 16px' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.back', 'Back')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: c.accent, font: `600 ${ty.label.size}px/1 ${font.ui}`, cursor: 'pointer', padding: 0, marginBottom: 12 }}
          >
            <Icon name="chevronLeft" size={18} strokeWidth={2.4} /> {t('gallery.albums', 'Gallery albums')}
          </button>
          <h1 style={{ font: `700 ${ty.page.size}px/1.2 ${font.head}`, color: c.ink0, margin: 0 }}>{title}</h1>
          <div style={{ font: `500 ${ty.secondary.size}px/1.4 ${font.ui}`, color: c.ink3, marginTop: 6 }}>
            {t('gallery.publishedBy', 'Published by')} {album.publisher} · {album.count} {t('gallery.photos', 'photos')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: `500 ${ty.secondary.size}px/1.4 ${font.ui}`, color: c.ink3, marginTop: 4 }}>
            <Icon name="mapPin" size={13} color={c.ink3} strokeWidth={2} /> {album.place} · {album.date}
          </div>
          <p style={{ font: `400 ${ty.body.size}px/1.5 ${font.ui}`, color: c.ink2, margin: '12px 0 0' }}>{summary}</p>
        </header>

        {/* chronological photo grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {photos.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onOpenPhoto(i)}
                aria-label={`${t('gallery.photo', 'Photo')} ${i + 1}: ${lang === 'en' ? p.en : p.ta}`}
                className="press"
                style={{ position: 'relative', height: 130, borderRadius: radius.md, overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', background: album.grad }}
              >
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Icon name="camera" size={26} color="rgba(255,255,255,.75)" strokeWidth={1.7} />
                </div>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent 60%)' }} />
                <span style={{ position: 'absolute', left: 8, right: 8, bottom: 8, font: `500 10.5px/1.3 ${font.ui}`, color: '#fff', textAlign: 'left' }}>
                  {lang === 'en' ? p.en : p.ta}
                </span>
              </button>
            ))}
          </div>
          <p style={{ font: `400 ${ty.caption.size}px/1.5 ${font.ui}`, color: c.ink4, textAlign: 'center', margin: '18px 0 8px' }}>
            {t('gallery.moderatedNote', 'Moderated collection. Request photo removal from the photo viewer.')}
          </p>
        </div>
      </div>
    </dialog>
  );
}

/* --------------------------------------------------------------- PhotoViewer */
function PhotoViewer({
  grad: g, index, total, caption, albumTitle, t, onPrev, onNext, onClose,
}: {
  grad: string; index: number; total: number; caption: string; albumTitle: string;
  t: (k: string, d: string) => string; onPrev: () => void; onNext: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reported, setReported] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { setReported(false); }, [index]);

  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      style={{ width: '100%', maxWidth: '100%', height: '100%', maxHeight: '100%', margin: 0, padding: 0, border: 'none', background: '#000' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: '#fff' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(12px + var(--safe-top,0px)) 16px 12px' }}>
          <span style={{ font: `600 ${ty.caption.size}px/1 ${font.ui}`, color: 'rgba(255,255,255,.9)' }}>
            {t('gallery.photo', 'Photo')} {index + 1} {t('gallery.of', 'of')} {total}
          </span>
          <button type="button" onClick={onClose} aria-label={t('common.dismiss', 'Dismiss')} style={{ width: 40, height: 40, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="x" size={20} color="#fff" />
          </button>
        </header>

        <div style={{ flex: 1, position: 'relative', background: g, display: 'grid', placeItems: 'center' }}>
          <Icon name="camera" size={56} color="rgba(255,255,255,.6)" strokeWidth={1.4} />
          {index > 0 && (
            <button type="button" onClick={onPrev} aria-label={t('gallery.prev', 'Previous photo')} style={navBtn('left')}>
              <Icon name="chevronLeft" size={22} color="#fff" strokeWidth={2.4} />
            </button>
          )}
          {index < total - 1 && (
            <button type="button" onClick={onNext} aria-label={t('gallery.next', 'Next photo')} style={navBtn('right')}>
              <Icon name="chevron" size={22} color="#fff" strokeWidth={2.4} />
            </button>
          )}
        </div>

        <footer style={{ padding: '16px 16px calc(20px + var(--safe-bottom,0px))' }}>
          <div style={{ font: `600 ${ty.card.size}px/1.4 ${font.ui}`, color: '#fff' }}>{caption}</div>
          <div style={{ font: `400 ${ty.secondary.size}px/1.4 ${font.ui}`, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>{albumTitle}</div>
          <button
            type="button"
            onClick={() => setReported(true)}
            disabled={reported}
            style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'none', color: reported ? 'rgba(255,255,255,.65)' : '#F87171', font: `600 ${ty.label.size}px/1.3 ${font.ui}`, cursor: reported ? 'default' : 'pointer', padding: 0, textAlign: 'left' }}
          >
            <Icon name={reported ? 'check' : 'flag'} size={16} color={reported ? 'rgba(255,255,255,.65)' : '#F87171'} strokeWidth={2.2} />
            {reported
              ? t('gallery.removalRecorded', 'Request recorded — a coordinator will review within 24 hours.')
              : t('gallery.reportConcern', 'Report a concern / request photo removal')}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function navBtn(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 10,
    width: 44, height: 44, borderRadius: 999, border: 'none', background: 'rgba(255,255,255,.16)',
    display: 'grid', placeItems: 'center', cursor: 'pointer',
  } as React.CSSProperties;
}
