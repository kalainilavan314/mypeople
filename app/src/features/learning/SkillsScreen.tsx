import { useSkills, useToggleSkill } from '@/core/api/queries';
import { pick } from '@/core/i18n';
import { c, font, radius } from '@/core/theme/tokens';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { Button, Chip, QueryBoundary, Toggle } from '@/shared/components/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Skills() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const skillsQ = useSkills();
  const toggle = useToggleSkill();
  const [avail, setAvail] = useState({ weekends: true, vehicle: false, emergency: true });

  return (
    <div>
      <ScreenHeader titleTa={t('profile.skills')} titleEn="Skills registry" />
      <div style={{ padding: '16px 16px 28px' }}>
        <div style={{ font: `600 13px/1 ${font.ta}`, color: c.ink2, marginBottom: 12 }}>
          {t('skills.sectionSkills')}
        </div>
        <QueryBoundary query={skillsQ}>
          {(skills) => (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {skills.map((s) => (
                <Chip
                  key={s.id}
                  label={pick(lang, s.nameTa, s.nameEn)}
                  active={s.selected}
                  onClick={() => toggle.mutate(s.id)}
                />
              ))}
            </div>
          )}
        </QueryBoundary>

        <div style={{ font: `600 13px/1 ${font.ta}`, color: c.ink2, margin: '26px 0 12px' }}>
          {t('skills.sectionAvailability')}
        </div>
        <div
          style={{
            background: c.card,
            border: `1px solid ${c.hairline}`,
            borderRadius: radius.lg,
            overflow: 'hidden',
          }}
        >
          <AvailRow
            ta="வார இறுதிகள்"
            en="Weekends"
            on={avail.weekends}
            onChange={(v) => setAvail((a) => ({ ...a, weekends: v }))}
          />
          <AvailRow
            ta="வாகனம் உண்டு"
            en="Have a vehicle"
            on={avail.vehicle}
            onChange={(v) => setAvail((a) => ({ ...a, vehicle: v }))}
            border
          />
          <AvailRow
            ta="அவசர உதவி"
            en="Emergency response"
            on={avail.emergency}
            onChange={(v) => setAvail((a) => ({ ...a, emergency: v }))}
            border
          />
        </div>

        <div style={{ marginTop: 22 }}>
          <Button fullWidth onClick={() => navigate('/profile')}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AvailRow({
  ta,
  en,
  on,
  onChange,
  border,
}: {
  ta: string;
  en: string;
  on: boolean;
  onChange: (v: boolean) => void;
  border?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        borderTop: border ? `1px solid ${c.hairline}` : 'none',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ font: `600 14px/1.3 ${font.ta}`, color: c.ink }}>{ta}</div>
        <div style={{ font: `400 12px/1.3 ${font.ui}`, color: c.ink3 }}>{en}</div>
      </div>
      <Toggle on={on} onChange={onChange} ariaLabel={en} />
    </div>
  );
}
