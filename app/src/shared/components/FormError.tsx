import { c, font, radius } from '@/core/theme/tokens';
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      style={{
        marginTop: 16,
        padding: '11px 14px',
        background: c.errorBg,
        color: c.error,
        borderRadius: radius.md,
        font: `500 13px/1.4 ${font.ta}`,
      }}
    >
      {message}
    </div>
  );
}
