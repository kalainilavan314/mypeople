import { gsByCode } from '@/core/api/divisions';
import {
  WorkspaceLink,
  WorkspaceTitle,
  useWorkspaceText,
} from '@/shared/components/MemberWorkspace';
import { useMe } from '@/shared/hooks/useMe';
export function MyArea() {
  const me = useMe(),
    t = useWorkspaceText(),
    area = me?.gsCode ? gsByCode(me.gsCode) : undefined;
  return (
    <main className="workspace">
      <WorkspaceTitle
        title={t('My Area', 'எனது பகுதி')}
        detail={t(
          'Your membership connection within Northern Province.',
          'வட மாகாணத்தில் உங்கள் உறுப்பினர் இணைப்பு.',
        )}
      />
      <section className="work-panel work-details">
        <span className="work-eyebrow">{t('ADMINISTRATIVE AREA', 'நிர்வாகப் பகுதி')}</span>
        <dl>
          {[
            [t('Province', 'மாகாணம்'), t('Northern Province', 'வட மாகாணம்')],
            [t('District', 'மாவட்டம்'), me?.districtName],
            [t('DS division', 'பிரதேச செயலாளர் பிரிவு'), me?.dsName],
            [t('GN division', 'கிராம அலுவலர் பிரிவு'), me?.gsName],
            [t('GN reference', 'பிரிவு இலக்கம்'), area?.gs.ref],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="work-section">
        <h2>{t('Participate locally', 'உள்ளூரில் பங்கேற்கவும்')}</h2>
        <div className="work-panel">
          <WorkspaceLink
            to="/events"
            icon="calendar"
            title={t('Browse activities', 'நிகழ்வுகளைப் பார்க்கவும்')}
          />
          <WorkspaceLink
            to="/reports"
            icon="report"
            title={t('Report a community issue', 'சமூகப் பிரச்சினையைப் பதிவு செய்யவும்')}
          />
          <WorkspaceLink
            to="/profile/edit"
            icon="user"
            title={t('Update my location', 'எனது இருப்பிடத்தை மாற்றவும்')}
          />
        </div>
      </section>
      <p className="work-note">
        {t(
          'This is your registered area. Area-wide member counts and performance scores are not yet available.',
          'பதிவு செய்யப்பட்ட பகுதி இங்கே காட்டப்படுகிறது. பகுதி முழுவதற்குமான எண்ணிக்கைகள் இன்னும் கிடைக்கவில்லை.',
        )}
      </p>
    </main>
  );
}
