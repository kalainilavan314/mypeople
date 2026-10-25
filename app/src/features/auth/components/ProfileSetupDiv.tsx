import { BackChip } from '@/features/auth/components/parts';
import type { TFunction } from 'i18next';
import { useNavigate } from 'react-router-dom';

type Props = {
  navigate: ReturnType<typeof useNavigate>;
  t: TFunction<'translation', undefined>;
  cont: () => void;
  ready: string | false | null;
};
export function ProfileSetupDiv({ navigate, t, cont, ready }: Props) {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(14px + var(--safe-top, 0px)) 18px 8px',
      }}
    >
      <BackChip onClick={() => navigate('/signup')} />
      <h1
        style={{
          font: `800 17px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: '#14263D',
          margin: 0,
          letterSpacing: 'normal',
        }}
      >
        {t('profileSetup.title')}
      </h1>
      <button
        type="button"
        onClick={cont}
        disabled={!ready}
        style={{
          background: 'none',
          border: 'none',
          padding: '6px 8px',
          cursor: ready ? 'pointer' : 'default',
          font: `700 14.5px/1 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: ready ? '#14263D' : '#94A3B8',
          letterSpacing: 'normal',
        }}
      >
        {t('profileSetup.continue')}
      </button>
    </div>
  );
}
