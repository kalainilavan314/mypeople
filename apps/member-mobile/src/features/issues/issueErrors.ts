import { ApiError } from '@my-people/api-client';
import type { TFunction } from 'i18next';

import { errorMessage } from '@/lib/errors';

/** A draft photo could not be written to, or read back from, this device. */
export class DraftPhotoError extends Error {
  readonly kind: 'keep' | 'read';

  constructor(kind: 'keep' | 'read') {
    super(kind === 'keep' ? 'The photo could not be kept on this device' : 'The photo could not be read from this device');
    this.name = 'DraftPhotoError';
    this.kind = kind;
  }
}

export { featureClosed } from '@/lib/errors';

/**
 * The app's message, with the words that differ for issue photos: the evidence store's 503
 * otherwise reads as one about identity photos.
 */
export function issueErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof DraftPhotoError) return t(error.kind === 'keep' ? 'm.issues.photoNotKept' : 'm.issues.photoMissing');
  if (error instanceof ApiError && error.code === 'evidence_storage_not_configured') return t('m.issues.photosClosed');
  return errorMessage(t, error);
}
