import { useId, type ReactNode } from 'react';

export function ProfileGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="profile-account-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
