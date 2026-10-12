import { authApi } from '@/core/api/authApi';
import { useBadges } from '@/core/api/queries';
import '@/core/theme/membership-card.css';
import { tierDef } from '@/core/theme/tiers';
import { Action } from '@/features/card/components/Action';
import { CardMpSection } from '@/features/card/components/CardMpSection';
import { CardMpSection2 } from '@/features/card/components/CardMpSection2';
import { CardMpSection3 } from '@/features/card/components/CardMpSection3';
import { CardViewer } from '@/features/card/components/CardViewer';
import {
  ScaledMembershipCredential,
  type MembershipCredentialData,
} from '@/features/card/components/MembershipCredential';
import { QrDialog } from '@/features/card/components/QrDialog';
import { ShareDialog } from '@/features/card/components/ShareDialog';
import { Icon } from '@/shared/components/Icon';
import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { QueryBoundary } from '@/shared/components/ui';
import { useMeQuery } from '@/shared/hooks/useMe';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CardAvailability } from './components/CardAvailability';
import { useCardActions } from './useCardActions';
export function Card() {
  const meQ = useMeQuery(),
    badgesQ = useBadges(),
    t = useWorkspaceText();
  const navigate = useNavigate(),
    location = useLocation(),
    [params] = useSearchParams();
  const [showQr, setShowQr] = useState(params.get('qr') === '1');
  const [viewer, setViewer] = useState(false),
    [wallet, setWallet] = useState(false),
    [share, setShare] = useState(false);
  const { cardHost, pdfBusy, feedback, downloadPdf, copyReferral } = useCardActions();
  useEffect(() => {
    if (params.get('qr') === '1') setShowQr(true);
  }, [params, location.key]);
  const token = useQuery({
    queryKey: ['cardToken'],
    queryFn: () => authApi.cardToken(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 8 * 60 * 1000,
  });

  return (
    <main className="membership-page">
      <QueryBoundary query={meQ}>
        {(me) => {
          if (!me)
            return (
              <section className="mp-section">
                <h1>
                  {t('Membership information unavailable', 'உறுப்பினர் விவரங்கள் கிடைக்கவில்லை')}
                </h1>
                <Link to="/login">{t('Sign in again', 'மீண்டும் உள்நுழையுங்கள்')}</Link>
              </section>
            );
          const confirmed = me.verificationStatus === 'identity_confirmed',
            active = me.membershipStatus === 'active';
          const verification = confirmed
            ? active
              ? t('Verified Member', 'சரிபார்க்கப்பட்ட உறுப்பினர்')
              : t('Identity verified', 'அடையாளம் சரிபார்க்கப்பட்டது')
            : me.verificationStatus === 'review_pending'
              ? t('Under review', 'மதிப்பாய்வில்')
              : me.verificationStatus === 'nic_format'
                ? t('NIC format checked', 'அடையாள எண் வடிவம் சரிபார்க்கப்பட்டது')
                : t('Not verified', 'சரிபார்க்கப்படவில்லை');
          const joined = new Date(me.joinedAt),
            memberSince = Number.isNaN(joined.getTime())
              ? '—'
              : joined.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Asia/Colombo',
                });
          const tier = tierDef(me.tier),
            prog = me.tierProgress;
          const data: MembershipCredentialData = {
            name: me.fullName,
            memberId: me.memberCode,
            district: me.districtName || '—',
            gsDivision: me.gsName || '—',
            memberSince,
            membershipType: t(tier.nameEn, tier.nameTa),
            referralId: me.referralCode || '—',
            verified: confirmed,
            verificationLabel: verification,
            avatarUrl: me.avatarUrl,
            qrValue: token.data,
          };
          const status =
            me.membershipStatus === 'active'
              ? t('Active', 'செயலில்')
              : me.membershipStatus === 'suspended'
                ? t('Suspended', 'இடைநிறுத்தப்பட்டது')
                : me.membershipStatus === 'inactive'
                  ? t('Inactive', 'செயலற்றது')
                  : t('Pending', 'நிலுவையில்');
          return (
            <>
              <header className="mp-header">
                <div>
                  <h1>{t('My Membership Card', 'எனது உறுப்பினர் அட்டை')}</h1>
                  <p>{t('Your community membership', 'உங்கள் சமூக உறுப்பினர் பதிவு')}</p>
                </div>
                <button
                  className="mp-close"
                  type="button"
                  onClick={() => navigate('/profile')}
                  aria-label={t('More options', 'மேலும் விருப்பங்கள்')}
                >
                  <Icon name="menu" size={20} />
                </button>
              </header>
              <figure className="mp-card-figure">
                <div className="mp-preview-stage" ref={cardHost}>
                  <ScaledMembershipCredential data={data} />
                  <button
                    className="mp-open-card"
                    type="button"
                    aria-label={t(
                      'Open enlarged membership card',
                      'பெரிதாக்கப்பட்ட உறுப்பினர் அட்டையைத் திற',
                    )}
                    aria-haspopup="dialog"
                    onClick={() => setViewer(true)}
                  />
                </div>
                <figcaption>
                  <Icon name="eye" size={14} />
                  {t('Tap your card to enlarge', 'அட்டையைப் பெரிதாக்கத் தட்டவும்')}
                </figcaption>
              </figure>
              <div className="mp-actions" aria-label={t('Card actions', 'அட்டைச் செயல்கள்')}>
                <Action
                  icon="idCard"
                  label={t('View QR', 'QR பார்க்க')}
                  onClick={() => setShowQr(true)}
                  active={showQr}
                />
                <Action
                  icon="download"
                  label={
                    pdfBusy
                      ? t('Preparing PDF…', 'PDF தயாராகிறது…')
                      : t('Download PDF', 'PDF பதிவிறக்கம்')
                  }
                  onClick={() => void downloadPdf()}
                  disabled={pdfBusy}
                />
                <Action
                  icon="card"
                  label={t('Add to Wallet', 'வாலட்டில் சேர்')}
                  onClick={() => setWallet(true)}
                />
                <Action icon="share" label={t('Share', 'பகிர்')} onClick={() => setShare(true)} />
              </div>
              {feedback && (
                <p className="mp-feedback" role="status">
                  {feedback}
                </p>
              )}
              {wallet && <CardAvailability onDismiss={() => setWallet(false)} />}
              <CardMpSection
                t={t}
                navigate={navigate}
                me={me}
                memberSince={memberSince}
                tier={tier}
                verification={verification}
                status={status}
                copyReferral={copyReferral}
              />
              {prog && <CardMpSection3 t={t} navigate={navigate} prog={prog} />}
              <CardMpSection2 t={t} navigate={navigate} badgesQ={badgesQ} me={me} />
              {viewer && <CardViewer data={data} onClose={() => setViewer(false)} t={t} />}
              {showQr && (
                <QrDialog
                  value={token.data}
                  pending={token.isPending}
                  name={me.fullName}
                  code={me.memberCode}
                  onRetry={() => void token.refetch()}
                  onClose={() => setShowQr(false)}
                  t={t}
                />
              )}
              {share && <ShareDialog data={data} onClose={() => setShare(false)} t={t} />}
            </>
          );
        }}
      </QueryBoundary>
    </main>
  );
}
