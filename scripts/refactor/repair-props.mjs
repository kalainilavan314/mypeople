import fs from 'node:fs';
import path from 'node:path';
const root='app/src';
const files=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(d,e.name)):e.name.endsWith('.tsx')?[path.join(d,e.name)]:[]);
for(const f of files(root)) {
  let code=fs.readFileSync(f,'utf8');
  if(/\bTFunction</.test(code)&&!code.includes('import type { TFunction')) code="import type { TFunction } from 'i18next';\n"+code;
  code=code.replace(/(error|message|frontError|backError): string;/g,'$1: string | null;');
  code=code.replace(/selectedOpt: CustomSelectOption;/,'selectedOpt: CustomSelectOption | undefined;');
  code=code.replace(/(selectedDs|currentDs): DsDivision;/g,'$1: DsDivision | undefined;');
  code=code.replace(/containerRef: ReturnType<typeof useRef>;/,"containerRef: import('react').RefObject<HTMLDivElement>;");
  code=code.replace(/(avatarInput|frontInput|backInput|photoRef|nicFrontRef|nicBackRef|galleryRef|cameraRef): ReturnType<typeof useRef>;/g,"$1: import('react').RefObject<HTMLInputElement>;");
  if(f.includes('EditFormProfileSelectBtn')) {
    code=code.replace(/district: ReturnType<typeof useMemo>;/,"district: import('@/core/api/divisions').District | undefined;");
    code=code.replace(/ds: ReturnType<typeof useMemo>;/,"ds: import('@/core/api/divisions').DsDivision | undefined;");
    code=code.replace(/gs: ReturnType<typeof useMemo>;/,"gs: import('@/core/api/divisions').GsDivision | undefined;");
  }
  fs.writeFileSync(f,code);
}
console.log('Nullable and ref props repaired.');
