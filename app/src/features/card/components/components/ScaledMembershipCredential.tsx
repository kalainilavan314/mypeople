import { CREDENTIAL_WIDTH } from '@/features/card/components/MembershipCredentialModel/CREDENTIAL_WIDTH';
import { MembershipCredentialData } from '@/features/card/components/MembershipCredentialModel/MembershipCredentialData';
import { MembershipCredential } from '@/features/card/components/components/MembershipCredential';
import '@fontsource/inter/800.css';
import '@fontsource/noto-sans-tamil/900.css';
import { useLayoutEffect, useRef, useState } from 'react';
export function ScaledMembershipCredential({ data }: { data: MembershipCredentialData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.32);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / CREDENTIAL_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="credential-scale-wrap" style={{ aspectRatio: '1573 / 1000' }}>
      <div className="credential-scaled" style={{ transform: `scale(${scale})` }}>
        <MembershipCredential data={data} />
      </div>
    </div>
  );
}
