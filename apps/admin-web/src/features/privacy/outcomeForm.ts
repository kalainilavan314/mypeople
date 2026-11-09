import type { PrivacyOutcomeInput } from '@my-people/api-client';

type FormLike = { get(name: string): FormDataEntryValue | null };

/**
 * The DPO's outcome for a request, checked against the API's limits (a 3 to 2,000 character note
 * the member sees) and the confirmation box, so a mistake is named rather than a bare refusal.
 */
export function readOutcomeForm(form: FormLike): { input: PrivacyOutcomeInput | null; problems: string[] } {
  const outcome = String(form.get('outcome') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();
  const problems: string[] = [];
  if (outcome !== 'completed' && outcome !== 'refused') problems.push('outcome_required');
  if (note.length < 3 || note.length > 2000) problems.push('outcome_note_required');
  if (form.get('confirm') !== '1') problems.push('confirmation_required');
  if (problems.length > 0 || (outcome !== 'completed' && outcome !== 'refused')) return { input: null, problems };
  return { input: { outcome, note }, problems: [] };
}
