import { CREDENTIAL_HEIGHT } from '@/features/card/components/MembershipCredentialModel/CREDENTIAL_HEIGHT';
import { CREDENTIAL_WIDTH } from '@/features/card/components/MembershipCredentialModel/CREDENTIAL_WIDTH';
import { MembershipCredentialData } from '@/features/card/components/MembershipCredentialModel/MembershipCredentialData';
import { PalmyraMark } from '@/features/card/components/PalmyraMark';
import { CredentialQr } from '@/features/card/components/components/CredentialQr';
import { FitText } from '@/features/card/components/components/FitText';
import { Guilloche } from '@/features/card/components/components/Guilloche';
import { Icon } from '@/shared/components/Icon';
import { Logo } from '@/shared/components/Logo';
import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-tamil/900.css';
import { useEffect, useState } from 'react';
export function MembershipCredential({ data }: { data: MembershipCredentialData }) {
  const [portraitFailed, setPortraitFailed] = useState(false),
    [signatureFailed, setSignatureFailed] = useState(false);
  useEffect(() => setPortraitFailed(false), [data.avatarUrl]);
  useEffect(() => setSignatureFailed(false), [data.signatureUrl]);
  return (
    <article
      lang="en"
      className="membership-credential"
      style={{ width: CREDENTIAL_WIDTH, height: CREDENTIAL_HEIGHT }}
      aria-label="My People membership credential"
    >
      <Guilloche />
      <div className="credential-motto">
        PEOPLE&nbsp; • &nbsp;COMMUNITY&nbsp; • &nbsp;A BRIGHTER NORTHERN PROVINCE
      </div>
      <div className="credential-service">
        SERVICE TODAY
        <br />
        STRONGER TOMORROW
      </div>
      <div className="credential-portrait">
        {data.avatarUrl && !portraitFailed ? (
          <img
            src={data.avatarUrl}
            alt={'Portrait of ' + data.name}
            onError={() => setPortraitFailed(true)}
          />
        ) : (
          <div className="credential-portrait-missing">
            <Icon name="user" size={74} />
            <span>
              Member portrait
              <br />
              not provided
            </span>
          </div>
        )}
      </div>
      <div className="credential-signature">
        {data.signatureUrl && !signatureFailed ? (
          <img
            src={data.signatureUrl}
            alt="Authorized e-signature"
            onError={() => setSignatureFailed(true)}
          />
        ) : (
          <span className="credential-signature-missing">Signature not provided</span>
        )}
        <div className="credential-signature-rule" />
        <span>Authorized e-signature</span>
        <small>My People – Northern Province</small>
      </div>
      <div className="credential-brand">
        <div className="credential-tamil" lang="ta">
          என் மக்கள்
        </div>
        <div className="credential-english">MY PEOPLE</div>
        <div className="credential-brand-rule" />
        <div className="credential-subtitle">Northern Province Community Membership</div>
      </div>
      <div className="credential-name">
        <div className="credential-label">MEMBER NAME</div>
        <FitText max={44} min={18} className="credential-name-value">
          {data.name}
        </FitText>
      </div>
      <dl className="credential-fields-left">
        <div className="credential-field credential-field--id" data-card-field="member-id">
          <dt>MEMBER ID</dt>
          <dd>
            <FitText max={22}>{data.memberId}</FitText>
          </dd>
        </div>
        <div className="credential-field credential-field--district" data-card-field="district">
          <dt>DISTRICT</dt>
          <dd>
            <FitText max={22}>{data.district}</FitText>
          </dd>
        </div>
        <div className="credential-field credential-field--since" data-card-field="member-since">
          <dt>MEMBER SINCE</dt>
          <dd>
            <FitText max={21}>{data.memberSince}</FitText>
          </dd>
        </div>
      </dl>
      <div className="credential-column-rule" />
      <dl className="credential-fields-right">
        <div className="credential-field credential-field--type" data-card-field="membership-type">
          <dt>MEMBERSHIP TYPE</dt>
          <dd>
            <span className="credential-type">
              <Icon name="star" size={17} fill="#fff" />
              <span>{data.membershipType}</span>
            </span>
          </dd>
        </div>
        <div className="credential-field credential-field--gs" data-card-field="gs-division">
          <dt>GS DIVISION</dt>
          <dd>
            <FitText max={20} min={13}>
              {data.gsDivision}
            </FitText>
          </dd>
        </div>
        <div
          className="credential-field credential-field--verification"
          data-card-field="verification"
        >
          <dt>VERIFICATION</dt>
          <dd className={data.verified ? 'credential-verified' : 'credential-pending'}>
            <Icon name={data.verified ? 'checkCircle' : 'clock'} size={24} />
            <FitText max={20} min={13}>
              {data.verificationLabel}
            </FitText>
          </dd>
        </div>
        <div className="credential-field credential-field--referral" data-card-field="referral">
          <dt>REFERRAL ID</dt>
          <dd>
            <FitText max={22}>{data.referralId}</FitText>
          </dd>
        </div>
      </dl>
      <div className="credential-official">
        <Logo size={112} />
        <strong lang="ta">என் மக்கள்</strong>
        <span>MY PEOPLE</span>
        <small>NORTHERN PROVINCE</small>
      </div>
      <div className="credential-watermark" aria-hidden="true">
        <svg viewBox="0 0 130 220" className="credential-map">
          <path
            d="M34 3L48 7 52 16 62 17 66 27 78 31 79 43 87 50 89 62 97 74 97 88 105 102 109 117 117 132 120 152 114 175 104 194 84 207 64 215 47 210 31 194 22 177 18 158 15 142 9 130 6 114 3 95 11 81 8 70 13 58 18 50 14 36 23 33 18 21 29 20 26 11Z"
            fill="currentColor"
          />
        </svg>
        <PalmyraMark size={110} />
        <div>
          PEOPLE
          <br />
          PLACES
          <br />
          POTENTIAL
          <br />
          PROGRESS
        </div>
      </div>
      <div className="credential-qr-panel">
        {data.qrValue ? (
          <CredentialQr value={data.qrValue} />
        ) : (
          <div className="credential-qr-unavailable">
            <Icon name="idCard" size={34} />
            <span>QR unavailable</span>
          </div>
        )}
        <span>SCAN TO VERIFY</span>
      </div>
      <div className="credential-footer">
        <span>
          A STRONGER NORTHERN PROVINCE
          <br />
          THROUGH ITS PEOPLE
        </span>
        <small>UNITY&nbsp; | &nbsp;OPPORTUNITY&nbsp; | &nbsp;RESPONSIBILITY</small>
      </div>
    </article>
  );
}
