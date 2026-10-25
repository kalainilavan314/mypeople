import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  HandHeart,
  Heart,
  Images,
  Lightbulb,
  MapPin,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
type Service = {
  to: string;
  icon: LucideIcon;
  en: string;
  ta: string;
  image?: string;
  captionEn?: string;
  captionTa?: string;
};
const quick: Service[] = [
  { to: '/skills', icon: HandHeart, en: 'Volunteer', ta: 'தன்னார்வம்' },
  { to: '/survey', icon: ClipboardList, en: 'Surveys', ta: 'கருத்துக்கணிப்புகள்' },
  { to: '/reports', icon: FileText, en: 'Report issue', ta: 'பிரச்சினை பதிவு' },
  { to: '/community', icon: UsersRound, en: 'Community', ta: 'சமூகம்' },
];
const more: Service[] = [
  {
    to: '/fund',
    icon: Heart,
    en: 'Party Fund',
    ta: 'கட்சி நிதி',
    captionEn: 'Support the movement',
    captionTa: 'இயக்கத்திற்கு ஆதரவு',
  },
  {
    to: '/area',
    icon: MapPin,
    en: 'My area',
    ta: 'எனது பகுதி',
    image: '/gallery/nallur.webp',
    captionEn: 'Local updates',
    captionTa: 'உள்ளூர் செய்திகள்',
  },
  {
    to: '/ideas',
    icon: Lightbulb,
    en: 'My ideas',
    ta: 'எனது யோசனைகள்',
    image: '/member/home-ideas-v1.webp',
    captionEn: 'Share a solution',
    captionTa: 'ஒரு தீர்வைப் பகிருங்கள்',
  },
  {
    to: '/courses',
    icon: BookOpen,
    en: 'My courses',
    ta: 'எனது பாடங்கள்',
    image: '/gallery/library.webp',
    captionEn: 'Learn and grow',
    captionTa: 'கற்றல் மற்றும் வளர்ச்சி',
  },
  {
    to: '/referral',
    icon: UserPlus,
    en: 'Invite people',
    ta: 'மக்களை அழையுங்கள்',
    image: '/member/community-hero-v1.webp',
    captionEn: 'Grow our community',
    captionTa: 'சமூகத்தை வளர்ப்போம்',
  },
  {
    to: '/gallery',
    icon: Images,
    en: 'Photo gallery',
    ta: 'படத்தொகுப்பு',
    image: '/gallery/fields.webp',
  },
  {
    to: '/card',
    icon: CreditCard,
    en: 'Membership card',
    ta: 'உறுப்பினர் அட்டை',
    image: '/member/home-membership-v1.webp',
    captionEn: 'Your member ID',
    captionTa: 'உங்கள் உறுப்பினர் அடையாளம்',
  },
];
export function HomeServices({ search }: { search: string }) {
  const t = useWorkspaceText();
  const matches = (s: Service) =>
    `${s.en} ${s.ta}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const actions = quick.filter(matches),
    services = more.filter(matches);
  return (
    <>
      <section className="home-quick-panel" aria-labelledby="quick-title">
        <h2 id="quick-title">{t('Quick access', 'விரைவுச் செயல்கள்')}</h2>
        <div className={`home-quick-grid ${t('', 'home-quick-grid--ta')}`}>
          {actions.map(({ icon: Icon, ...s }) => (
            <Link key={s.to} to={s.to}>
              <span className="home-feature-icon">
                <Icon size={24} strokeWidth={2} aria-hidden="true" />
              </span>
              <strong>{t(s.en, s.ta)}</strong>
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="services-title">
        <h2 id="services-title">{t('Explore your community', 'உங்கள் சமூகத்தை அறியுங்கள்')}</h2>
        <div className="home-service-grid">
          {services.map(({ icon: Icon, ...s }) => (
            <Link
              key={s.to}
              to={s.to}
              className={`${s.image ? 'home-service-photo' : ''} ${s.to === '/fund' ? 'home-service-fund' : ''}`}
              aria-describedby={s.image ? 'home-photo-note' : undefined}
            >
              {s.image && <img src={s.image} alt="" loading="lazy" />}
              {!s.image && (
                <span className="home-service-icon">
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                </span>
              )}
              <span className="home-service-copy">
                <strong>{t(s.en, s.ta)}</strong>
                {s.captionEn && <small>{t(s.captionEn, s.captionTa ?? s.captionEn)}</small>}
              </span>
              <span className="home-service-arrow">
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
        {!!services.some((s) => s.image) && (
          <p className="home-photo-note" id="home-photo-note">
            <Link to="/gallery">
              {t('Illustrative photos · Credits', 'விளக்கப் புகைப்படங்கள் · விவரங்கள்')}
            </Link>
          </p>
        )}
      </section>
      {!actions.length && !services.length && (
        <p role="status">
          {t(
            'No matching services. Try another search.',
            'பொருத்தமான சேவைகள் இல்லை. மீண்டும் தேடுங்கள்.',
          )}
        </p>
      )}
    </>
  );
}
