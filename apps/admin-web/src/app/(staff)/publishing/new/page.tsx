import { PageHeader } from '@/components/PageHeader';
import { BackLink } from '@/components/PageSection';
import { SimpleForm } from '@/components/SimpleForm';
import { createDraft } from '@/features/publishing/actions';
import { STATEMENT_FIELDS } from '@/features/publishing/fields';
import { OFFICIAL_TARGETS } from '@/features/publishing/forms';

/** D30: a new statement starts as a draft; an image can be attached on the next page, then it is signed. */
export default function NewStatementPage() {
  return (
    <>
      <BackLink href="/publishing">Back to official publishing</BackLink>
      <PageHeader ta="புதிய அதிகாரபூர்வ அறிக்கை" en="New official statement" />
      <div className="rounded-2xl border border-line bg-card shadow-card p-4 sm:p-6">
        <SimpleForm
          id="new-statement"
          action={createDraft}
          fields={STATEMENT_FIELDS}
          submits={[{ label: 'Save draft' }]}
          targets={OFFICIAL_TARGETS}
          intro="Write it in both languages. It is saved as a draft: nothing is public until a registered publisher signs it."
          title="Draft"
        />
      </div>
    </>
  );
}
