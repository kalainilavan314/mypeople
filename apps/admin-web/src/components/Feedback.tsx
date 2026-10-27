import { messageFor, problemText } from '@/lib/messages';

type Props = { error?: string | string[]; problems?: string | string[]; done?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The result of the last action, carried back in the address after the
 * action redirected: a refusal with its reasons, or a confirmation. Only
 * codes travel in the address, never personal data.
 */
export function Feedback({ error, problems, done }: Props) {
  const code = first(error);
  const list = (first(problems) ?? '').split(',').filter(Boolean);
  const confirmation = first(done);
  if (code) {
    return (
      <div role="alert" className="rounded-xl border border-error bg-error-bg px-4 py-3 text-sm text-error">
        <p className="font-semibold">! {messageFor(code)}</p>
        {list.length > 0 ? (
          <ul className="mt-1 list-disc pl-5">
            {list.map((problem) => (
              <li key={problem}>{problemText(problem)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  if (confirmation) {
    return (
      <p role="status" className="rounded-xl border border-success bg-success-bg px-4 py-3 text-sm text-success">
        ✓ {confirmation.replace(/_/g, ' ')}
      </p>
    );
  }
  return null;
}
