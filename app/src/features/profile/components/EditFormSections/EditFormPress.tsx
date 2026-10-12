import { c, font, radius } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import type { TFunction } from 'i18next';

type Props = {
  save: () => Promise<void>;
  saving: boolean;
  saved: boolean;
  t: TFunction<'translation', undefined>;
};
export function EditFormPress({ save, saving, saved, t }: Props) {
  return (
    <button
      onClick={save}
      disabled={saving || saved}
      className="press"
      style={{
        width: '100%',
        marginTop: 20,
        height: 52,
        border: 'none',
        cursor: 'pointer',
        borderRadius: radius.sm,
        background: saved ? c.success : c.maroon,
        boxShadow: 'none',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        font: `600 16px/1 ${font.ui}`,
      }}
    >
      {saved ? (
        <>
          <Icon name="check" size={18} color="#fff" strokeWidth={2.4} /> {t('common.saved')}
        </>
      ) : saving ? (
        t('common.loading')
      ) : (
        t('common.save')
      )}
    </button>
  );
}
