import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { useWorkspaceText } from './MemberWorkspace';

/**
 * Fixed top bar for the Home screen: a centred brand mark with two icon actions
 * on each side (Notifications · Language | Invite · Menu). Sticky so it stays
 * put while Home scrolls. The Menu button opens a sheet of the secondary
 * destinations that are not on the bottom navigation.
 */
export function HomeTopBar() {
  const navigate = useNavigate();
  const t = useWorkspaceText();
  const [menu, setMenu] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (menu) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [menu]);

  const go = (to: string) => {
    setMenu(false);
    navigate(to);
  };

  const iconBtn = (name: IconName, label: string, onClick: () => void, ref?: React.Ref<HTMLButtonElement>) => (
    <button ref={ref} type="button" className="topbar-btn" onClick={onClick} aria-label={label}>
      <Icon name={name} size={20} />
    </button>
  );

  const more: [string, IconName, string][] = [
    ['/community', 'users', t('Community hub', 'சமூக மையம்')],
    ['/area', 'mapPin', t('My Area', 'எனது பகுதி')],
    ['/reports', 'report', t('Community reports', 'சமூக அறிக்கைகள்')],
    ['/skills', 'handHeart', t('Volunteer skills', 'தன்னார்வத் திறன்கள்')],
    ['/fund', 'heart', t('Party Fund', 'கட்சி நிதி')],
    ['/ideas', 'bulb', t('Community ideas', 'சமூகக் கருத்துகள்')],
    ['/survey', 'clipboard', t('Surveys', 'கருத்துக்கணிப்புகள்')],
    ['/courses', 'book', t('Learning', 'கற்றல்')],
    ['/milestones', 'star', t('Milestones', 'மைல்கற்கள்')],
    ['/privacy', 'lock', t('Privacy & help', 'தனியுரிமை & உதவி')],
  ];

  return (
    <>
      <header className="home-topbar">
        <div className="topbar-group">
          {iconBtn('bell', t('Notifications', 'அறிவிப்புகள்'), () => navigate('/notifications'))}
          {iconBtn('globe', t('Language', 'மொழி'), () => navigate('/language'))}
        </div>

        <button type="button" className="topbar-logo" onClick={() => navigate('/')} aria-label={t('My People home', 'என் மக்கள் முகப்பு')}>
          <Logo size={30} style={{ borderRadius: 8 }} />
          <span className="topbar-word">
            <span className="ta">என் மக்கள்</span>
            <span>My People</span>
          </span>
        </button>

        <div className="topbar-group">
          {iconBtn('users', t('Invite a member', 'உறுப்பினரை அழைக்கவும்'), () => navigate('/referral'))}
          {iconBtn('menu', t('More', 'மேலும்'), () => setMenu(true), trigger)}
        </div>
      </header>

      <dialog
        className="topbar-sheet"
        ref={dialog}
        aria-labelledby="topbar-more-title"
        onCancel={() => setMenu(false)}
        onClose={() => { setMenu(false); trigger.current?.focus(); }}
        onClick={(e) => { if (e.target === e.currentTarget) setMenu(false); }}
      >
        <div className="topbar-sheet-head">
          <h2 id="topbar-more-title">{t('Explore more', 'மேலும் பார்க்க')}</h2>
          <button autoFocus type="button" className="topbar-btn" onClick={() => setMenu(false)} aria-label={t('Close', 'மூடு')}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="topbar-sheet-list">
          {more.map(([to, icon, label]) => (
            <button type="button" key={to} className="topbar-sheet-item" onClick={() => go(to)}>
              <span className="topbar-sheet-icon"><Icon name={icon} size={20} /></span>
              <span>{label}</span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
      </dialog>
    </>
  );
}
