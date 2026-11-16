'use client';

import { useState } from 'react';

import { FieldErrors, fieldId, problemsFor } from '@/components/ActionForm';
import { CONTROL } from '@/components/FormField';
import type { FormState, ProblemTargets } from '@/lib/formState';

export type AreaOption = { value: string; label: string };

const OTHER = 'other';
const LEVELS = [
  { value: 'district', label: 'மாவட்டம் / District' },
  { value: 'ds', label: 'பிரதேச செயலகப் பிரிவு / DS division' },
  { value: 'gn', label: 'கிராம சேவகர் பிரிவு / GN division' },
  { value: 'province', label: 'மாகாணம் / Province' },
] as const;

/**
 * The area a record is for: one of the staff member's own areas for the permission, or a smaller
 * area inside one by its level and code. It sends one "area" value ("district:LK41"); the API
 * checks again that the area is inside the person's own (outside_your_area otherwise).
 */
export function AreaPicker({
  form,
  options,
  initial,
  state,
  targets,
}: {
  form: string;
  options: readonly AreaOption[];
  initial?: string;
  state: FormState;
  targets: ProblemTargets;
}) {
  const known = options.some((option) => option.value === initial);
  const [choice, setChoice] = useState(known ? (initial as string) : initial ? OTHER : (options[0]?.value ?? OTHER));
  const [startLevel, startCode] = !known && initial ? initial.split(':', 2) : ['district', ''];
  const [level, setLevel] = useState(startLevel || 'district');
  const [code, setCode] = useState(startCode ?? '');
  const id = fieldId(form, 'area');
  const errors = problemsFor(state, targets, 'area');
  const errorId = errors.length > 0 ? `${id}-error` : undefined;
  const value = choice === OTHER ? `${level}:${code.trim()}` : choice;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="area" value={value} />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-semibold">
          <span lang="ta">பகுதி</span> / Area <span aria-hidden="true">*</span>
        </label>
        <p id={`${id}-hint`} className="text-xs text-muted">
          Members in this area see it. Choose one of your areas, or a smaller area inside one.
        </p>
        <select
          id={id}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          aria-invalid={errors.length > 0 ? true : undefined}
          aria-describedby={[`${id}-hint`, errorId].filter(Boolean).join(' ')}
          className={CONTROL}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={OTHER}>உங்கள் பகுதிக்குள் வேறொரு பகுதி / Another area inside yours (by code)</option>
        </select>
      </div>
      {choice === OTHER ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-level`} className="text-sm font-semibold">
              <span lang="ta">பகுதி நிலை</span> / Area level
            </label>
            <select id={`${id}-level`} value={level} onChange={(event) => setLevel(event.target.value)} className={CONTROL}>
              {LEVELS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-code`} className="text-sm font-semibold">
              <span lang="ta">பகுதிக் குறியீடு</span> / Area code <span aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-code`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              minLength={2}
              maxLength={20}
              autoComplete="off"
              className={`${CONTROL} font-mono`}
            />
          </div>
        </div>
      ) : null}
      <FieldErrors id={errorId} problems={errors} />
    </div>
  );
}
