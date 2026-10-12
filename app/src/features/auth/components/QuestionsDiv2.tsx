type Props = { step: number; total: number };
export function QuestionsDiv2({ step, total }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}
    >
      <span style={{ font: `700 14px/1 var(--font-ui, sans-serif)`, color: '#14263D' }}>
        {step + 1}/{total}
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {Array.from({ length: total }, (_, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: active ? '#14263D' : done ? '#2563EB' : '#F1F5F9',
                  color: active || done ? '#ffffff' : '#64748B',
                  font: '700 11px/22px var(--font-ui, sans-serif)',
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                  transition: 'all 200ms ease',
                }}
              >
                {i + 1}
              </span>
              {i < total - 1 && (
                <span
                  style={{
                    width: 14,
                    height: 1.5,
                    background: done ? '#2563EB' : '#E2E8F0',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
