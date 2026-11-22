import type { KnowledgeSourceFile } from '@my-people/api-client';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Detail, FOCUS_RING, Section } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { decideSource, draftSourceVersion, retireSource, reviewSource } from '@/features/assistant/actions';
import { RETIRE_FIELDS, SOURCE_DECISION_FIELDS, reviewFields } from '@/features/assistant/fields';
import {
  defaultReviewDue,
  KIND_LABELS,
  KNOWLEDGE_REFUSED,
  REVIEW_OVERDUE_LABEL,
  SOURCE_TARGETS,
  STATE_LABELS,
  STATE_TONES,
} from '@/features/assistant/forms';
import { SourceForm } from '@/features/assistant/SourceForm';
import { api } from '@/lib/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This source does not exist.';

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** D20: one source version, its texts, its history, and what may be done with it now. */
export default function SourcePage(props: PageProps<'/assistant/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <SourceView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SourceView({ params, searchParams }: Pick<PageProps<'/assistant/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/assistant">Back to the knowledge base</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let file: KnowledgeSourceFile;
  try {
    file = await (await staffApi()).getKnowledgeSource(id);
  } catch (error) {
    return (
      <>
        {backLink}
        <LoadFailure error={error} locale={locale} refused={KNOWLEDGE_REFUSED} notFound={NOT_FOUND} />
      </>
    );
  }

  const source = file.source;
  const ownDraft = source.draftedBy === staff.member.id;
  const current: Record<string, string> = {
    kind: source.kind,
    titleTa: source.titleTa,
    titleEn: source.titleEn,
    bodyTa: source.bodyTa ?? '',
    bodyEn: source.bodyEn ?? '',
    publisher: source.publisher,
    sourceUrl: source.sourceUrl ?? '',
    publishedOn: source.publishedOn ?? '',
    reviewDue: source.reviewDue,
    changeNote: source.changeNote ?? '',
  };
  const inUse = file.versions.find((version) => version.state === 'approved');
  const openDraft = file.versions.find((version) => version.state === 'draft');

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted">version {source.version}</span>
          <BilingualTag label={STATE_LABELS[source.state]} tone={STATE_TONES[source.state]} />
          {source.reviewOverdue ? <BilingualTag label={REVIEW_OVERDUE_LABEL} tone="refused" /> : null}
          <BilingualTag label={KIND_LABELS[source.kind]} />
        </div>
        <h1 className="flex flex-col text-2xl font-semibold tracking-tight text-text">
          <span lang="ta">{source.titleTa}</span>
          <span lang="en" className="text-lg font-medium text-muted">
            {source.titleEn}
          </span>
        </h1>
        <p className="text-sm text-muted">
          Issued by {source.publisher}
          {source.publishedOn ? ` · published ${formatDate(source.publishedOn)}` : ''} · review by {formatDate(source.reviewDue)} ·{' '}
          {source.passages} passages searched by the assistant
        </p>
      </header>

      <Feedback done={one(query.done)} />

      {source.state === 'draft' && source.returnReason ? (
        <p role="status" className="rounded-xl border border-warning bg-warning-bg px-4 py-3 text-sm text-warning">
          Sent back by a second editor: {source.returnReason}
        </p>
      ) : null}
      {source.state === 'superseded' && inUse ? (
        <p className="text-sm text-muted">
          A newer version is in use:{' '}
          <Link href={`/assistant/${inUse.id}`} className={`font-semibold text-primary underline ${FOCUS_RING}`}>
            version {inUse.version}
          </Link>
          .
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section id="text-ta" ta="அங்கீகரிக்கப்பட்ட உரை (தமிழ்)" en="Approved text in Tamil" intro="The assistant quotes this word for word as official text.">
            {source.bodyTa ? (
              <p lang="ta" className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {source.bodyTa}
              </p>
            ) : (
              <p className="text-sm text-muted">No Tamil version.</p>
            )}
          </Section>
          <Section id="text-en" ta="அங்கீகரிக்கப்பட்ட உரை (ஆங்கிலம்)" en="Approved text in English">
            {source.bodyEn ? (
              <p lang="en" className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {source.bodyEn}
              </p>
            ) : (
              <p className="text-sm text-muted">No English version.</p>
            )}
          </Section>

          <Section id="record" ta="பதிவு" en="Record">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Drafted by">{source.draftedByName ?? '—'} · {formatDateTime(source.createdAt)}</Detail>
              <Detail label="Approved by">{source.approvedByName ? `${source.approvedByName} · ${formatDateTime(source.approvedAt)}` : 'Not approved yet'}</Detail>
              <Detail label="Last review">{source.reviewedByName ? `${source.reviewedByName} · ${formatDateTime(source.reviewedAt)}` : 'Not reviewed since approval'}</Detail>
              <Detail label="Next review">{formatDate(source.reviewDue)}</Detail>
              {source.sourceUrl ? (
                <Detail label="Published source">
                  <a href={source.sourceUrl} rel="noreferrer" target="_blank" className="break-all text-primary underline">
                    {source.sourceUrl}
                  </a>
                </Detail>
              ) : null}
              {source.changeNote ? <Detail label="What changed in this version">{source.changeNote}</Detail> : null}
              {source.supersededAt ? <Detail label="Superseded">{formatDateTime(source.supersededAt)}</Detail> : null}
              {source.retiredAt ? <Detail label="Retired">{`${formatDateTime(source.retiredAt)} · ${source.retireReason ?? ''}`}</Detail> : null}
            </dl>
          </Section>

          <Section id="versions" ta="பதிப்புகள்" en={`Versions (${file.versions.length})`} intro="Every version is kept. Only the approved one is used.">
            <ol className="flex flex-col divide-y divide-line">
              {file.versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  {version.id === source.id ? (
                    <span className="font-mono font-semibold">version {version.version} (this one)</span>
                  ) : (
                    <Link href={`/assistant/${version.id}`} className={`font-mono font-semibold text-primary underline ${FOCUS_RING}`}>
                      version {version.version}
                    </Link>
                  )}
                  <BilingualTag label={STATE_LABELS[version.state]} tone={STATE_TONES[version.state]} />
                  <span className="text-xs tabular-nums text-muted">
                    {version.approvedAt ? `approved ${formatDate(version.approvedAt)}` : `updated ${formatDate(version.updatedAt)}`}
                  </span>
                </li>
              ))}
            </ol>
          </Section>

          {source.state === 'draft' ? (
            <Section id="edit" ta="வரைவைத் திருத்துதல்" en="Edit the draft">
              <SourceForm sourceId={source.id} current={current} />
            </Section>
          ) : null}
        </div>

        <aside aria-label="Actions" className="flex flex-col gap-4">
          {source.state === 'draft' && ownDraft ? (
            <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">
              You drafted this version, so another Knowledge Editor must approve it or send it back.
            </p>
          ) : null}
          {source.state === 'draft' && !ownDraft ? (
            <SimpleForm
              id="decision"
              title="Approve or send back"
              intro="Approving makes this version the one the assistant uses and supersedes the version before. The person who drafted it cannot approve it."
              action={decideSource}
              hidden={{ sourceId: source.id }}
              fields={SOURCE_DECISION_FIELDS}
              submits={[{ label: 'Record decision' }]}
              targets={SOURCE_TARGETS}
            />
          ) : null}
          {source.state === 'approved' && !openDraft ? (
            <SimpleForm
              id="new-version"
              title="Draft a new version"
              intro="Starts from this text. This version stays in use until the new one is approved."
              action={draftSourceVersion}
              hidden={{ sourceId: source.id }}
              fields={[]}
              submits={[{ label: 'Draft a new version', tone: 'secondary' }]}
              targets={SOURCE_TARGETS}
            />
          ) : null}
          {source.state === 'approved' && openDraft ? (
            <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">
              A new version is being drafted:{' '}
              <Link href={`/assistant/${openDraft.id}`} className={`font-semibold text-primary underline ${FOCUS_RING}`}>
                version {openDraft.version}
              </Link>
              .
            </p>
          ) : null}
          {source.state === 'approved' ? (
            <SimpleForm
              id="review"
              title="Record a review"
              intro="The text still stands. Past its review date a source is not used until someone reviews it."
              action={reviewSource}
              hidden={{ sourceId: source.id }}
              fields={reviewFields(defaultReviewDue(new Date()))}
              submits={[{ label: 'Record review' }]}
              targets={SOURCE_TARGETS}
            />
          ) : null}
          {source.state === 'draft' || source.state === 'approved' ? (
            <SimpleForm
              id="retire"
              title={source.state === 'draft' ? 'Set the draft aside' : 'Retire the source'}
              intro={
                source.state === 'draft'
                  ? 'The draft is kept but never used.'
                  : 'The assistant stops using it at once. Nothing is deleted.'
              }
              action={retireSource}
              hidden={{ sourceId: source.id }}
              fields={RETIRE_FIELDS}
              submits={[{ label: source.state === 'draft' ? 'Set aside' : 'Retire', tone: 'danger' }]}
              targets={SOURCE_TARGETS}
            />
          ) : null}
          {source.state === 'superseded' || source.state === 'retired' ? (
            <p className="rounded-2xl border border-line bg-card shadow-card p-4 text-sm text-muted">This version is kept for the record and cannot be changed.</p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
