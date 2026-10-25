# Policies

The policies My People needs, as listed in the BRD (§13.4, §16). **None is approved yet.** They are written and approved outside this repository by the owners below; the code follows the BRD's proposals until then and flags each assumption. The legal facts in BRD §16 are not legal advice and must be confirmed by Legal Counsel and the DPO.

## Policy approval matrix (§16.11)

| ID | Policy | Owner | Approved by | Gate |
|---|---|---|---|---|
| POL-01 | Privacy notices (member, staff, applicant, donor, overseas supporter) | DPO | Executive Sponsor | G0 |
| POL-02 | Data retention schedule | DPO | Tier 5 | G0 |
| POL-03 | Biometric and identity-screening policy | AI Governance Lead | Executive Sponsor | G1 |
| POL-04 | Identity review SOP | Tier 5 | Executive Sponsor | G0 |
| POL-05 | Assistance eligibility and political-neutrality policy | Assistance governance lead | Executive Sponsor | G2 |
| POL-06 | Household data and child-safeguarding policy | DPO | Executive Sponsor | G2 |
| POL-07 | Moderation and fact-checking policy | Media Lead | Tier 5 | G1 |
| POL-08 | Promise validation policy | Promise Office | Tier 5 | G2 |
| POL-09 | Scorecard publication policy | Tier 4 | Tier 5 | G2 |
| POL-10 | Participatory-budgeting rules | Treasurer | Executive Sponsor | G3 |
| POL-11 | AI acceptable-use and assistant policy | AI Governance Lead | Executive Sponsor | G2 |
| POL-12 | Election-mode policy | Tier 5 | Executive Sponsor | G2 |
| POL-13 | Field data-collection code | Tier 3A | Tier 5 | G2 |
| POL-14 | Blood-donor safeguarding policy | Tier 5 | Executive Sponsor | G3 |
| POL-15 | Political-finance compliance and refund policy | Treasurer | Executive Sponsor | G2 |
| POL-16 | Payment-gateway use policy | Treasurer | Executive Sponsor | G3 |
| POL-17 | Information security policy | Vendor security lead | Executive Sponsor | G0 |
| POL-18 | Staff confidentiality agreement and code of conduct | Tier 5 | Executive Sponsor | G0 |
| POL-19 | Incident and breach response plan | DPO | Tier 5 | G1 |
| POL-20 | Messaging consent policy | DPO | Tier 5 | G1 |
| POL-21 | Diaspora participation policy | Tier 4 | Executive Sponsor | G3 |
| POL-22 | Content authenticity and signing policy | Media Lead | Tier 5 | G2 |

## Proposed retention (§13.4, waiting on OD-03)

| Data | Proposed retention | Built today |
|---|---|---|
| NIC / passport images and selfie | 90 days after the final identity decision; cryptographic erasure | No: every version is kept until OD-03 is decided |
| ID number (encrypted) and keyed hash | Life of account + 2 years | Only the NIC hash is stored |
| Identity decision record | Life of account + 7 years | Decisions are immutable; no deletion job yet |
| Audit logs | 7 years, deleted after integrity verification | Append-only; no deletion job yet |
| Backups | 35 days rolling | Encrypted restic backups exist; rotation is the server's |

The full table (surveys, profiles, cases, contributions, attendance, gallery, notifications) is in BRD §13.4.

## Explicit prohibitions (§16.9)

The platform must never: collect vote choice or proof of voting (PRH-01); profile, target or persuade using welfare, household, health, ballot or location data (PRH-02); make assistance conditional on membership, support, contributions, attendance or campaigning (PRH-03); keep biometric data beyond approved periods or use it beyond identity review (PRH-04); track location in the background (PRH-05); sell or share personal data for targeting (PRH-06); make solely automated decisions with significant effects on a person (PRH-07); accept contributions from prohibited or undisclosed sources (PRH-08).

## Safeguards against coercion and misuse (§16.4)

No feature asks how someone voted (SG-01). Coordinators cannot export member lists; bulk export needs Tier 5 and DPO approval and is watermarked and logged (SG-02). Attendance, survey answers and referral counts never score or rank a member (SG-03). Data is never sold or shared for targeting (SG-04). Members have a confidential route to the DPO (SG-05). Staff accept a code of conduct before any permission is activated, renewed yearly (SG-06).

## Governance (§16.10)

A DPIA before Phase 1 and for each phase and AI model; a published DPO contact; processing agreements with every processor; cross-border safeguards if hosting or AI runs outside Sri Lanka (OD-20, OD-42); records of processing; a breach response plan (POL-19).
