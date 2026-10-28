import { font } from '@/core/theme/tokens';
import { Steps } from '@/features/auth/components/parts';
import type { TFunction } from 'i18next';

type Props = { step: number; total: number; t: TFunction<'translation', undefined> };

/** The survey is step 4 of sign-up; its questions are counted in words, not with a second track of numbered circles. */
export function QuestionsProgress({ step, total, t }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}
    >
      <Steps step={3} total={4} />
      <span style={{ font: `600 14px/1.3 ${font.ui}`, color: '#334155' }}>
        {t('questions.progress', { n: step + 1, total })}
      </span>
    </div>
  );
}
