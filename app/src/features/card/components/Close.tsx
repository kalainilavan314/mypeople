import '@/core/theme/membership-card.css';
import { Text } from '@/features/card/Card.model';
import { Icon } from '@/shared/components/Icon';
export function Close({ onClose, t }: { onClose: () => void; t: Text }) {
  return (
    <button className="mp-close" type="button" onClick={onClose} aria-label={t('Close', 'மூடு')}>
      <Icon name="x" size={20} />
    </button>
  );
}
