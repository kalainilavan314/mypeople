'use server';

import type { AssignmentTransitionInput, VolunteerAssignmentInput } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const value = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
const aware = (input: string) => input && !/(Z|[+-]\d\d:\d\d)$/.test(input) ? `${input}:00+05:30` : input;

function back(query: string): never {
  redirect(`/volunteer-assignments?${query}`);
}

function refused(error: unknown): never {
  const result = failure(error);
  back(`error=${encodeURIComponent(result.code)}&problems=${encodeURIComponent(result.problems.join(','))}`);
}

export async function offerVolunteerAssignment(data: FormData): Promise<void> {
  const input: VolunteerAssignmentInput = {
    memberCode: value(data, 'memberCode').toUpperCase(),
    eventId: value(data, 'eventId'),
    consentVersion: value(data, 'consentVersion'),
    dutyType: value(data, 'dutyType') as VolunteerAssignmentInput['dutyType'],
    shiftStart: aware(value(data, 'shiftStart')),
    shiftEnd: aware(value(data, 'shiftEnd')),
  };
  if (!input.eventId || input.memberCode.length < 3 || !input.consentVersion || !input.shiftStart || !input.shiftEnd) {
    back('error=invalid_request&problems=required_fields_missing');
  }
  try {
    await (await staffApi()).createVolunteerAssignment(input);
  } catch (error) {
    refused(error);
  }
  back('done=volunteer_assignment_offered');
}

export async function closeVolunteerAssignment(data: FormData): Promise<void> {
  const assignmentId = value(data, 'assignmentId');
  const input: AssignmentTransitionInput = {
    state: value(data, 'state') as AssignmentTransitionInput['state'],
    reason: value(data, 'reason'),
  };
  if (!assignmentId || !['cancelled', 'completed'].includes(input.state) || input.reason.length < 3) {
    back('error=invalid_request&problems=required_fields_missing');
  }
  try {
    await (await staffApi()).transitionVolunteerAssignment(assignmentId, input);
  } catch (error) {
    refused(error);
  }
  back(`done=volunteer_assignment_${input.state}`);
}
