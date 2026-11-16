import { font, radius } from '@/core/theme/tokens';
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
            disabled={busy}
            style={{
              minHeight: 44,
              background: 'none',
              border: 'none',
              padding: '6px 8px',
              cursor: busy ? 'default' : 'pointer',
              font: `700 15px/1.2 ${font.ui}`,
              color: 'var(--primary)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {t('questions.skipSurvey')}
          </button>
        </div>

        <QuestionsDiv2 step={step} total={total} t={t} />

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
              font: `700 13px/1.2 ${font.ui}`,
              color: 'var(--primary)',
            }}
          >
            <Icon name="users" size={14} color="var(--primary)" strokeWidth={2.4} />
            <span>{t('survey.joiningSurvey')}</span>
          </span>
        </div>

        <h1
          style={{
            font: `800 24px/1.3 ${font.ui}`,
            color: 'var(--primary)',
            margin: '0 0 10px',
          }}
        >
          {t(`survey.q.${q.id}`)}
        </h1>
        <p
          style={{
            font: `400 15px/1.6 ${font.ui}`,
            color: '#475569',
            margin: 0,
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
              font: `500 14px/1.5 ${font.ui}`,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 32 }} />

        {/* One button moves on, and its words say what happens to the answer on screen. */}
        <button
          type="button"
          onClick={advance}
          disabled={busy}
          aria-busy={busy}
          className={selectedVal ? 'question-next question-next--answered' : 'question-next'}
        >
          {busy
            ? t('questions.creating')
            : isLast
              ? selectedVal
                ? t('questions.finish')
                : t('questions.finishWithout')
              : selectedVal
                ? t('questions.next')
                : t('questions.skipQuestion')}
        </button>
      </div>
    </div>
  );
}
