import { useCourses } from '@/core/api/queries';
import { pick } from '@/core/i18n';
import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { QueryBoundary } from '@/shared/components/ui';
import { useTranslation } from 'react-i18next';

export function Courses() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const coursesQ = useCourses();

  return (
    <div>
      <ScreenHeader titleTa={t('profile.myCourses')} titleEn="My courses" />
      <QueryBoundary query={coursesQ}>
        {(courses) => {
          const inProgress = courses.filter((c2) => c2.lessonsDone > 0);
          const available = courses.filter((c2) => c2.lessonsDone === 0);
          return (
            <div style={{ padding: '16px 16px 28px' }}>
              {inProgress.length > 0 && (
                <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink, marginBottom: 12 }}>
                  {t('courses.inProgress')}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {inProgress.map((course) => {
                  const pct = Math.round((course.lessonsDone / course.lessonsTotal) * 100);
                  return (
                    <div
                      key={course.id}
                      style={{
                        background: c.card,
                        border: `1px solid ${c.hairline}`,
                        borderRadius: radius.lg,
                        padding: 16,
                      }}
                    >
                      <div style={{ font: `600 15px/1.3 ${font.ta}`, color: c.ink }}>
                        {pick(lang, course.titleTa, course.titleEn)}
                      </div>
                      <div
                        style={{
                          font: `400 12px/1 ${font.ui}`,
                          color: c.ink3,
                          margin: '6px 0 12px',
                        }}
                      >
                        {course.lessonsDone}/{course.lessonsTotal} · {course.minutes} min
                      </div>
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: c.hairline2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: c.maroon,
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ font: `600 14px/1 ${font.ta}`, color: c.ink, margin: '24px 0 12px' }}>
                {t('courses.available')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {available.map((course) => (
                  <div
                    key={course.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      background: c.card,
                      border: `1px solid ${c.hairline}`,
                      borderRadius: radius.lg,
                      padding: 16,
                    }}
                  >
                    <span
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        background: c.maroonTint,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Icon name="book" size={20} color={c.maroon} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ font: `600 14px/1.3 ${font.ta}`, color: c.ink }}>
                        {pick(lang, course.titleTa, course.titleEn)}
                      </div>
                      <div style={{ font: `400 12px/1 ${font.ui}`, color: c.ink3, marginTop: 3 }}>
                        {course.lessonsTotal} lessons · {course.minutes} min
                      </div>
                    </div>
                    <Icon name="chevron" size={18} color={c.ink3} strokeWidth={2} />
                  </div>
                ))}
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
