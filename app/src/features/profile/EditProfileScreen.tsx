import { c, font } from '@/core/theme/tokens';
import { EditForm } from '@/features/profile/components/EditForm';
import { useMe } from '@/shared/hooks/useMe';
export function EditProfile() {
  const me = useMe();
  if (!me) {
    return (
      <div
        style={{ padding: 40, textAlign: 'center', font: `500 14px/1.4 ${font.ui}`, color: c.ink2 }}
      >
        …
      </div>
    );
  }
  return <EditForm key={me.id} me={me} />;
}
