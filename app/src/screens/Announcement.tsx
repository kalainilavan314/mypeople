import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { c, font, radius } from '../theme/tokens';
import { pick } from '../i18n';
import { Icon } from '../components/Icon';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, QueryBoundary } from '../components/ui';
import { useAnnouncement } from '../data/queries';
import { useState } from 'react';

export function Announcement() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const annQ = useAnnouncement(id);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div>
      <ScreenHeader titleTa="அறிவிப்பு" titleEn="Announcement" />
      <QueryBoundary query={annQ}>
        {(a) =>
          a ? (
            <div style={{ padding: '0 0 28px' }}>
              <div style={{ height: 200, background: c.cardWarm, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="camera" size={30} color={c.ink3} strokeWidth={1.7} />
                <span style={{ font: `500 12px/1 ${font.ui}`, color: c.ink3 }}>{t('home.photoPlaceholder')}</span>
              </div>
              <div style={{ padding: '18px 16px' }}>
                <div style={{ font: `600 10px/1 ${font.ui}`, letterSpacing: '.14em', textTransform: 'uppercase', color: c.maroonHover }}>{a.authorName} · 2 h</div>
                <h1 style={{ font: `700 22px/1.4 ${font.ta}`, color: c.ink, margin: '10px 0 0' }}>{pick(lang, a.titleTa, a.titleEn)}</h1>
                <p style={{ font: `400 15px/1.7 ${font.ta}`, color: c.ink2 }}>{a.bodyTa}</p>
                <p style={{ font: `400 14px/1.7 ${font.ui}`, color: c.ink2 }}>{a.bodyEn}</p>

                <div style={{ background: c.cardCream, borderRadius: radius.lg, padding: 16, marginTop: 8 }}>
                  <div style={{ font: `600 13px/1 ${font.ta}`, color: c.ink }}>முக்கிய விவரங்கள் · Key details</div>
                  <Detail icon="calendar" label="ஆகஸ்ட் 17, 3:30 PM" />
                  <Detail icon="mapPin" label="Jaffna Town Hall" />
                </div>

                <div style={{ marginTop: 18 }}>
                  <Button fullWidth variant={confirmed ? 'success' : 'primary'} icon={confirmed ? 'check' : undefined} onClick={() => setConfirmed(true)}>
                    {confirmed ? t('events.checkedIn') : 'வருகையை உறுதிப்படுத்து · Confirm attendance'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 24 }}>{t('common.empty')}</div>
          )
        }
      </QueryBoundary>
    </div>
  );
}

function Detail({ icon, label }: { icon: 'calendar' | 'mapPin'; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 10 }}>
      <Icon name={icon} size={17} color={c.maroon} strokeWidth={2} />
      <span style={{ font: `500 13px/1.4 ${font.ui}`, color: c.ink2 }}>{label}</span>
    </div>
  );
}
