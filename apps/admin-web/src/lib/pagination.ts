export const CONSOLE_PAGE_SIZE = 25;

export function consolePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d{0,3}$/.test(raw)) return 1;
  const page = Number(raw);
  return page <= 4000 ? page : 1;
}
