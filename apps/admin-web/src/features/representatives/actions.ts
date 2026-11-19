'use server';

import type { ApiClient } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import {
  APPOINTMENT_REFUSED,
  PROFILE_TEXT_FIELDS,
  SLOT_TEXT_FIELDS,
  readFollowUp,
  readNewProfile,
  readOwnProfile,
  readProfile,
  readReason,
  readSlotSeries,
  renameProblems,
} from './forms';

// D29: profile managers (appointment.profile.manage) publish profiles and slots in their areas; the
// representative (PRM-56) keeps their own calendar. The API checks the permission and area again.

/** attempt(), with the API's problem codes in this module's own words. */
async function tryCall(values: Record<string, string>, call: (api: ApiClient) => Promise<unknown>): Promise<FormState> {
  const failed = await attempt(values, call);
  return failed ? { ...failed, problems: renameProblems(failed.problems) } : null;
}

function profileIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'representativeId');
  if (!id) redirect('/representatives');
  return id;
}

function toProfile(id: string, done: string): never {
  redirect(`/representatives/${id}?done=${done}`);
}

function toCalendar(done: string): never {
  redirect(`/representatives/calendar?done=${done}`);
}

export async function createProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, PROFILE_TEXT_FIELDS);
  const { input, problems } = readNewProfile(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  let id = '';
  const failed = await tryCall(values, async (api) => {
    id = (await api.createRepresentativeProfile(input)).id;
  });
  if (failed) return failed;
  toProfile(id, 'representative_drafted');
}

/** Changing a contact route clears the person's own approval and asks them again (BR-143). */
export async function updateProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = profileIdFrom(formData);
  const values = valuesOf(formData, PROFILE_TEXT_FIELDS);
  const { input, problems } = readProfile(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.updateRepresentativeProfile(id, input));
  if (failed) return failed;
  toProfile(id, 'representative_saved');
}

export async function publishProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = profileIdFrom(formData);
  const failed = await tryCall({}, (api) => api.publishRepresentativeProfile(id));
  if (failed) return failed;
  toProfile(id, 'representative_published');
}

export async function withdrawProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = profileIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.withdrawRepresentativeProfile(id, input));
  if (failed) return failed;
  toProfile(id, 'representative_withdrawn');
}

export async function addSlotsFor(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = profileIdFrom(formData);
  const values = valuesOf(formData, SLOT_TEXT_FIELDS);
  const { input, problems } = readSlotSeries(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.addRepresentativeSlots(id, input));
  if (failed) return failed;
  toProfile(id, 'slots_added');
}

/** A booking on the slot is cancelled and the member told the reason. */
export async function withdrawSlotFor(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = profileIdFrom(formData);
  const slotId = uuidOrNull(formData, 'slotId');
  if (!slotId) redirect(`/representatives/${id}`);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.withdrawRepresentativeSlot(id, slotId, input));
  if (failed) return failed;
  toProfile(id, 'slot_withdrawn');
}

// --- The representative's own calendar (S17 on the web) -----------------------------------------

/** Ticking "show" is the person's own approval to show the routes to members (BR-143). */
export async function updateOwnProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, [...PROFILE_TEXT_FIELDS, 'showContacts']);
  const { input, problems } = readOwnProfile(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.updateOwnRepresentativeProfile(input));
  if (failed) return failed;
  toCalendar('own_profile_saved');
}

export async function approveOwnContacts(_previous: FormState, formData: FormData): Promise<FormState> {
  const approve = text(formData, 'approve') === '1';
  const failed = await tryCall({}, (api) => api.approveOwnContacts(approve));
  if (failed) return failed;
  toCalendar(approve ? 'contacts_approved' : 'contacts_hidden');
}

export async function addOwnSlots(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, SLOT_TEXT_FIELDS);
  const { input, problems } = readSlotSeries(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.addOwnAppointmentSlots(input));
  if (failed) return failed;
  toCalendar('slots_added');
}

export async function withdrawOwnSlot(_previous: FormState, formData: FormData): Promise<FormState> {
  const slotId = uuidOrNull(formData, 'slotId');
  if (!slotId) redirect('/representatives/calendar');
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.withdrawOwnAppointmentSlot(slotId, input));
  if (failed) return failed;
  toCalendar('slot_withdrawn');
}

export async function cancelBooking(_previous: FormState, formData: FormData): Promise<FormState> {
  const appointmentId = uuidOrNull(formData, 'appointmentId');
  if (!appointmentId) redirect('/representatives/calendar');
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.cancelAppointmentBooking(appointmentId, input));
  if (failed) return failed;
  toCalendar('booking_cancelled');
}

/** FR-APT-006: the member sees the note on the appointment and in My Activity. */
export async function recordFollowUp(_previous: FormState, formData: FormData): Promise<FormState> {
  const appointmentId = uuidOrNull(formData, 'appointmentId');
  if (!appointmentId) redirect('/representatives/calendar');
  const values = valuesOf(formData, ['outcome', 'note']);
  const { input, problems } = readFollowUp(formData);
  if (!input) return incomplete(APPOINTMENT_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.recordAppointmentFollowUp(appointmentId, input));
  if (failed) return failed;
  toCalendar('follow_up_recorded');
}
