import { useWorkspaceText } from '@/shared/components/MemberWorkspace';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
export function CommunityHero() {
  const t = useWorkspaceText();
  return (
    <section className="home-hero" aria-labelledby="community-heading">
      <div className="home-hero-copy">
        <span className="home-eyebrow">{t('Our community', 'எங்கள் சமூகம்')}</span>
        <h2 id="community-heading" lang={t('en', 'ta')}>
          {t('Build our North.\nTogether.', 'நமது வடக்கு.\nஒன்றிணைவோம்.')}
        </h2>
        <p>{t('Your voice matters.', 'உங்கள் குரல் முக்கியம்.')}</p>
        <Link className="home-hero-action" to="/community">
          {t('Get Involved', 'பங்கேற்கவும்')}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <figure className="home-community-photo">
        <img
          src="/member/community-hero-v1.webp"
          alt={t(
            'Illustration of neighbours working together in a community courtyard',
            'சமூக முற்றத்தில் ஒன்றாகச் செயல்படும் அயலவர்களின் விளக்கப் படம்',
          )}
          loading="eager"
          decoding="async"
          onError={(e) => {
            e.currentTarget.hidden = true;
          }}
        />
        <figcaption>{t('Illustrative image', 'விளக்கப் படம்')}</figcaption>
      </figure>
    </section>
  );
}
