import { DISTRICTS } from '@/core/api/divisions';
import { font } from '@/core/theme/tokens';
import { Icon } from '@/shared/components/Icon';
import { CustomSelect } from '@/shared/components/ui';
import type { TFunction } from 'i18next';
import type { Dispatch, SetStateAction } from 'react';

type Props = {
  t: TFunction<'translation', undefined>;
  districtVal: string;
  setDistrict: Dispatch<SetStateAction<string | null>>;
};
export function ReportFormSection({ t, districtVal, setDistrict }: Props) {
  return (
    <section>
      <div className="cr-step-head">
        <span className="cr-step-num">3</span>
        <div>
          <h2 className="cr-step-title">{t('creport.location', 'Location')}</h2>
          <p className="cr-step-sub">
            {t('creport.locationSub', 'Help us find the exact location')}
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
        <CustomSelect
          value={districtVal}
          onChange={(val) => setDistrict(val)}
          placeholder={t('creport.district', 'District')}
          ariaLabel={t('creport.district', 'District')}
          options={DISTRICTS.map((d) => ({ value: d.code, label: d.name_en }))}
        />
      </div>

      <button
        type="button"
        className="cr-current-loc-btn"
        onClick={() => {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              () => {
                /* location retrieved */
              },
              () => {},
            );
          }
        }}
      >
        <Icon name="mapPin" size={16} color="var(--accent)" strokeWidth={2.4} />
        <span>{t('creport.useCurrentLoc', 'Use Current Location')}</span>
      </button>
    </section>
  );
}
