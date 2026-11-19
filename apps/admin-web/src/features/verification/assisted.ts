import type { AssistedReviewSession } from '@my-people/api-client';

type Words = { ta: string; en: string };

/** S04's witness checklist (FR-STF-004), as the reviewer reads it in W02. */
export const ASSISTED_CHECKLIST_LABELS: Readonly<Record<string, Words>> = {
  member_present: { ta: 'உறுப்பினர் நேரில் இருந்தார்', en: 'The member was there in person' },
  original_document_seen: { ta: 'மூல அடையாள அட்டை அல்லது கடவுச்சீட்டு பார்க்கப்பட்டது', en: 'The original NIC or passport was seen' },
  face_matches_document: { ta: 'நபர் ஆவணப் படத்துடன் பொருந்தினார்', en: 'The person matched the photo on the document' },
  captured_on_allowed_device: {
    ta: 'படங்கள் உறுப்பினரின் தொலைபேசியில் அல்லது அலுவலகச் சாதனத்தில் எடுக்கப்பட்டன',
    en: "Photos taken on the member's phone or an office device",
  },
  no_copies_kept: { ta: 'சாட்சியிடம் எந்தப் பிரதியும் வைக்கப்படவில்லை', en: 'No copy kept by the witness' },
  declaration_by_member: { ta: 'உறுப்பினரே உறுதிமொழியை வாசித்து ஏற்றுக்கொண்டார்', en: 'The member read and accepted the declaration' },
};

export const ASSISTED_DEVICE_LABELS: Readonly<Record<AssistedReviewSession['device'], Words>> = {
  member_device: { ta: 'உறுப்பினரின் சொந்தத் தொலைபேசி', en: "The member's own phone" },
  office_device: { ta: 'மாவட்ட அலுவலகச் சாதனம்', en: 'A district office device' },
};

export const ASSISTED_OUTCOME_LABELS: Readonly<Record<'completed' | 'abandoned' | 'open', Words>> = {
  completed: { ta: 'மதிப்பாய்வுக்கு அனுப்பப்பட்டது', en: 'Sent for review' },
  abandoned: { ta: 'முடிக்கப்படாமல் நிறுத்தப்பட்டது', en: 'Ended without submitting' },
  open: { ta: 'நடைபெறுகிறது', en: 'In progress' },
};
