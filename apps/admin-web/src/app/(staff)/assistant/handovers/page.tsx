import type { AssistantStaffHandover } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { PageHeader } from '@/components/PageHeader';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, FOCUS_RING, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { closeHandover, replyToHandover } from '@/features/assistant/actions';
import { HANDOVER_REPLY_FIELDS } from '@/features/assistant/fields';
import {
  HANDOVER_STATES,
  HANDOVER_STATE_LABELS,
  HANDOVER_STATE_TONES,
  KNOWLEDGE_REFUSED,
  SOURCE_TARGETS,
} from '@/features/assistant/forms';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * FR-AIA-007: members who asked the assistant for a person. The conversation is here only when the
 * member agreed to share it; their name and contact details are never shown, and the reply reaches
 * them in the app. [ASSUMPTION] Knowledge Editors answer until a help desk exists.
 */
export default function HandoversPage(props: PageProps<'/assistant/handovers'>) {
  return (
    <>
      <BackLink href="/assistant">Back to the knowledge base</BackLink>
      <PageHeader ta="ஒருவருடன் பேசக் கோரிக்கைகள்" en="Requests to talk to a person" />
      <Suspense fallback={<ConsoleLoading rows={6} />}>
        <Handovers searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Handovers({ searchParams }: { searchParams: PageProps<'/assistant/handovers'>['searchParams'] }) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const query = await searchParams;
  const state = HANDOVER_STATES.find((item) => item === one(query.state)) ?? 'open';
  let handovers: AssistantStaffHandover[];
  try {
    handovers = await (await staffApi()).listAssistantHandovers(state);
  } catch (error) {
    return <LoadFailure error={error} locale={locale} refused={KNOWLEDGE_REFUSED} notFound="The requests are not available." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Feedback done={one(query.done)} />
      <nav aria-label="Request state" className="flex flex-wrap gap-2">
        {HANDOVER_STATES.map((code) => (
          <Link
            key={code}
            href={`/assistant/handovers?state=${code}`}
            aria-current={code === state ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${code === state ? 'border-primary bg-surface text-primary' : 'border-line bg-card text-text'} ${FOCUS_RING}`}>
            {HANDOVER_STATE_LABELS[code].ta} · {HANDOVER_STATE_LABELS[code].en}
          </Link>
        ))}
      </nav>
      <Section
        id="handovers"
        ta="கோரிக்கைகள்"
        en={`Requests (${handovers.length})`}
        intro="Shared conversations are kept 30 days after the request is answered or closed (OD-48). Reply in the member’s language.">
        {handovers.length === 0 ? (
          <p className="text-sm text-muted">{state === 'open' ? 'No one is waiting for a person.' : 'No requests in this state.'}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {handovers.map((handover) => (
              <li key={handover.id} className="flex flex-col gap-3 rounded-lg border border-line p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <BilingualTag label={HANDOVER_STATE_LABELS[handover.state]} tone={HANDOVER_STATE_TONES[handover.state]} />
                  <span className="text-xs tabular-nums text-muted">asked {formatDateTime(handover.createdAt)}</span>
                  <span className="text-xs text-muted">· writes in {handover.language === 'ta' ? 'Tamil (தமிழ்)' : 'English'}</span>
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold text-muted">
                    <span lang="ta">உறுப்பினருக்குத் தேவையானது</span> · What the member needs (identifiers removed)
                  </p>
                  <p lang={handover.language} className="whitespace-pre-wrap text-text">
                    {handover.request}
                  </p>
                </div>
                {handover.transcript.length > 0 ? (
                  <details className="rounded-lg bg-surface p-3">
                    <summary className={`min-h-11 cursor-pointer content-center text-sm font-semibold text-primary ${FOCUS_RING}`}>
                      Conversation the member agreed to share ({handover.transcript.length} messages)
                    </summary>
                    <ol className="mt-2 flex flex-col gap-2">
                      {handover.transcript.map((line, index) => (
                        <li key={index} className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-muted">
                            {line.role === 'member' ? 'Member' : 'Assistant (AI explanation)'} · {formatDateTime(line.createdAt)}
                          </span>
                          <span lang={handover.language} className="whitespace-pre-wrap text-text">
                            {line.body}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : (
                  <p className="text-xs text-muted">The member did not share the conversation.</p>
                )}
                {handover.reply ? (
                  <div className="flex flex-col gap-1 rounded-lg border border-line p-3">
                    <p className="text-xs font-semibold text-muted">
                      Reply sent by {handover.repliedByName ?? 'staff'} · {formatDateTime(handover.repliedAt)}
                    </p>
                    <p className="whitespace-pre-wrap text-text">{handover.reply}</p>
                  </div>
                ) : null}
                {handover.state !== 'closed' ? (
                  <div className="flex flex-col gap-3">
                    <SimpleForm
                      id={`reply-${handover.id.slice(0, 8)}`}
                      action={replyToHandover}
                      hidden={{ handoverId: handover.id }}
                      fields={HANDOVER_REPLY_FIELDS}
                      submits={[{ label: handover.reply ? 'Send another reply' : 'Send reply' }]}
                      targets={SOURCE_TARGETS}
                    />
                    <SimpleForm
                      id={`close-${handover.id.slice(0, 8)}`}
                      action={closeHandover}
                      hidden={{ handoverId: handover.id }}
                      fields={[]}
                      submits={[{ label: 'Close the request', tone: 'secondary' }]}
                      targets={SOURCE_TARGETS}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted">Closed {formatDateTime(handover.closedAt)}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
