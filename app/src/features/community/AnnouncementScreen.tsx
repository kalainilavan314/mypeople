import { useAnnouncement } from '@/core/api/queries';
import { pick } from '@/core/i18n';
import { c, font } from '@/core/theme/tokens';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { QueryBoundary } from '@/shared/components/ui';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

/**
 * One announcement, in the member's language, with its own date. It used to show a
 * fixed "2 h" age, a fixed date and venue under "Key details", and a "Confirm
 * attendance" button that changed only the screen; none of it came from the
 * announcement, so it is gone. Attendance belongs to events, which record it.
 */
export function Announcement() {
  const { id = '' } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const annQ = useAnnouncement(id);

  return (
    <div>
      <ScreenHeader titleTa="அறிவிப்பு" titleEn="Announcement" />
      <QueryBoundary query={annQ}>
        {(a) =>
          a ? (
            <article style={{ padding: '0 0 28px' }}>
              {a.photoUrl && (
                <img
                  src={a.photoUrl}
                  alt=""
                  style={{ display: 'block', width: '100%', maxHeight: 240, objectFit: 'cover' }}
                />
              )}
              <div style={{ padding: '18px 16px' }}>
                <p style={{ font: `600 13px/1.5 ${font.ui}`, color: c.ink3, margin: 0 }}>
                  {a.authorName} · <time dateTime={a.publishedAt}>{publishedOn(a.publishedAt, lang)}</time>
                </p>
                <h1 style={{ font: `700 22px/1.4 ${font.ui}`, color: c.ink, margin: '8px 0 0' }}>
                  {pick(lang, a.titleTa, a.titleEn)}
                </h1>
                <p
                  style={{
                    font: `400 16px/1.7 ${font.ui}`,
                    color: c.ink2,
                    margin: '12px 0 0',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {pick(lang, a.bodyTa, a.bodyEn)}
                </p>
              </div>
            </article>
          ) : (
            <div style={{ padding: 24 }}>{t('common.empty')}</div>
          )
        }
      </QueryBoundary>
    </div>
  );
}

function publishedOn(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(lang.startsWith('ta') ? 'ta-LK' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  });
}
