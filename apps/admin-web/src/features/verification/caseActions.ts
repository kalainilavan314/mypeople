'use server';

import { redirect } from 'next/navigation';

import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

// Appeals (D05) and duplicate investigations (D04) share one shape: claim,
// release, then one final decision with a reason. The API decides who may.

const UUID = /^[0-9a-f-]{36}$/i;
type Kind = 'appeals' | 'duplicates';

function target(formData: FormData): { kind: Kind; id: string } {
  const kind = formData.get('kind') === 'duplicates' ? 'duplicates' : 'appeals';
  const id = String(formData.get('id') ?? '');
  if (!UUID.test(id)) redirect(`/${kind}`);
  return { kind, id };
}

function refused(kind: Kind, id: string, error: unknown): never {
  const { code, problems } = failure(error);
  redirect(`/${kind}/${id}?error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

export async function claimOrReleaseCase(formData: FormData): Promise<void> {
  const { kind, id } = target(formData);
  const release = formData.get('do') === 'release';
  try {
    const api = await staffApi();
    if (kind === 'appeals') await (release ? api.releaseIdentityAppeal(id) : api.claimIdentityAppeal(id));
    else await (release ? api.releaseDuplicateCase(id) : api.claimDuplicateCase(id));
  } catch (error) {
    refused(kind, id, error);
  }
  redirect(`/${kind}/${id}?done=${release ? 'released' : 'claimed'}`);
}

/** D05: uphold or overturn with a reason the member sees. D04: duplicate or not, with a reason (BR-094). */
export async function decideCase(formData: FormData): Promise<void> {
  const { kind, id } = target(formData);
  const outcome = String(formData.get('outcome') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  try {
    const api = await staffApi();
    if (kind === 'appeals') await api.decideIdentityAppeal(id, { outcome: outcome as 'uphold' | 'overturn', reason });
    else await api.decideDuplicateCase(id, { outcome: outcome as 'not_duplicate' | 'duplicate_confirmed', reason });
  } catch (error) {
    refused(kind, id, error);
  }
  redirect(`/${kind}/${id}?done=decision_recorded`);
}
