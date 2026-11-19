import { ApiError, type ManagedOfficialStatement, type OfficialRevision, type OfficialSigningStatus } from '@my-people/api-client';
import Image from 'next/image';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { BilingualTag } from '@/components/BilingualTag';
import { ConsoleLoading } from '@/components/ConsoleLoading';
import { Feedback } from '@/components/Feedback';
import { LoadFailure, PageProblem } from '@/components/PageProblem';
import { BackLink, Both, Detail, FOCUS_RING, NotSwitchedOn, Section } from '@/components/PageSection';
import { SimpleForm, type FieldSpec } from '@/components/SimpleForm';
import {
  attachDraftImage,
  correctStatement,
  publishStatement,
  removeDraftImage,
  saveDraft,
  uploadCorrectionImage,
  withdrawStatement,
} from '@/features/publishing/actions';
import { CORRECTION_FIELDS, STATEMENT_FIELDS, WITHDRAWAL_FIELDS } from '@/features/publishing/fields';
import { OFFICIAL_TARGETS, SIGNED_LABEL, STATE_LABELS, STATE_TONES, UNSIGNED_LABEL } from '@/features/publishing/forms';
import { SigningStatus } from '@/features/publishing/SigningStatus';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { getAdminLocale, getDictionary } from '@/lib/i18n';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

const UUID = /^[0-9a-f-]{36}$/i;
const NOT_FOUND = 'This statement does not exist.';
const REFUSED = 'Official publishing needs content signing (content.sign_publish) or Tier 5 system configuration.';
const FILE_INPUT = `min-h-11 rounded-lg border border-line bg-card p-2 text-sm ${FOCUS_RING}`;
const SMALL_BUTTON = `min-h-11 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-primary ${FOCUS_RING}`;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const withDefaults = (fields: readonly FieldSpec[], values: Record<string, string>) =>
  fields.map((field) => (values[field.name] !== undefined ? { ...field, defaultValue: values[field.name] } : field));

