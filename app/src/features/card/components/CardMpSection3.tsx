import type { TierProgress } from '@/core/api/auth/models';
import '@/core/theme/membership-card.css';
import { tierDef } from '@/core/theme/tiers';
import { Icon } from '@/shared/components/Icon';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { useNavigate } from 'react-router-dom';

type Props = {
  t: ReturnType<typeof useWorkspaceText>;
  navigate: ReturnType<typeof useNavigate>;
  prog: TierProgress;
};
export function CardMpSection3({ t, navigate, prog }: Props) {
  return (
    <section className="mp-section">
      <div className="mp-section-heading">
        <h2>{t('Community progress', 'சமூகப் பங்களிப்பு முன்னேற்றம்')}</h2>
        <button type="button" onClick={() => navigate('/referral')}>
          {prog.next
            ? t('View referrals', 'அழைப்புகளைப் பார்')
            : t('Membership recognition', 'உறுப்பினர் அங்கீகாரம்')}
          <Icon name="chevron" size={16} />
        </button>
      </div>
      {prog.next && prog.need ? (
        <>
          <p className="mp-note">
            {Math.max(0, prog.need - prog.have)} {t('more to', 'மேலும்')}{' '}
            {t(tierDef(prog.next).nameEn, tierDef(prog.next).nameTa)}
          </p>
          <div
            className="mp-progress"
            role="progressbar"
            aria-label={t('Community progress', 'சமூகப் பங்களிப்பு முன்னேற்றம்')}
            aria-valuemin={0}
            aria-valuemax={prog.need}
            aria-valuenow={Math.min(prog.need, Math.max(0, prog.have))}
          >
            <span style={{ width: Math.min(100, Math.max(0, prog.pct)) + '%' }} />
          </div>
          <p className="mp-progress-caption">
            {prog.have} / {prog.need} {t('recruits', 'அழைப்புகள்')}
          </p>
        </>
      ) : (
        <p className="mp-note">
          {t(
            'Highest membership recognition reached.',
            'உயர்ந்த உறுப்பினர் அங்கீகாரத்தை அடைந்துள்ளீர்கள்.',
          )}
        </p>
      )}
      <p className="mp-note">
        {t(
          'Community recognition is separate from assigned organisational responsibilities.',
          'சமூக அங்கீகாரமும் ஒதுக்கப்பட்ட அமைப்புப் பொறுப்புகளும் தனித்தனியானவை.',
        )}
      </p>
    </section>
  );
}
