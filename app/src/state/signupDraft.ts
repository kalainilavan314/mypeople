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
  // Compressed data: URLs (see lib/image.ts) of the two NIC card photos,
  // captured during sign-up. Where/whether these are stored server-side is a
  // separate, not-yet-decided piece of work — this only carries them across
  // the sign-up screens so they aren't lost before that is built.
  nicFrontPhoto: string | null;
  nicBackPhoto: string | null;
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
  nicFrontPhoto: null,
  nicBackPhoto: null,
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
