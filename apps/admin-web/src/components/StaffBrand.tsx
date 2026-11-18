'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useLocale } from '@/lib/i18n/context';

export function StaffBrand() {
  const locale = useLocale();

  return (
    <Link href="/" className="flex items-center gap-2">
      <Image src="/icon.png" alt="" width={32} height={32} />
      <span lang={locale} className="text-base font-bold text-primary">
        {locale === 'ta' ? 'தாயக மக்கள் கழகம் · நிர்வாகம்' : 'TMK · Administration'}
      </span>
    </Link>
  );
}
