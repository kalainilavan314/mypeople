import { useEffect, useState } from 'react';
import type { ServerMember } from '../data/authApi';
import { tierDef } from '../theme/tiers';
import { Icon } from './Icon';
import { useWorkspaceText } from './MemberWorkspace';

/** Native, reflowing membership presentation. Recognition tiers confer no staff permissions. */
export function DigitalMemberPass({member,onShowQr}:{member:ServerMember;onShowQr:()=>void}) {
  const t=useWorkspaceText(),tier=tierDef(member.tier);
  const [portraitFailed,setPortraitFailed]=useState(false);
  useEffect(()=>setPortraitFailed(false),[member.avatarUrl]);
  const verified=member.verificationStatus==='identity_confirmed';
  const identity=verified?t('Identity Verified','அடையாளம் சரிபார்க்கப்பட்டது'):member.verificationStatus==='review_pending'?t('Identity under review','அடையாளம் மதிப்பாய்வில்'):member.verificationStatus==='nic_format'?t('NIC format checked','அடையாள எண் வடிவம் சரிபார்க்கப்பட்டது'):t('Identity not verified','அடையாளம் சரிபார்க்கப்படவில்லை');
  const membership=member.membershipStatus==='active'?t('Active Member','செயலில் உள்ள உறுப்பினர்'):member.membershipStatus==='pending'?t('Membership pending','உறுப்பினர் பதிவு நிலுவையில்'):member.membershipStatus==='suspended'?t('Membership suspended','உறுப்பினர் பதிவு இடைநிறுத்தப்பட்டது'):member.membershipStatus==='inactive'?t('Membership inactive','உறுப்பினர் பதிவு செயலற்றது'):t('Membership status unavailable','உறுப்பினர் நிலை கிடைக்கவில்லை');
  const tone=verified&&member.membershipStatus==='active'?'verified':member.verificationStatus==='review_pending'||member.membershipStatus==='pending'?'pending':'neutral';
  const hierarchy=[member.districtName,member.dsName,member.gsName].filter(Boolean).join(' / ')||t('Area not assigned','பகுதி ஒதுக்கப்படவில்லை');
  return <section className="civic-pass" aria-label={t('Digital membership pass','டிஜிட்டல் உறுப்பினர் அட்டை')}>
    <div className="civic-pass-header"><span><span lang="en">MY PEOPLE</span> • <span lang="ta">என் மக்கள்</span></span><span className="civic-pass-tier" aria-label={t('Membership recognition tier','உறுப்பினர் அங்கீகார நிலை')+' '+tier.level}>TIER {tier.level}</span></div>
    <div className="civic-pass-identity"><span className="civic-pass-portrait">{member.avatarUrl&&!portraitFailed?<img src={member.avatarUrl} alt="" width={48} height={48} decoding="async" onError={()=>setPortraitFailed(true)}/>:<Icon name="user" size={24}/>}</span><div><div className="civic-pass-name">{member.fullName}</div><div className="civic-pass-id">{member.memberCode}</div><div className="civic-pass-area">{hierarchy}</div></div></div>
    <div className="civic-pass-bottom"><span className={'civic-pass-status civic-pass-status--'+tone}><Icon name={tone==='verified'?'check':tone==='pending'?'clock':'info'} size={14}/><span>{identity} • {membership}</span></span><button className="civic-pass-qr" type="button" onClick={onShowQr} aria-label={t('Open membership QR','உறுப்பினர் QR ஐத் திற')} aria-haspopup="dialog"><Icon name="idCard" size={22}/></button></div>
  </section>;
}
