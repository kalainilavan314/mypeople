import { DISTRICTS } from '@/core/api/divisions';
import { font } from '@/core/theme/tokens';
import { CustomSelect } from '@/shared/components/ui';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  districtVal: string;
  setDistrict: Dispatch<SetStateAction<string | null>>;
};
export function ReportFormSection({ t, districtVal, setDistrict }: Props) {
  const { i18n } = useTranslation();
  const tamil = i18n.language.startsWith('ta');
  return (
    <section>
      <div className="cr-step-head">
        <span className="cr-step-num">3</span>
        <div>
          <h2 className="cr-step-title">{t('creport.location', 'Location')}</h2>
          <p className="cr-step-sub">
            {t('creport.locationSub', 'Which district is the issue in?')}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <span
          style={{
            display: 'block',
            font: `600 12px/1 ${font.ui}`,
            color: '#64748B',
            marginBottom: 6,
          }}
        >
          {t('creport.district', 'District')}
        </span>
        <p className="cr-step-sub" style={{ margin: '0 0 8px' }}>
          {t(
            'creport.districtHint',
            'Your own district is filled in. Change it if the issue is somewhere else.',
          )}
        </p>
        <CustomSelect
          value={districtVal}
          onChange={(val) => setDistrict(val)}
          placeholder={t('creport.district', 'District')}
          ariaLabel={t('creport.district', 'District')}
          options={DISTRICTS.map((d) => ({ value: d.code, label: tamil && d.name_ta ? d.name_ta : d.name_en }))}
        />
      </div>
    </section>
  );
}
