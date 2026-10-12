import { c, font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { useNavigate } from 'react-router-dom';

interface Props {
  titleTa: string;
  titleEn?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export function ScreenHeader({ titleTa, titleEn, onBack, right }: Props) {
  const navigate = useNavigate();
  const back = onBack ?? (() => navigate(-1));
  return (
    <header
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '12px 12px',
        background: c.page,
        borderBottom: `1px solid ${c.hairline}`,
      }}
    >
      <button
        onClick={back}
        aria-label="Back"
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          border: 'none',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flex: 'none',
        }}
      >
        <Icon name="chevronLeft" size={24} color={c.ink} strokeWidth={2.1} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `600 16px/1.25 ${font.ta}`, color: c.ink }}>{titleTa}</div>
        {titleEn && <div style={{ font: `400 11px/1.2 ${font.ui}`, color: c.ink3 }}>{titleEn}</div>}
      </div>
      {right}
    </header>
  );
}
