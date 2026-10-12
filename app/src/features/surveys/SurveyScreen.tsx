import { useSurvey, useVoteSurvey } from '@/core/api/queries';
import { pick } from '@/core/i18n';
import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Button, QueryBoundary } from '@/shared/components/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Survey() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const surveyQ = useSurvey();
  const vote = useVoteSurvey();
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <div>
      <ScreenHeader titleTa={t('survey.title')} titleEn="Survey" />
      <QueryBoundary query={surveyQ}>
        {(survey) => {
          const q = survey.questions[Math.min(step, survey.questions.length - 1)];
          const last = step >= survey.questions.length - 1;
          const next = () => {
            if (choice) vote.mutate({ questionId: q.id, optionId: choice });
            if (last) {
              navigate('/');
            } else {
              setStep((s) => s + 1);
              setChoice(null);
            }
          };
          return (
            <div style={{ padding: '18px 16px 28px' }}>
              <div style={{ font: `600 12px/1 ${font.ui}`, color: c.ink3 }}>
                {t('survey.progress', { current: step + 1, total: survey.questions.length })}
              </div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: c.hairline2,
                  overflow: 'hidden',
                  margin: '8px 0 20px',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${((step + 1) / survey.questions.length) * 100}%`,
                    background: c.maroon,
                    borderRadius: 999,
                    transition: 'width 260ms cubic-bezier(.22,.61,.36,1)',
                  }}
                />
              </div>

              <div style={{ font: `600 18px/1.5 ${font.ta}`, color: c.ink }}>
                {pick(lang, q.promptTa, q.promptEn)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
                {q.options.map((o) => {
                  const picked = choice === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setChoice(o.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textAlign: 'left',
                        padding: '15px 14px',
                        borderRadius: radius.md,
                        border: `1.5px solid ${picked ? c.maroon : c.hairline}`,
                        background: picked ? c.maroonTint : c.card,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          border: `2px solid ${picked ? c.maroon : c.hairline2}`,
                          background: picked ? c.maroon : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none',
                        }}
                      >
                        {picked && (
                          <Icon name="check" size={12} color="#FFFFFF" strokeWidth={2.6} />
                        )}
                      </span>
                      <span style={{ font: `600 15px/1.3 ${font.ta}`, color: c.ink }}>
                        {pick(lang, o.labelTa, o.labelEn)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginTop: 18,
                  padding: 12,
                  background: c.cardCream,
                  borderRadius: radius.md,
                }}
              >
                <Icon
                  name="lock"
                  size={16}
                  color={c.ink3}
                  strokeWidth={2}
                  style={{ marginTop: 1, flexShrink: 0 }}
                />
                <span style={{ font: `400 12px/1.5 ${font.ui}`, color: c.ink2 }}>
                  {t('survey.privacyNote')}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <Button variant="secondary" onClick={next} style={{ flex: 'none', width: 110 }}>
                  {t('common.skip')}
                </Button>
                <Button fullWidth disabled={!choice} onClick={next}>
                  {last ? t('common.submit') : t('common.next')}
                </Button>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
