import { radius } from '@/core/theme/tokens';
import { BackChip } from '@/features/auth/components/parts';
import { QuestionsDiv } from '@/features/auth/components/QuestionsDiv';
import { QuestionsDiv2 } from '@/features/auth/components/QuestionsDiv2';
import type { SurveyQuestion } from '@/features/auth/Questions.model';
import { Icon } from '@/shared/components/Icon';
import type { i18n, TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';

type Props = {
  step: number;
  navigate: ReturnType<typeof useNavigate>;
  goBack: (to: number) => void;
  finish: (finalAnswers: Record<string, string>) => Promise<void>;
  answers: Record<string, string>;
  t: TFunction<'translation', undefined>;
  total: number;
  q: SurveyQuestion;
  selectedVal: string;
  i18n: i18n;
  choose: (val: string) => void;
  error: string | null;
  advance: () => void;
  busy: boolean;
  isLast: boolean;
};
export function QuestionsQuestionCardContainer({
  step,
  navigate,
  goBack,
  finish,
  answers,
  t,
  total,
  q,
  selectedVal,
  i18n,
  choose,
  error,
  advance,
  busy,
  isLast,
}: Props) {
  return (
    <div className="question-card-container">
      <img src="/signup-bg.png" alt="" className="question-bottom-art" aria-hidden="true" />

      <div className="question-content">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <BackChip onClick={() => (step === 0 ? navigate('/signup/profile') : goBack(step - 1))} />
          <button
            type="button"
            onClick={() => void finish(answers)}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px 8px',
              cursor: 'pointer',
              font: `700 14px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#14263D',
              letterSpacing: 'normal',
            }}
          >
            {t('questions.skipSurvey', 'கணிப்பைத் தவிர்')}
          </button>
        </div>

        <QuestionsDiv2 step={step} total={total} />

        <div style={{ marginBottom: 12 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: radius.pill,
              font: `700 12.5px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
              color: '#1D4ED8',
              letterSpacing: 'normal',
            }}
          >
            <Icon name="users" size={14} color="#1D4ED8" strokeWidth={2.4} />
            <span>{t('survey.joiningSurvey', 'இணைவுக் கணிப்பு')}</span>
          </span>
        </div>

        <h1
          style={{
            font: `900 27px/1.25 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#14263D',
            margin: '0 0 10px',
            letterSpacing: 'normal',
          }}
        >
          {t(`survey.q.${q.id}`)}
        </h1>
        <p
          style={{
            font: `500 13.5px/1.55 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#475569',
            margin: 0,
            letterSpacing: 'normal',
          }}
        >
          {t('survey.privacyNote')}
        </p>

        <QuestionsDiv q={q} selectedVal={selectedVal} i18n={i18n} choose={choose} t={t} />

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: '10px 12px',
              borderRadius: 10,
              background: '#FEF2F2',
              color: '#DC2626',
              font: `500 12.5px/1.4 var(--font-ta, sans-serif)`,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 32 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackChip onClick={() => goBack(step - 1)} />
        </div>

        <button
          type="button"
          onClick={advance}
          disabled={busy}
          style={{
            margin: '14px auto 0',
            background: 'none',
            border: 'none',
            cursor: busy ? 'default' : 'pointer',
            font: `500 13px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
            color: '#64748B',
            letterSpacing: 'normal',
          }}
        >
          {isLast
            ? t('questions.finishWithout', 'பதிலளிக்காமல் முடிக்கவும்')
            : t('questions.skipQuestion', 'இந்தக் கேள்வியைத் தவிர்')}
        </button>
      </div>
    </div>
  );
}
