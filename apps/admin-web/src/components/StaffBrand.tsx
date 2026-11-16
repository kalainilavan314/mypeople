'use client';

import Link from 'next/link';

import { useLocale } from '@/lib/i18n/context';

export function StaffBrand() {
  const locale = useLocale();

  return (
    <Link href="/" className="flex flex-col">
      <span lang={locale} className="text-base font-bold text-primary">
        {locale === 'ta' ? 'என் மக்கள் · நிர்வாகம்' : 'My People · Administration'}
      </span>
    </Link>
  );
}