/** D30: one statement. A draft is edited, given an image and signed; a signed one is corrected or withdrawn. */
export default function StatementPage(props: PageProps<'/publishing/[id]'>) {
  return (
    <Suspense fallback={<ConsoleLoading rows={8} />}>
      <StatementView params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function StatementView({ params, searchParams }: Pick<PageProps<'/publishing/[id]'>, 'params' | 'searchParams'>) {
  await connection();
  if (!api) {
    const locale = await getAdminLocale();
    return <PageProblem locale={locale} message={getDictionary(locale).common.apiNotConfigured} />;
  }
  const staff = await requireStaff();
  const locale = await getAdminLocale(staff.member.language);
  const { id } = await params;
  const query = await searchParams;
  const backLink = <BackLink href="/publishing">Back to official publishing</BackLink>;
  if (!UUID.test(id)) {
    return (
      <>
        {backLink}
        <PageProblem locale={locale} message={NOT_FOUND} />
      </>
    );
  }
  let statement: ManagedOfficialStatement;
  let signing: OfficialSigningStatus;
  try {
    const client = await staffApi();
    [statement, signing] = await Promise.all([client.getManagedOfficialStatement(id), client.getOfficialSigningStatus()]);
  } catch (error) {
    return (
      <>
        {backLink}
        {error instanceof ApiError && error.code === 'feature_unavailable' ? (
          <NotSwitchedOn what="Official publishing" />
        ) : (
          <LoadFailure error={error} locale={locale} refused={REFUSED} notFound={NOT_FOUND} />
        )}
      </>
    );
  }

  const canSign = staff.permissions.has('content.sign_publish');
  const latest = statement.revisions.at(-1);
  const correctionImage = UUID.test(one(query.correctionImage) ?? '') ? one(query.correctionImage) : undefined;

  return (
    <>
      {backLink}
      <header className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-text">{statement.statementRef}</span>
          <BilingualTag label={STATE_LABELS[statement.state]} tone={STATE_TONES[statement.state]} />
          {latest ? <BilingualTag label={statement.signed ? SIGNED_LABEL : UNSIGNED_LABEL} tone={statement.signed ? 'done' : 'refused'} /> : null}
        </p>
        <h1 className="flex flex-col text-2xl font-bold text-text">
          <span lang="ta">{latest?.titleTa ?? (statement.draftTitleTa || 'தலைப்பு இன்னும் இல்லை')}</span>
          <span lang="en" className="text-base font-semibold text-muted">
            {latest?.titleEn ?? (statement.draftTitleEn || 'No title yet')}
          </span>
        </h1>
      </header>
      <Feedback done={one(query.done)} error={one(query.error)} problems={one(query.problems)} />
      <SigningStatus status={signing} canSign={canSign} />

      {statement.state === 'draft' ? (
        <DraftSections statement={statement} canSign={canSign} />
      ) : (
        <SignedSections statement={statement} canSign={canSign} correctionImage={correctionImage} />
      )}
    </>
  );
}

function DraftSections({ statement, canSign }: { statement: ManagedOfficialStatement; canSign: boolean }) {
  const values = {
    titleTa: statement.draftTitleTa,
    titleEn: statement.draftTitleEn,
    bodyTa: statement.draftBodyTa,
    bodyEn: statement.draftBodyEn,
  };
  const hidden = { statementId: statement.id, imageId: statement.draftImageId ?? '' };
  return (
    <>
      <Section id="draft" ta="வரைவு" en="Draft" intro="Saved as it is. Both languages are needed before it can be signed.">
        {canSign ? (
          <SimpleForm id="draft-form" action={saveDraft} hidden={hidden} fields={withDefaults(STATEMENT_FIELDS, values)} submits={[{ label: 'Save draft' }]} targets={OFFICIAL_TARGETS} />
        ) : (
          <dl className="grid gap-3 text-sm">
            <Detail label="Title">
              <Both ta={values.titleTa} en={values.titleEn} />
            </Detail>
            <Detail label="Statement">
              <Both ta={values.bodyTa} en={values.bodyEn} />
            </Detail>
          </dl>
        )}
      </Section>

      <Section id="draft-image" ta="படம்" en="Image (optional)" intro="An image is signed with the statement by its SHA-256, so a changed copy no longer verifies. JPEG, PNG or WebP up to 15 MB; it is re-encoded without metadata.">
        {statement.draftImageId ? (
          <div className="flex flex-wrap items-end gap-4">
            <a href={`/evidence/official/${statement.draftImageId}/display`} target="_blank" rel="noopener noreferrer" className={`rounded ${FOCUS_RING}`} aria-label="Open the draft image larger">
              <Image src={`/evidence/official/${statement.draftImageId}/thumb`} alt="The draft's image" width={160} height={120} className="h-30 w-40 rounded border border-line bg-surface object-contain" unoptimized />
            </a>
            {canSign ? (
              <form action={removeDraftImage}>
                <input type="hidden" name="statementId" value={statement.id} />
                <button type="submit" className={SMALL_BUTTON}>
                  Remove the image
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">No image. A statement can be text only.</p>
        )}
        {canSign ? (
          <form action={attachDraftImage} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="statementId" value={statement.id} />
            <label htmlFor="draft-image-file" className="flex flex-col gap-1 text-sm font-semibold text-text">
              {statement.draftImageId ? 'Replace the image' : 'Add an image'}
              <input id="draft-image-file" name="image" type="file" accept="image/jpeg,image/png,image/webp" required className={FILE_INPUT} />
            </label>
            <button type="submit" className={SMALL_BUTTON}>
              Upload and attach
            </button>
          </form>
        ) : null}
      </Section>

      {canSign ? (
        <Section
          id="sign"
          ta="கையொப்பமிட்டு வெளியிடுக"
          en="Sign and publish"
          intro="Signs the text in both languages and the image with the platform key, under your registered publisher name, and gives the statement its public check code. After signing it cannot be edited, only corrected with a reason. Refused during an election silence period.">
          <SimpleForm id="sign-form" action={publishStatement} hidden={{ statementId: statement.id }} fields={[]} submits={[{ label: 'Sign and publish' }]} targets={OFFICIAL_TARGETS} />
        </Section>
      ) : null}
    </>
  );
}

function SignedSections({
  statement,
  canSign,
  correctionImage,
}: {
  statement: ManagedOfficialStatement;
  canSign: boolean;
  correctionImage: string | undefined;
}) {
  const latest = statement.revisions.at(-1);
  const newestFirst = [...statement.revisions].reverse();
  const imageOptions = [
    ...(latest?.imageId ? [{ value: 'keep', label: 'Keep the current image' }] : [{ value: 'keep', label: 'No image' }]),
    ...(latest?.imageId ? [{ value: 'remove', label: 'Remove the image' }] : []),
    ...(correctionImage ? [{ value: 'new', label: 'Use the image just uploaded' }] : []),
  ];
  const correctionFields: FieldSpec[] = [
    ...withDefaults(CORRECTION_FIELDS, {
      titleTa: latest?.titleTa ?? '',
      titleEn: latest?.titleEn ?? '',
      bodyTa: latest?.bodyTa ?? '',
      bodyEn: latest?.bodyEn ?? '',
    }),
    { name: 'image', label: 'Image', kind: 'radio', required: true, options: imageOptions, defaultValue: correctionImage ? 'new' : 'keep' },
  ];

  return (
    <>
      <Section id="check" ta="சரிபார்ப்பு" en="Check code and link" intro="Print or share these with the statement. Anyone can check them without an account; a forged copy reports “No matching official record”.">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Check code">
            <span className="font-mono">{statement.checkCode}</span>
          </Detail>
          <Detail label="Check link">
            <span className="break-all font-mono text-xs">{statement.checkLink}</span>
          </Detail>
        </dl>
        {statement.state === 'withdrawn' ? (
          <dl className="grid gap-3 text-sm">
            <Detail label={`Withdrawn ${formatDateTime(statement.withdrawnAt)}`}>
              <Both ta={statement.withdrawalReasonTa} en={statement.withdrawalReasonEn} />
            </Detail>
          </dl>
        ) : null}
      </Section>

      <Section id="revisions" ta="கையொப்பமிட்ட பதிப்புகள்" en={`Signed versions (${statement.revisions.length})`} intro="Newest first. The original and every correction are kept as signed; each signature is checked again now.">
        <ol className="flex flex-col gap-4">
          {newestFirst.map((revision) => (
            <RevisionItem key={revision.id} revision={revision} />
          ))}
        </ol>
      </Section>

      {statement.state === 'published' && canSign ? (
        <Section id="correction" ta="திருத்தம்" en="Publish a correction" intro="The whole corrected text, signed as a new version with your reason. Members and anyone checking see both versions and the reason.">
          <form action={uploadCorrectionImage} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="statementId" value={statement.id} />
            <label htmlFor="correction-image-file" className="flex flex-col gap-1 text-sm font-semibold text-text">
              A new image for the correction (optional)
              <input id="correction-image-file" name="image" type="file" accept="image/jpeg,image/png,image/webp" required className={FILE_INPUT} />
            </label>
            <button type="submit" className={SMALL_BUTTON}>
              Upload the new image
            </button>
          </form>
          {correctionImage ? (
            <Image src={`/evidence/official/${correctionImage}/thumb`} alt="The new image for the correction" width={160} height={120} className="h-30 w-40 rounded border border-line bg-surface object-contain" unoptimized />
          ) : null}
          <SimpleForm
            id="correction-form"
            action={correctStatement}
            hidden={{ statementId: statement.id, currentImageId: latest?.imageId ?? '', newImageId: correctionImage ?? '' }}
            fields={correctionFields}
            submits={[{ label: 'Sign and publish the correction' }]}
            targets={OFFICIAL_TARGETS}
          />
        </Section>
      ) : null}

      {statement.state === 'published' ? (
        <Section id="withdraw" ta="மீளப்பெறுக" en="Withdraw" intro="The statement stays on record; everyone who checks it is told it was withdrawn and why. This cannot be undone.">
          <SimpleForm
            id="withdraw-form"
            action={withdrawStatement}
            hidden={{ statementId: statement.id }}
            fields={WITHDRAWAL_FIELDS}
            submits={[{ label: 'Withdraw the statement', tone: 'danger' }]}
            targets={OFFICIAL_TARGETS}
          />
        </Section>
      ) : null}
    </>
  );
}

function RevisionItem({ revision }: { revision: OfficialRevision }) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-text">{revision.revision === 1 ? 'Original' : `Correction ${revision.revision - 1}`}</span>
        <BilingualTag label={revision.verified ? SIGNED_LABEL : UNSIGNED_LABEL} tone={revision.verified ? 'done' : 'refused'} />
        <span className="text-xs tabular-nums text-muted">signed {formatDateTime(revision.publishedAt)}</span>
      </p>
      <p className="text-xs text-muted">
        By <span lang="ta">{revision.publisherNameTa}</span> / {revision.publisherNameEn} · key <span className="font-mono">{revision.keyId}</span>
      </p>
      {revision.correctionReasonEn ? (
        <dl>
          <Detail label="Reason for the correction">
            <Both ta={revision.correctionReasonTa} en={revision.correctionReasonEn} />
          </Detail>
        </dl>
      ) : null}
      <Both ta={revision.titleTa} en={revision.titleEn} />
      <Both ta={revision.bodyTa} en={revision.bodyEn} />
      {revision.imageId ? (
        <a href={`/evidence/official/${revision.imageId}/display`} target="_blank" rel="noopener noreferrer" className={`w-fit rounded ${FOCUS_RING}`} aria-label="Open the signed image larger">
          <Image src={`/evidence/official/${revision.imageId}/thumb`} alt="The signed image" width={160} height={120} className="h-30 w-40 rounded border border-line bg-surface object-contain" unoptimized />
        </a>
      ) : null}
      <details className="text-xs text-muted">
        <summary className={`min-h-11 cursor-pointer content-center font-semibold text-primary ${FOCUS_RING}`}>Signed payload and signature</summary>
        <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-surface p-2 font-mono">{revision.signedPayload}</pre>
        <p className="mt-2 break-all font-mono">{revision.signature}</p>
      </details>
    </li>
  );
}
