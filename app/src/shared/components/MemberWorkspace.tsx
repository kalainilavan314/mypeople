import { Icon, type IconName } from '@/shared/components/Icon';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
export function WorkspaceLink({
  to,
  icon,
  title,
  detail,
}: {
  to: string;
  icon: IconName;
  title: string;
  detail?: string;
}) {
  return (
    <Link className="work-link" to={to}>
      <span className="work-icon">
        <Icon name={icon} size={20} />
      </span>
      <span>
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </span>
      <Icon name="chevron" size={16} />
    </Link>
  );
}
export function useWorkspaceText() {
  const { i18n } = useTranslation();
  return (en: string, ta: string) => (i18n.language === 'ta' ? ta : en);
}
export function WorkspaceTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="work-heading">
      <span className="work-eyebrow">MY PEOPLE · என் மக்கள்</span>
      <h1>{title}</h1>
      <p>{detail}</p>
    </header>
  );
}
