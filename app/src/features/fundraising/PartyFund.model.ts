export const BANK = [
  ['accName', 'MY PEOPLE'],
  ['accNumber', '1000646335'],
  ['bank', 'Commercial Bank'],
  ['branch', 'Jaffna'],
  ['bankCode', '7056'],
  ['branchCode', '06'],
  ['swift', 'CCEYLKLX'],
] as const;
export const digitsOnly = (s: string) => s.replace(/\D/g, '');
export const detectBrand = (s: string): 'visa' | 'mastercard' | null => {
  const d = digitsOnly(s);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'mastercard';
  return null;
};
export const expiryOk = (s: string) => {
  const m = /^(\d{2})\/(\d{2})$/.exec(s);
  if (!m) return false;
  const mm = Number(m[1]);
  if (mm < 1 || mm > 12) return false;
  const now = new Date();
  const end = new Date(2000 + Number(m[2]), mm, 1);
  return end > now;
};
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtLKR = (n: number) =>
  `Rs. ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
export const formatCardNumber = (s: string) =>
  digitsOnly(s)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ');
export const GOLD = 'var(--brand-gold)';
export const luhnOk = (s: string) => {
  const d = digitsOnly(s);
  if (d.length !== 16) return false;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    let n = Number(d[15 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
};
export const PRESETS = [500, 1000, 2500, 5000];
