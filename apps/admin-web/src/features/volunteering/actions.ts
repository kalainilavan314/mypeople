'use server';

import { redirect } from 'next/navigation';

import { checked, incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

import { TEXT_FIELDS, VOLUNTEER_REFUSED, readMove, readOfferDecision, readOpportunity, readOpportunityUpdate } from './forms';

// Volunteering (S10). The API checks volunteers.manage, the opportunity's area and the state again
// on every call; a refusal comes back to the form with what was typed. Only ids and confirmation
// codes travel in the address, never what was typed.

function refused(error: unknown, values: Record<string, string>): FormState {
  const { code, problems } = failure(error);
  return { error: code, problems, values, attempt: Date.now() };
}

function opportunityIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'opportunityId');
  if (!id) redirect('/volunteering');
  return id;
}

export async function createOpportunity(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = { ...valuesOf(formData, [...TEXT_FIELDS, 'startsAt', 'endsAt', 'places', 'eventId', 'area']), skills: checked(formData, 'skills').join(',') };
  const { input, problems } = readOpportunity(formData);
  if (!input) return incomplete(VOLUNTEER_REFUSED, problems, values);
  let id: string;
  try {
    id = (await (await staffApi()).createVolunteerOpportunity(input)).id;
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/volunteering/${id}?done=opportunity_created`);
}

export async function updateOpportunity(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = opportunityIdFrom(formData);
  const values = valuesOf(formData, [...TEXT_FIELDS, 'startsAt', 'endsAt', 'places']);
  const { input, problems } = readOpportunityUpdate(formData);
  if (!input) return incomplete(VOLUNTEER_REFUSED, problems, values);
  try {
    await (await staffApi()).updateVolunteerOpportunity(id, input);
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/volunteering/${id}?done=opportunity_saved`);
}

/** Open, close, or cancel; the API tells everyone who offered when it is cancelled, with the reason. */
export async function moveOpportunity(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = opportunityIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readMove(formData);
  if (!input) return incomplete(VOLUNTEER_REFUSED, problems, values);
  try {
    await (await staffApi()).moveVolunteerOpportunity(id, input.state, input.reason);
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/volunteering/${id}?done=opportunity_${input.state}`);
}

export async function decideOffer(_previous: FormState, formData: FormData): Promise<FormState> {
  const opportunityId = opportunityIdFrom(formData);
  const offerId = uuidOrNull(formData, 'offerId');
  if (!offerId) redirect(`/volunteering/${opportunityId}`);
  const values = valuesOf(formData, ['decision', 'meetingPointTa', 'meetingPointEn', 'roleTa', 'roleEn', 'reason']);
  const { input, problems } = readOfferDecision(formData);
  if (!input) return incomplete(VOLUNTEER_REFUSED, problems, values);
  try {
    await (await staffApi()).decideVolunteerOffer(offerId, input);
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/volunteering/${opportunityId}?done=${input.confirm ? 'offer_confirmed' : 'offer_declined'}`);
}

/** An answer to a volunteer's message or change request; the volunteer is told. */
export async function answerContact(_previous: FormState, formData: FormData): Promise<FormState> {
  const contactId = uuidOrNull(formData, 'contactId');
  if (!contactId) redirect('/volunteering/inbox');
  const values = valuesOf(formData, ['answer']);
  const answer = text(formData, 'answer');
  if (answer.length < 3) return incomplete(VOLUNTEER_REFUSED, ['answer_required'], values);
  try {
    await (await staffApi()).answerVolunteerContact(contactId, answer);
  } catch (error) {
    return refused(error, values);
  }
  redirect('/volunteering/inbox?done=contact_answered');
}
