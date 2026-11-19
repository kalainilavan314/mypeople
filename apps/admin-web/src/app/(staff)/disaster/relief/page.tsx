import { ApiError, type ReliefDistribution, type ReliefOverview, type ReliefSupply } from '@my-people/api-client';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { recordDistribution, recordSupply } from '@/features/disaster/actions';
import { DisasterNav } from '@/features/disaster/DisasterNav';
import { colomboToday, RELIEF_TARGETS } from '@/features/disaster/forms';
import { divisionOptions } from '@/features/disaster/places';
import { api } from '@/lib/api';
import { loadAreaNames } from '@/lib/areas';
import { areaText, formatDate } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const REFUSED = 'Relief logistics needs the relief logistics permission (relief.logistics, PRM-54).';
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * D26 relief logistics: stock received into each store and relief handed out, under the same neutrality
 * firewall as Community Support (FR-DIS-005). A recipient is an AS- case or a group at a site, never a name.
 */
export default function ReliefPage(props: PageProps<'/disaster/relief'>) {
  return (
    <>
      <PageHeader ta="நிவாரண இருப்பும் விநியோகமும்" en="Relief stock and distributions" />
      <DisasterNav current="/disaster/relief" />
      <Suspense fallback={<ConsoleLoading rows={8} />}>
        <Relief searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Relief({ searchParams }: { searchParams: PageProps<'/disaster/relief'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  if (!staff.permissions.has('relief.logistics')) return <PageProblem locale={locale} message={REFUSED} />;
  const client = await staffApi();
  let overview: ReliefOverview;
  let supplies: ReliefSupply[];
  let given: ReliefDistribution[];
  try {
    [overview, supplies, given] = await Promise.all([
      client.getReliefOverview(),
      client.listReliefSupplies(),
      client.listReliefDistributions(),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'feature_unavailable') return <NotSwitchedOn what="Relief logistics" />;
    return <LoadFailure error={error} locale={locale} refused={REFUSED} notFound="Relief logistics is not available." />;
  }
  const [areaNames, divisions] = await Promise.all([
    loadAreaNames([...overview.stock.map((line) => line.storeKey), ...given.map((row) => row.areaKey), ...supplies.map((s) => s.storeKey)]),
    divisionOptions(staff, 'relief.logistics'),
  ]);
  const itemName = (key: string) => {
    const item = overview.items.find((candidate) => candidate.key === key);
    return item ? `${item.nameTa} · ${item.nameEn}` : key;
  };
  const itemOptions = overview.items.map((item) => ({ value: item.key, label: `${item.nameTa} · ${item.nameEn} (${item.unit})` }));
  const stores = [...new Set(overview.stock.filter((line) => line.balance > 0).map((line) => line.storeKey))];
  const storeOptions = divisions.filter((option) => option.value.startsWith('district:') || option.value.startsWith('ds:'));
  const today = colomboToday();

  return (
    <div className="flex flex-col gap-6">
      <Feedback done={one(query.done)} />
      <p className="max-w-3xl text-sm text-muted">
        Relief never depends on membership, donations or political support. Record a Community Support case reference (AS-…) or a
        group at a site with the number of households; never a person’s name. Records cannot be changed afterwards.
      </p>

      <Section id="stock" ta="களஞ்சிய இருப்பு" en="Stock in your stores">
        {overview.stock.length === 0 ? (
          <p className="text-sm text-muted">No relief stock recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Relief stock by store and item</caption>
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Store</th>
                  <th scope="col" className="px-3 py-2">Item</th>
                  <th scope="col" className="px-3 py-2 text-right">Received</th>
                  <th scope="col" className="px-3 py-2 text-right">Handed out</th>
                  <th scope="col" className="px-3 py-2 text-right">Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.stock.map((line) => (
                  <tr key={`${line.storeKey}-${line.item}`}>
                    <td className="px-3 py-2">{areaText(line.storeKey, areaNames, 'en')}</td>
                    <td className="px-3 py-2">{itemName(line.item)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${line.received} ${line.unit}`}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{`${line.handedOut} ${line.unit}`}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{`${line.balance} ${line.unit}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="distribution" ta="வழங்கிய நிவாரணத்தைப் பதிவுசெய்தல்" en="Record relief handed out" intro="The quantity cannot be more than the store holds. No case yet? Record the request through Community Support intake first, or record the group at the site.">
        {stores.length === 0 ? (
          <p className="text-sm text-muted">No store in your areas holds any stock. Record the supplies received first.</p>
        ) : (
          <SimpleForm
            id="record-distribution"
            action={recordDistribution}
            fields={[
              {
                name: 'storeKey',
                label: 'From store',
                kind: 'select',
                required: true,
                options: stores.map((key) => ({ value: key, label: areaText(key, areaNames, 'en') })),
              },
              { name: 'item', label: 'Item', kind: 'select', required: true, options: itemOptions },
              { name: 'quantity', label: 'Quantity (in the item’s unit)', kind: 'number', required: true, min: 1, max: 1000000 },
              { name: 'day', label: 'Handed out on', kind: 'date', required: true, defaultValue: today },
              {
                name: 'area',
                label: 'Where it was handed out',
                kind: 'select',
                options: [{ value: '', label: 'A GN division (type its key below)' }, ...divisions],
              },
              { name: 'otherArea', label: 'Or the GN division’s key', hint: 'gn:CODE inside the store’s area.', mono: true, maxLength: 40 },
              {
                name: 'recipientKind',
                label: 'Who received it',
                kind: 'radio',
                required: true,
                defaultValue: 'group',
                options: [
                  { value: 'group', label: 'ஓர் இடத்திலுள்ள குழு · A group at a site' },
                  { value: 'case', label: 'உதவி விவகாரம் · A Community Support case' },
                ],
              },
              {
                name: 'caseRef',
                label: 'Case reference',
                hint: 'Like AS-7KQ2M4XA; an open case in your area.',
                mono: true,
                maxLength: 11,
                showWhen: { field: 'recipientKind', values: ['case'] },
              },
              { name: 'groupSite', label: 'Shelter or site', maxLength: 200, showWhen: { field: 'recipientKind', values: ['group'] } },
              {
                name: 'households',
                label: 'Households served',
                kind: 'number',
                min: 1,
                max: 100000,
                showWhen: { field: 'recipientKind', values: ['group'] },
              },
              { name: 'evidence', label: 'Evidence', hint: 'The signed list number or photo reference.', required: true, minLength: 3, maxLength: 500, wide: true },
            ]}
            submits={[{ label: 'Save the record' }]}
            targets={RELIEF_TARGETS}
          />
        )}
      </Section>

      <Section id="supply" ta="பெற்ற பொருட்களைப் பதிவுசெய்தல்" en="Record supplies received">
        <SimpleForm
          id="record-supply"
          action={recordSupply}
          fields={[
            {
              name: 'store',
              label: 'Into the store of',
              kind: 'select',
              required: true,
              options: storeOptions.length ? storeOptions : [{ value: '', label: 'No district or DS division in your roles' }],
            },
            { name: 'item', label: 'Item', kind: 'select', required: true, options: itemOptions },
            { name: 'quantity', label: 'Quantity (in the item’s unit)', kind: 'number', required: true, min: 1, max: 1000000 },
            { name: 'supplier', label: 'Supplied by', hint: 'For example the District Secretariat or a named NGO.', required: true, minLength: 2, maxLength: 200 },
            { name: 'day', label: 'Received on', kind: 'date', required: true, defaultValue: today },
          ]}
          submits={[{ label: 'Record the supplies' }]}
          targets={RELIEF_TARGETS}
        />
      </Section>

      <Section id="recent" ta="அண்மையில் வழங்கியவை" en={`Recently handed out (${given.length})`}>
        {given.length === 0 ? (
          <p className="text-sm text-muted">Nothing handed out yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {given.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-2">
                <span className="font-mono font-semibold text-text">{row.distributionRef}</span>
                <span>{`${row.quantity} ${row.unit} · ${itemName(row.item)} · ${formatDate(row.deliveredOn)}`}</span>
                <span className="text-xs text-muted">
                  {row.recipientKind === 'case' ? `Case ${row.caseRef ?? ''}` : `${row.groupSite}, ${row.households} households`} ·{' '}
                  {areaText(row.areaKey, areaNames, 'en')} · from {areaText(row.storeKey, areaNames, 'en')} · evidence {row.evidence}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="supplies" ta="பெற்ற பொருட்கள்" en={`Supplies received (${supplies.length})`}>
        {supplies.length === 0 ? (
          <p className="text-sm text-muted">No supplies recorded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {supplies.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-2">
                <span>{`${row.quantity} ${row.unit} · ${itemName(row.item)} · ${formatDate(row.receivedOn)}`}</span>
                <span className="text-xs text-muted">
                  {areaText(row.storeKey, areaNames, 'en')} · from {row.supplier}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
