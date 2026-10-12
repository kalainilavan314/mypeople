export type DonationMethod = 'card' | 'slip';
export type DonationStatus = 'pending' | 'approved' | 'rejected';
export interface Donation {
  id: string;
  amount: number;
  method: DonationMethod;
  cardLast4: string | null;
  cardBrand: 'visa' | 'mastercard' | null;
  status: DonationStatus;
  note: string | null;
  createdAt: string;
  hasSlip: boolean;
  donorName?: string;
  districtName?: string | null;
}
export interface DonationBoard {
  total: number;
  count: number;
  donations: Donation[];
}
