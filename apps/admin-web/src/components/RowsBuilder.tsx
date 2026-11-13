'use client';

import { useState } from 'react';

import { FieldErrors, fieldId } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';

export type RowColumn = {
  key: string;
  label: string;
  lang?: 'ta' | 'en';
  kind?: 'text' | 'date';
  required?: boolean;
  maxLength?: number;
  mono?: boolean;
};

type Row = { uid: number; values: Record<string, string> };

// Keys for React only, so a moved row keeps its inputs; never sent to the API.
let lastUid = 0;
function next(): number {
  lastUid += 1;
  return lastUid;
}

function startingRows(json: string, columns: readonly RowColumn[]): Row[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || '[]');
  } catch {
    raw = [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    return { uid: next(), values: Object.fromEntries(columns.map((column) => [column.key, entry[column.key] == null ? '' : String(entry[column.key])])) };
  });
}

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-card px-3 text-sm font-semibold text-primary hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50';
const DANGER =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-error bg-card px-3 text-sm font-semibold text-error hover:bg-error-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error';

/**
 * A list of rows (milestones, outcomes) to add, remove and reorder, sent to the action as one JSON
 * field. Problems that name a row ("milestone_text_required:2") show on that row.
 */
export function RowsBuilder({
  form,
  name,
  legend,
  rowLabel,
  columns,
  initialJson,
  problems,
  max,
  hint,
}: {
  form: string;
  /** The JSON field's name; the fieldset's id is the form's field id for it. */
  name: string;
  legend: string;
  rowLabel: string;
  columns: readonly RowColumn[];
  initialJson: string;
  /** The last attempt's problems: those with ":n" for row n, and the rest for the list. */
  problems: readonly string[];
  max: number;
  hint?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => startingRows(initialJson, columns));
  const json = JSON.stringify(rows.map((row) => row.values));
  const listProblems = problems.filter((problem) => !problem.includes(':'));
  const move = (index: number, by: -1 | 1) =>
    setRows((all) => {
      const target = index + by;
      if (target < 0 || target >= all.length) return all;
      const copy = [...all];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const update = (uid: number, key: string, value: string) =>
    setRows((all) => all.map((row) => (row.uid === uid ? { ...row, values: { ...row.values, [key]: value } } : row)));

  return (
    <fieldset id={fieldId(form, name)} tabIndex={-1} className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-semibold">
        {legend} ({rows.length})
      </legend>
      <input type="hidden" name={name} value={json} />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      <FieldErrors id={listProblems.length ? `${form}-${name}-error` : undefined} problems={listProblems} />
      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const number = index + 1;
          const own = problems.filter((problem) => problem.endsWith(`:${number}`));
          const base = `${form}-${name}-${number}`;
          return (
            <li key={row.uid} id={base} tabIndex={-1} className={`flex flex-col gap-2 rounded-lg border p-3 ${own.length ? 'border-error' : 'border-line'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-text">
                  {rowLabel} {number}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${rowLabel.toLowerCase()} ${number} up`} className={BUTTON}>
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label={`Move ${rowLabel.toLowerCase()} ${number} down`}
                    className={BUTTON}>
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    onClick={() => setRows((all) => all.filter((item) => item.uid !== row.uid))}
                    aria-label={`Remove ${rowLabel.toLowerCase()} ${number}`}
                    className={DANGER}>
                    Remove
                  </button>
                </div>
              </div>
              <FieldErrors id={own.length ? `${base}-error` : undefined} problems={own} />
              <div className="grid gap-2 md:grid-cols-2">
                {columns.map((column) => (
                  <div key={column.key} className="flex flex-col gap-1">
                    <label htmlFor={`${base}-${column.key}`} className="text-xs font-semibold">
                      {column.label}
                      {column.required ? <span aria-hidden="true"> *</span> : null}
                    </label>
                    <input
                      id={`${base}-${column.key}`}
                      type={column.kind === 'date' ? 'date' : 'text'}
                      lang={column.lang}
                      value={row.values[column.key] ?? ''}
                      onChange={(event) => update(row.uid, column.key, event.target.value)}
                      required={column.required}
                      maxLength={column.maxLength}
                      className={`${CONTROL} ${column.mono ? 'font-mono' : ''}`}
                    />
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={() => setRows((all) => [...all, { uid: next(), values: Object.fromEntries(columns.map((column) => [column.key, ''])) }])}
        className={`${BUTTON} w-fit`}>
        + Add {rowLabel.toLowerCase()}
      </button>
    </fieldset>
  );
}
