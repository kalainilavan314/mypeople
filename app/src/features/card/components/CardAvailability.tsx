import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
export function CardAvailability({ onDismiss }: { onDismiss: () => void }) {
  const t = useWorkspaceText();
  return (
    <div className="mp-availability" role="status">
      {t(
        'Apple and Google Wallet support is not available yet. You can download a PDF copy.',
        'Apple மற்றும் Google Wallet இன்னும் கிடைக்கவில்லை. PDF நகலைப் பதிவிறக்கலாம்.',
      )}
      <button type="button" onClick={onDismiss}>
        {t('Dismiss', 'மூடு')}
      </button>
    </div>
  );
}
