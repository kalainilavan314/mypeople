import type { TFunction } from 'i18next';
import { Lock as LucideLock, Users as LucideUsers, ShieldCheck } from 'lucide-react';

type Props = { t: TFunction<'translation', undefined> };
export function LoginDiv({ t }: Props) {
  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        paddingBottom: 2,
        borderTop: '1px solid rgba(20, 38, 61, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <div
        title={t('auth.trustSecureTitle', 'பாதுகாப்பானது')}
        aria-label={t('auth.trustSecureTitle', 'பாதுகாப்பானது')}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#F1F5F9',
          border: '1px solid #E2E8F0',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 2px 6px rgba(20, 38, 61, 0.04)',
          transition: 'transform 0.15s ease',
        }}
      >
        <ShieldCheck size={19} strokeWidth={2.2} color="#3B5270" />
      </div>

      <div
        style={{
          width: 1,
          height: 20,
          background: 'rgba(20, 38, 61, 0.12)',
          borderRadius: 1,
        }}
        aria-hidden="true"
      />

      <div
        title={t('auth.trustPrivateTitle', 'தனிப்பட்டது')}
        aria-label={t('auth.trustPrivateTitle', 'தனிப்பட்டது')}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#F1F5F9',
          border: '1px solid #E2E8F0',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 2px 6px rgba(20, 38, 61, 0.04)',
          transition: 'transform 0.15s ease',
        }}
      >
        <LucideLock size={17} strokeWidth={2.2} color="#3B5270" />
      </div>

      <div
        style={{
          width: 1,
          height: 20,
          background: 'rgba(20, 38, 61, 0.12)',
          borderRadius: 1,
        }}
        aria-hidden="true"
      />

      <div
        title={t('auth.trustCommunityTitle', 'சமூக முன்னுரிமை')}
        aria-label={t('auth.trustCommunityTitle', 'சமூக முன்னுரிமை')}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#F1F5F9',
          border: '1px solid #E2E8F0',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 2px 6px rgba(20, 38, 61, 0.04)',
          transition: 'transform 0.15s ease',
        }}
      >
        <LucideUsers size={18} strokeWidth={2.2} color="#3B5270" />
      </div>
    </div>
  );
}
