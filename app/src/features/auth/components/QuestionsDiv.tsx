import type { SurveyQuestion } from '@/features/auth/Questions.model';
import { Icon } from '@/shared/components/Icon';
import type { i18n, TFunction } from 'i18next';

type Props = {
  q: SurveyQuestion;
  selectedVal: string;
  i18n: i18n;
  choose: (val: string) => void;
  t: TFunction<'translation', undefined>;
};
export function QuestionsDiv({ q, selectedVal, i18n, choose, t }: Props) {
  return (
    <div style={{ marginTop: 24 }}>
      {q.layout === 'pair' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {q.options.map((val, idx) => {
            const active = selectedVal === val;
            const isTa = i18n.language === 'ta';
            return (
              <button
                key={val}
                type="button"
                onClick={() => choose(val)}
                className={`question-stacked-card ${active ? 'active' : ''}`}
                aria-pressed={active}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className={`question-key-chip ${active ? 'active' : ''}`}>
                    {idx === 0 ? 'A' : 'B'}
                  </span>
                  <span
                    style={{
                      font: `700 17px/1.2 ${isTa ? 'var(--font-ta, sans-serif)' : 'var(--font-ui, sans-serif)'}`,
                      color: '#0F172A',
                    }}
                  >
                    {t(`survey.opt.${val}`)}
                  </span>
                </div>

                <div className={`question-check-circle ${active ? 'active' : ''}`}>
                  {active && <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} />}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {q.options.map((val) => {
            const active = selectedVal === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => choose(val)}
                className={`question-blood-card ${active ? 'active' : ''}`}
                aria-pressed={active}
              >
                <span style={{ font: `800 16px/1 var(--font-ui, sans-serif)` }}>{val}</span>
                <Icon
                  name="droplet"
                  size={14}
                  color={active ? '#FFFFFF' : '#94A3B8'}
                  strokeWidth={2}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
