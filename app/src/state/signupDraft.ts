// In-memory draft carried across the multi-screen sign-up flow
// (details -> OTP -> NIC verify -> profile -> questions -> done).

export interface SignupDraft {
  name: string;
  nic: string;
  phone: string;
  password: string;
  dob: string | null; // ISO yyyy-mm-dd
  gender: 'male' | 'female' | 'other' | null;
  districtCode: string | null;
  dsCode: string | null; // Divisional Secretariat P-code
  gsCode: string | null; // GS/GN division P-code
  referralId: string; // referral code the user was invited with (optional)
  answers: Record<string, string>; // onboarding question id -> answer
  inviteCode: string; // closed-pilot gate; unused when the server has none set
}

const empty = (): SignupDraft => ({
  name: '',
  nic: '',
  phone: '',
  password: '',
  dob: null,
  gender: null,
  districtCode: null,
  dsCode: null,
  gsCode: null,
  referralId: '',
  answers: {},
  inviteCode: '',
});

let draft: SignupDraft = empty();

export const signupDraft = {
  get: () => draft,
  patch(p: Partial<SignupDraft>) {
    draft = { ...draft, ...p };
    return draft;
  },
  reset() {
    draft = empty();
  },
};
