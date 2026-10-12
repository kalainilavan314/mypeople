export interface SignupDraft {
  name: string;
  nic: string;
  phone: string;
  password: string;
  dob: string | null;
  gender: 'male' | 'female' | 'other' | null;
  districtCode: string | null;
  dsCode: string | null;
  gsCode: string | null;
  referralId: string;
  answers: Record<string, string>;
  inviteCode: string;

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
