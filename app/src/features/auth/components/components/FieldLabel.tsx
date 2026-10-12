export function FieldLabel({ ta }: { ta: string; en?: string }) {
  return (
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          font: `700 13.5px/1.2 var(--font-ta, 'Noto Sans Tamil', sans-serif)`,
          color: '#1E293B',
        }}
      >
        {ta}
      </span>
    </div>
  );
}
