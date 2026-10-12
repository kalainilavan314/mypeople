import raw from '@/core/api/np-divisions.json';

export interface GsDivision {
  code: string;
  ref: string;
  name: string;
}
export interface DsDivision {
  code: string;
  name_en: string;
  gn: GsDivision[];
}
export interface District {
  code: string;
  name_en: string;
  name_ta: string | null;
  ds: DsDivision[];
}

export const DISTRICTS: District[] = raw as unknown as District[];

export function districtByCode(code: string): District | undefined {
  return DISTRICTS.find((d) => d.code === code);
}

export function dsByCode(districtCode: string, dsCode: string): DsDivision | undefined {
  return districtByCode(districtCode)?.ds.find((ds) => ds.code === dsCode);
}

export function gsByCode(
  code: string,
): { district: District; ds: DsDivision; gs: GsDivision } | undefined {
  for (const district of DISTRICTS) {
    for (const ds of district.ds) {
      const gs = ds.gn.find((g) => g.code === code);
      if (gs) return { district, ds, gs };
    }
  }
  return undefined;
}

export interface GsFlat extends GsDivision {
  districtCode: string;
  districtName: string;
  dsCode: string;
  dsName: string;
}
let _flat: GsFlat[] | null = null;
export function allGs(): GsFlat[] {
  if (_flat) return _flat;
  const out: GsFlat[] = [];
  for (const d of DISTRICTS)
    for (const ds of d.ds)
      for (const g of ds.gn)
        out.push({
          ...g,
          districtCode: d.code,
          districtName: d.name_en,
          dsCode: ds.code,
          dsName: ds.name_en,
        });
  _flat = out;
  return out;
}

export function searchGs(query: string, limit = 40): GsFlat[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const res: GsFlat[] = [];
  for (const g of allGs()) {
    if (
      g.name.toLowerCase().includes(q) ||
      g.ref.toLowerCase().includes(q) ||
      g.dsName.toLowerCase().includes(q)
    ) {
      res.push(g);
      if (res.length >= limit) break;
    }
  }
  return res;
}
