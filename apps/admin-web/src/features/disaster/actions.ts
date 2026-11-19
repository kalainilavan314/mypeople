'use server';

import type { ShelterCreateInput, ShelterInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { readDistribution, readRefresh, readRelay, readShelter, readSupply, RELIEF_REFUSED, SAFETY_REFUSED } from './forms';

// D26: relayers (disaster.relay) relay, check and withdraw official alerts and record shelters; relief
// officers (relief.logistics) record stock and what was handed out. The API checks permission and area again.

const ALERT_FIELDS = [
  'sourceKey', 'sourceUrl', 'sourceIssuedAt', 'sourceEndsAt', 'hazard', 'severity', 'titleTa', 'titleEn', 'bodyTa', 'bodyEn',
  'moreAreas', 'note',
] as const;
const SHELTER_FIELDS = [
  'nameTa', 'nameEn', 'placeTa', 'placeEn', 'status', 'capacity', 'sourceKey', 'sourceUrl', 'sourceReportedAt', 'area', 'otherArea',
] as const;
const RELIEF_ITEMS = [
  'rice', 'dry_rations', 'drinking_water', 'cooked_meals', 'clothing', 'mats_blankets', 'hygiene_kits', 'tarpaulins', 'baby_food',
  'kitchen_sets',
] as const;

export async function relayAlert(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ALERT_FIELDS);
  const { input, problems } = readRelay(formData);
  if (!input) return incomplete(SAFETY_REFUSED, problems, values);
  let id = '';
  const failed = await attempt(values, async (api) => {
    id = (await api.relayAlert(input)).id;
  });
  if (failed) return failed;
  redirect(`/disaster/alerts/${id}?done=alert_relayed`);
}

export async function refreshAlert(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'alertId');
  if (!id) redirect('/disaster');
  const values = valuesOf(formData, ALERT_FIELDS);
  const { input, problems } = readRefresh(formData);
  if (!input) return incomplete(SAFETY_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.refreshAlert(id, input));
  if (failed) return failed;
  redirect(`/disaster/alerts/${id}?done=alert_refreshed`);
}

export async function withdrawAlert(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'alertId');
  if (!id) redirect('/disaster');
  const values = valuesOf(formData, ['reason']);
  if (values.reason.length < 5) return incomplete(SAFETY_REFUSED, ['reason_required'], values);
  const failed = await attempt(values, (api) => api.withdrawAlert(id, values.reason));
  if (failed) return failed;
  redirect(`/disaster/alerts/${id}?done=alert_withdrawn`);
}

export async function addShelter(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, SHELTER_FIELDS);
  const { input, problems } = readShelter(formData, { needsArea: true });
  if (!input) return incomplete(SAFETY_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.addShelter(input as ShelterCreateInput));
  if (failed) return failed;
  redirect('/disaster/shelters?done=shelter_added');
}

export async function updateShelter(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'shelterId');
  if (!id) redirect('/disaster/shelters');
  const values = valuesOf(formData, SHELTER_FIELDS);
  const { input, problems } = readShelter(formData, { needsArea: false });
  if (!input) return incomplete(SAFETY_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.updateShelter(id, input as ShelterInput));
  if (failed) return failed;
  redirect('/disaster/shelters?done=shelter_updated');
}

export async function recordSupply(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['store', 'item', 'quantity', 'supplier', 'day']);
  const { input, problems } = readSupply(formData, RELIEF_ITEMS);
  if (!input) return incomplete(RELIEF_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.recordReliefSupply(input));
  if (failed) return failed;
  redirect('/disaster/relief?done=supply_recorded');
}

export async function recordDistribution(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, [
    'storeKey', 'area', 'otherArea', 'item', 'quantity', 'recipientKind', 'caseRef', 'groupSite', 'households', 'evidence',
    'day',
  ]);
  const { input, problems } = readDistribution(formData, RELIEF_ITEMS);
  if (!input) return incomplete(RELIEF_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.recordReliefDistribution(input));
  if (failed) return failed;
  redirect(`/disaster/relief?done=${text(formData, 'recipientKind') === 'case' ? 'relief_to_case' : 'relief_to_group'}`);
}
