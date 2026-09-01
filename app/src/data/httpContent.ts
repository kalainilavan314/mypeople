// Real (backend-backed) content methods. Composed over the mock client in
// data/index.ts so these hit Postgres while the rest stays mock for now.
import type { CommunityReport, Donation, DonationBoard, NewCommunityReport, NpmEvent, RsvpStatus } from './types';
import { getToken } from './authApi';

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch('/api' + path, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return (await res.json()) as T;
}

export const httpContent = {
  async getEvents(): Promise<NpmEvent[]> {
    const d = await req<{ events: NpmEvent[] }>('/events');
    return d.events;
  },
  async getEvent(id: string): Promise<NpmEvent | undefined> {
    const d = await req<{ event: NpmEvent }>(`/events/${id}`);
    return d.event;
  },
  async setRsvp(eventId: string, status: RsvpStatus | null): Promise<NpmEvent> {
    const d = await req<{ event: NpmEvent }>(`/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    return d.event;
  },
};

/* --- Community reporting (NorthUnity) — always backend-backed, so exported
       separately from the ApiClient composition. ---------------------------- */
export async function getMyCommunityReports(): Promise<CommunityReport[]> {
  const d = await req<{ reports: CommunityReport[] }>('/reports/mine');
  return d.reports;
}

export async function submitCommunityReport(input: NewCommunityReport): Promise<CommunityReport> {
  const d = await req<{ report: CommunityReport }>('/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return d.report;
}

/* --- Party Fund donations ----------------------------------------------------
   Card flow is a sandbox of the local IPG experience: start → bank OTP →
   confirm. Only last4 + brand are sent; the PAN/CVV never leave the device. */
export async function getDonationBoard(): Promise<DonationBoard> {
  return req<DonationBoard>('/donations');
}

export async function getMyDonations(): Promise<Donation[]> {
  const d = await req<{ donations: Donation[] }>('/donations/mine');
  return d.donations;
}

export async function startCardDonation(amount: number): Promise<{ devCode?: string }> {
  return req<{ ok: true; devCode?: string }>('/donations/card/start', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function confirmCardDonation(input: {
  amount: number;
  code: string;
  last4: string;
  brand: 'visa' | 'mastercard';
  note?: string;
}): Promise<Donation> {
  const d = await req<{ donation: Donation }>('/donations/card/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return d.donation;
}

export async function submitSlipDonation(input: { amount: number; image: string; note?: string }): Promise<Donation> {
  const d = await req<{ donation: Donation }>('/donations/slip', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return d.donation;
}

export async function getPendingDonations(): Promise<Donation[]> {
  const d = await req<{ donations: Donation[] }>('/donations/pending');
  return d.donations;
}

export async function reviewDonation(id: string, action: 'approve' | 'reject', note?: string): Promise<Donation> {
  const d = await req<{ donation: Donation }>(`/donations/${id}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  });
  return d.donation;
}

/** Admin-only slip image, fetched with the auth header → object URL. */
export async function fetchSlipImage(id: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`/api/donations/${id}/slip`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  return URL.createObjectURL(await res.blob());
}
