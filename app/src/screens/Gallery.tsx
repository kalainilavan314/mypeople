import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { c, font, grad, radius, shadow } from '../theme/tokens';
import { Icon } from '../components/Icon';
import { Chip } from '../components/ui';
import { NetImage } from '../components/nn';

interface Album {
  id: string;
  titleTa: string;
  titleEn: string;
  place: string;
  count: number;
  category: 'events' | 'community';
  src: string;
  alt: string;
  grad: string; // fallback when the photo can't load (offline)
  span?: boolean; // taller tile
}

const ALBUMS: Album[] = [
  {
    id: 'convention', titleTa: 'மாவட்ட மாநாடு', titleEn: 'District convention', place: 'Jaffna Town Hall',
    count: 48, category: 'events', span: true, grad: grad.primary,
    src: 'https://images.unsplash.com/photo-1613899323447-87ac2ee746b8',
    alt: 'Volunteers gathered at the district members convention in Jaffna',
  },
  {
    id: 'water', titleTa: 'நல்லூர் நீர் திட்டம்', titleEn: 'Nallur water drive', place: 'Nallur, Jaffna',
    count: 21, category: 'community', grad: grad.survey,
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_19d6d5413-1786524734227.png',
    alt: 'Community members working together at the Nallur water drive',
  },
  {
    id: 'youth', titleTa: 'இளைஞர் பயிற்சி', titleEn: 'Youth workshop', place: 'Vavuniya',
    count: 33, category: 'events', grad: grad.community,
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e394c2f2-1786524735001.png',
    alt: 'Young Tamil students at a leadership workshop in the Northern Province',
  },
  {
    id: 'palmyra', titleTa: 'பனை மீட்பு', titleEn: 'Palmyra planting', place: 'Mullaitivu',
    count: 64, category: 'community', span: true, grad: 'linear-gradient(135deg,#2D7A4F,#8BC34A)',
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1c57ce6e8-1786524733616.png',
    alt: 'Green paddy and palmyra fields in Mullaitivu during the planting season',
  },
  {
    id: 'library', titleTa: 'நூலக நிகழ்வு', titleEn: 'Library event', place: 'Jaffna Public Library',
    count: 12, category: 'events', grad: grad.events,
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_16cd4df73-1786524735503.png',
    alt: 'Youth learning digital skills at the Jaffna public library',
  },
  {
    id: 'cleanup', titleTa: 'கடற்கரை சுத்தம்', titleEn: 'Coast clean-up', place: 'Mannar Beach',
    count: 27, category: 'community', grad: 'linear-gradient(135deg,#4A90D9,#74B3E8)',
    src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1436754dd-1786524734456.png',
    alt: 'Volunteers cleaning the coastal beach at Mannar',
  },
];

export function Gallery() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [filter, setFilter] = useState<'all' | 'events' | 'community'>('all');

  const albums = ALBUMS.filter((a) => filter === 'all' || a.category === filter);

  return (
    <div className="fade-up" style={{ background: c.page, minHeight: '100%' }}>
      {/* Light surface header (NorthNadu pattern: bold title + muted sub) */}
      <div style={{ background: c.card, padding: '18px 20px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 'none', width: 40, height: 40, borderRadius: 12, background: c.maroonTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="image" size={21} color={c.primary} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: `700 22px/1.15 ${font.head}`, color: c.ink, letterSpacing: '-0.3px' }}>{t('gallery.title')}</div>
          <div style={{ font: `400 13px/1.35 ${font.ui}`, color: c.ink2, marginTop: 2 }}>{t('gallery.subtitle')}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 16px 4px', overflowX: 'auto' }}>
        <Chip label={t('gallery.all')} active={filter === 'all'} onClick={() => setFilter('all')} />
        <Chip label={t('gallery.events')} active={filter === 'events'} onClick={() => setFilter('events')} />
        <Chip label={t('gallery.community')} active={filter === 'community'} onClick={() => setFilter('community')} />
      </div>

      {/* Masonry-ish grid */}
      <div style={{ padding: '12px 16px 28px', columnCount: 2, columnGap: 12 }}>
        {albums.map((a) => (
          <div key={a.id} style={{ breakInside: 'avoid', marginBottom: 12 }}>
            <div className="press" style={{ position: 'relative', height: a.span ? 220 : 150, borderRadius: radius.xl, overflow: 'hidden', boxShadow: shadow.card, cursor: 'pointer' }}>
              <NetImage src={a.src} alt={a.alt} width="100%" height={a.span ? 220 : 150} fallbackIcon="camera" fallbackGrad={a.grad} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.8) 0%, rgba(0,0,0,.15) 55%, transparent 100%)' }} />
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 9px', borderRadius: 999, background: 'rgba(0,0,0,.42)', backdropFilter: 'blur(6px)' }}>
                <Icon name="image" size={12} color="#fff" />
                <span style={{ font: `700 11px/1 ${font.ui}`, color: '#fff' }}>{a.count}</span>
              </div>
              <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
                <div style={{ font: `700 15px/1.25 ${font.ta}`, color: '#fff' }}>{lang === 'en' ? a.titleEn : a.titleTa}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Icon name="mapPin" size={11} color="rgba(255,255,255,.8)" strokeWidth={2.2} />
                  <span style={{ font: `400 11px/1 ${font.ui}`, color: 'rgba(255,255,255,.8)' }}>{a.place}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
