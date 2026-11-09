'use client';

import { useState } from 'react';

export function SlipViewer({ contributionId, hasSlip }: { contributionId: string; hasSlip: boolean }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  if (!hasSlip) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 text-center text-sm text-muted">
        No bank transfer slip attached to this record.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-text">Transfer Slip Evidence</h4>
            <p className="text-xs text-muted">Encrypted on upload, decrypted on demand with 5-min session token.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setRotation(0);
              setOpenedAt(Date.now());
              setOpen(true);
            }}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-dark">
            Inspect Protected Slip
          </button>
        </div>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="slip-viewer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-line bg-card shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <h3 id="slip-viewer-title" className="text-base font-semibold text-text">
                  Protected Bank Transfer Slip
                </h3>
                <p className="text-xs text-muted">
                  Viewer-bound audit token expires in 5 minutes. Do not download or copy unredacted banking evidence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface hover:text-text"
                aria-label="Close slip viewer">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-center gap-2 border-b border-line bg-surface px-4 py-2 text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="rounded border border-line bg-card px-3 py-1 font-medium hover:bg-surface">
                Zoom Out
              </button>
              <span className="min-w-16 text-center font-mono">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="rounded border border-line bg-card px-3 py-1 font-medium hover:bg-surface">
                Zoom In
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="ml-4 rounded border border-line bg-card px-3 py-1 font-medium hover:bg-surface">
                Rotate 90°
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                }}
                className="rounded border border-line bg-card px-3 py-1 font-medium hover:bg-surface">
                Reset
              </button>
            </div>

            {/* Slip Image Container */}
            <div className="flex flex-1 items-center justify-center overflow-auto bg-neutral-900 p-4 min-h-[350px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/finance/slip/${contributionId}${openedAt ? `?t=${openedAt}` : ''}`}
                alt="Bank transfer slip"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                  maxHeight: '65vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
                className="rounded"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-line px-6 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-4 py-2 text-sm font-semibold text-text hover:bg-surface">
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
