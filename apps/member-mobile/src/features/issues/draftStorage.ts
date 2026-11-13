import { deviceDraftStorage } from '@/lib/deviceDraft';

// The text of the report being written (FR-RPT-010), kept on this device only (see lib/deviceDraft).
const storage = deviceDraftStorage('issue-report-draft.json', 'mp.issueDraft');

export const readDraftText = storage.read;
export const writeDraftText = storage.write;
export const removeDraftText = storage.remove;
