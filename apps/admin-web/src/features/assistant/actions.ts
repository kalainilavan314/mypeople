'use server';

import { ApiError, type AssistantPreview } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

import {
  ASSISTANT_REFUSED,
  SOURCE_REFUSED,
  SOURCE_TEXT_FIELDS,
  readQuestion,
  readReason,
  readReply,
  readResolution,
  readReviewDue,
  readSource,
  readSourceDecision,
} from './forms';

// D20: Knowledge Editors (ai.kb.manage) draft sources; a second editor approves each version (403
// "own_draft" for the drafter). The API checks the permission and every rule again.

/** The drafter's own approval is refused in the knowledge base's words, not the promise tracker's. */
const sourceCode = (status: number, code: string) => (status === 403 && code === 'own_draft' ? 'kb_own_draft' : code);

/** "draft_exists" means another thing elsewhere (a scorecard quarter); here it is a source's draft. */
function knowledgeWords(state: FormState): FormState {
  if (!state) return state;
  return { ...state, problems: state.problems.map((problem) => (problem === 'draft_exists' ? 'kb_draft_exists' : problem)) };
}

function sourceIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'sourceId');
  if (!id) redirect('/assistant');
  return id;
}

export async function saveSource(_previous: FormState, formData: FormData): Promise<FormState> {
  const existing = uuidOrNull(formData, 'sourceId');
  const values = valuesOf(formData, SOURCE_TEXT_FIELDS);
  const { input, problems } = readSource(formData, new Date());
  if (!input) return incomplete(SOURCE_REFUSED, problems, values);
  let id = existing;
  const failed = await attempt(values, async (api) => {
    id = existing ? (await api.editKnowledgeSourceDraft(existing, input)).id : (await api.draftKnowledgeSource(input)).id;
  });
  if (failed) return knowledgeWords(failed);
  redirect(`/assistant/${id}?done=${existing ? 'kb_source_saved' : 'kb_source_drafted'}`);
}

/** Approve, or send back with the reason; the drafter gets "kb_own_draft". */
export async function decideSource(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sourceIdFrom(formData);
  const values = valuesOf(formData, ['decision', 'reason']);
  const { input, problems } = readSourceDecision(formData);
  if (!input) return incomplete(SOURCE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideKnowledgeSource(id, input.approve, input.reason), sourceCode);
  if (failed) return knowledgeWords(failed);
  redirect(`/assistant/${id}?done=${input.approve ? 'kb_source_approved' : 'kb_source_returned'}`);
}

/** A draft of the next version from the approved text; the approved one stays in use meanwhile. */
export async function draftSourceVersion(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sourceIdFrom(formData);
  let draftId = id;
  const failed = await attempt({}, async (api) => {
    draftId = (await api.draftKnowledgeSourceVersion(id)).id;
  });
  if (failed) return knowledgeWords(failed);
  redirect(`/assistant/${draftId}?done=kb_version_drafted`);
}

export async function reviewSource(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sourceIdFrom(formData);
  const values = valuesOf(formData, ['reviewDue']);
  const { input, problems } = readReviewDue(formData, new Date());
  if (!input) return incomplete(SOURCE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.reviewKnowledgeSource(id, input.reviewDue));
  if (failed) return knowledgeWords(failed);
  redirect(`/assistant/${id}?done=kb_source_reviewed`);
}

export async function retireSource(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sourceIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readReason(formData);
  if (!input) return incomplete(SOURCE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.retireKnowledgeSource(id, input.reason));
  if (failed) return knowledgeWords(failed);
  redirect(`/assistant/${id}?done=kb_source_retired`);
}

/** FR-AIA-008: close an error report as fixed (the source changed) or no change needed. */
export async function resolveErrorReport(_previous: FormState, formData: FormData): Promise<FormState> {
  const reportId = uuidOrNull(formData, 'reportId');
  if (!reportId) redirect('/assistant/errors');
  const values = valuesOf(formData, ['outcome', 'resolution']);
  const { input, problems } = readResolution(formData);
  if (!input) return incomplete(ASSISTANT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.resolveAssistantErrorReport(reportId, input.outcome, input.resolution));
  if (failed) return failed;
  redirect('/assistant/errors?done=kb_report_resolved');
}

/** FR-AIA-007: the reply reaches the member in the app; their name and contact are never shown here. */
export async function replyToHandover(_previous: FormState, formData: FormData): Promise<FormState> {
  const handoverId = uuidOrNull(formData, 'handoverId');
  if (!handoverId) redirect('/assistant/handovers');
  const values = valuesOf(formData, ['reply']);
  const { input, problems } = readReply(formData);
  if (!input) return incomplete(ASSISTANT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.replyToAssistantHandover(handoverId, input.reply));
  if (failed) return failed;
  redirect('/assistant/handovers?done=kb_handover_answered');
}

export async function closeHandover(_previous: FormState, formData: FormData): Promise<FormState> {
  const handoverId = uuidOrNull(formData, 'handoverId');
  if (!handoverId) redirect('/assistant/handovers');
  const failed = await attempt({}, (api) => api.closeAssistantHandover(handoverId));
  if (failed) return failed;
  redirect('/assistant/handovers?done=kb_handover_closed');
}

export type TryState = { form: FormState; preview: AssistantPreview | null; question: string; language: 'ta' | 'en' } | null;

/**
 * Try a question with the configured model, in shadow mode too. The answer is shown here only; the
 * API logs it as a staff preview and keeps nothing else. 503 "assistant_unavailable" says why not.
 */
export async function tryQuestion(_previous: TryState, formData: FormData): Promise<TryState> {
  const values = valuesOf(formData, ['question', 'language']);
  const { input, problems } = readQuestion(formData);
  if (!input) return { form: incomplete(ASSISTANT_REFUSED, problems, values), preview: null, question: values.question, language: 'ta' };
  try {
    const preview = await (await staffApi()).tryAssistantQuestion(input.question, input.language);
    return { form: null, preview, question: input.question, language: input.language };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/sign-in?ended=1');
    const { code, problems: refused } = failure(error);
    return {
      form: { error: code, problems: refused, values, attempt: Date.now() },
      preview: null,
      question: input.question,
      language: input.language,
    };
  }
}
