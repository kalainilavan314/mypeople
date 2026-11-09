import type { MemberCard } from '@my-people/api-client';
import { clearSavedCard, readSavedCard, saveCard } from '@my-people/mobile-ui';

export type SavedCard = { card: MemberCard; savedAt: string };

/**
 * After every successful load: an available card is saved for offline viewing
 * with the time it was confirmed; any other answer (pending, suspended,
 * inactive) removes the saved copy, so a card the server withdrew is never
 * shown offline (FR-CARD-015). Saving can fail on a device without a
 * keystore; the card screen still works online, so that is not an error.
 */
export async function rememberCard(card: MemberCard): Promise<void> {
  try {
    if (card.available) await saveCard(JSON.stringify({ card, savedAt: new Date().toISOString() } satisfies SavedCard));
    else await clearSavedCard();
  } catch {
    // Nothing to show offline then; online behaviour is unchanged.
  }
}

/** The card as last confirmed by the server, or null when none is saved. */
export async function loadSavedCard(): Promise<SavedCard | null> {
  try {
    const raw = await readSavedCard();
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedCard;
    return saved.card?.available && typeof saved.savedAt === 'string' ? saved : null;
  } catch {
    return null;
  }
}
