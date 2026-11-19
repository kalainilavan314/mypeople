import type { AssistantCitation } from '@my-people/api-client';

import { KIND_LABELS } from './forms';

/**
 * FR-AIA-004: the AI explanation and the official text are shown apart and labelled. Official text
 * is only what the API found word for word in an approved source.
 */
export function AnswerView({ body, citations }: { body: string; citations: readonly AssistantCitation[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-lg border border-line p-3">
        <p className="text-xs font-semibold text-muted">
          <span lang="ta">AI விளக்கம்</span> · AI explanation
        </p>
        <p className="whitespace-pre-wrap text-sm text-text">{body}</p>
      </div>
      <Citations citations={citations} />
    </div>
  );
}

export function Citations({ citations }: { citations: readonly AssistantCitation[] }) {
  if (citations.length === 0) {
    return <p className="text-xs text-muted">No approved source was cited.</p>;
  }
  return (
    <ol className="flex flex-col gap-2" aria-label="Sources cited">
      {citations.map((citation) => (
        <li key={`${citation.sourceId}-${citation.version}`} className="flex flex-col gap-2 rounded-lg bg-surface p-3 text-sm">
          <p className="flex flex-col">
            <span lang="ta" className="font-semibold text-text">
              {citation.titleTa}
            </span>
            <span lang="en" className="text-xs text-muted">
              {citation.titleEn} · {KIND_LABELS[citation.kind].en} · version {citation.version} · {citation.publisher}
            </span>
          </p>
          {citation.sourceUrl ? (
            <a href={citation.sourceUrl} className="w-fit text-xs font-semibold text-primary underline" rel="noreferrer" target="_blank">
              Published source
            </a>
          ) : null}
          {citation.quotes.map((quote, index) => (
            <blockquote key={index} lang={quote.language} className="flex flex-col gap-1 border-l-4 border-primary bg-card px-3 py-2">
              <span className="text-xs font-semibold text-muted">
                <span lang="ta">அதிகாரபூர்வ உரை</span> · Official text
              </span>
              <span className="whitespace-pre-wrap text-text">{quote.text}</span>
            </blockquote>
          ))}
          <a href={`/assistant/${citation.sourceId}`} className="w-fit text-xs font-semibold text-primary underline">
            Open the source in the knowledge base
          </a>
        </li>
      ))}
    </ol>
  );
}
