# Phase 1 user acceptance test checklist

The Gate G1 "Phase 1 Must UAT" record ([gate-g1.md](../requirements/gate-g1.md)): every built Phase 1 screen in the app (member screens and the Staff section) and the dashboard (the "Built" rows of the [screen map](../requirements/screen-map.md)), plus the rules that cut across them. Testers work on **staging**, never on production, with the synthetic accounts named in the Account column.

The spreadsheet testers fill in is generated from this file, so change the cases here:

```
py -3.12 scripts/testing/uat_workbook.py --out My-People-Phase1-UAT.xlsx
```

## Before testing

- **Addresses (staging):** the app https://staging-app.178.128.126.35.nip.io (staff open its Staff section from Home or Profile, or at /staff), dashboard https://staging-admin.178.128.126.35.nip.io. Staging has its own database, keys and files; nothing done there reaches production.
- **Accounts:** the release operator hands out the sign-in details from `uat-accounts.tsv` on the staging server (keys such as `member-active`, `staff-tier3a`). All live in Jaffna district. Staff add their own authenticator app at their first staff sign-in. Testers may also register new accounts: use a made-up 12-digit NIC of the form `1990` + three digits + five digits, never a real one.
- **Images:** use test images only (a printed sample card, a photo of a blank card). Never upload a real person's NIC, passport or face.
- **Not available on staging or production yet:** text messages (no SMS provider, INT-01), push notifications (INT-02; the in-app inbox is used), the party fund (its finance decisions FIN-01 to FIN-05 and a virus scanner are not in place). Mark those cases **Blocked**, not Fail.
- **Results:** Pass, Fail, Blocked or Not tested. Every Fail gets a defect ID on the Defects sheet. Re-test a fixed defect and record the new result.

## Member app

| ID | Screen | Account | Steps | Expected result |
|---|---|---|---|---|
| MEM-01 | A01 Welcome and language | signed out | Open the member app. Switch between தமிழ் and English, then reload the page. | The welcome screen changes language at once and keeps the choice after reloading. |
| MEM-02 | A03 Create account | new account | Register with a made-up NIC (e.g. 199041210001), a full name, a password of at least 12 characters, and an area chosen district, then DS division, then GN division. | The account is created and opens identity setup (never "page not found"). The member ID has the form WTL-YY-NNNNNNN. |
| MEM-03 | A03 Create account | new account | Try an invalid NIC (12345), a short password, a password containing the NIC, and an NIC that is already registered. | Each problem is named at its field in the chosen language. The repeated NIC is refused without saying whose it is. |
| MEM-04 | A02 Sign in | member-active | Sign in with NIC and password. On a throwaway account, enter a wrong password several times. | Signs in to Home. Wrong passwords give one general message; repeated failures lead to a temporary lock that says when to try again. |
| MEM-05 | A04 Identity document route | member-registered | Sign in and open identity setup. Look at both routes, then choose NIC. | Both routes are explained; the NIC route asks for the front, the back and a selfie. |
| MEM-06 | A05 NIC upload, M01 Capture advice | member-registered | Upload test images for the NIC front and back. Once, upload a very dark or blurry image. | Each image shows that the server received it. The dark or blurry one shows advice under it and still counts. |
| MEM-07 | A06 Passport upload | new account (passport route) | Register using the passport route and upload a test passport page. | The passport route asks for the passport page and a selfie; the page is received. |
| MEM-08 | A07 Before your selfie, A08 Take selfie | member-registered | Read the selfie guidance, then take or upload a test selfie. | The guidance appears before the camera; the selfie is received. |
| MEM-09 | A17 Upload interrupted | member-registered | Start an upload and switch the browser to offline in the middle (browser developer tools, Network, Offline). Go back online and press Retry upload. | The photo shows "Not yet received by the server" with Retry upload; retrying sends the same photo without choosing it again. |
| MEM-10 | A09 Review and submit | member-registered | When every image is received, give the identity consent and submit. | The submission is confirmed with a reference. Home changes to "awaiting review". |
| MEM-11 | A10 Team review pending, H02 Home awaiting review | member-registered (after MEM-10) | Open Home and the verification screen. | Both say the team is reviewing; member-only features are locked with a reason and the next step. |
| MEM-12 | A11 One item needs updating | member-registered (after DSH-05) | Open verification, replace only the named image and submit again. | Only the named image is asked for; the accepted images are not asked for again. |
| MEM-13 | A12 Identity approved | member-registered (after DSH-04) | Open the app. | It says the identity is approved and that membership is decided separately. |
| MEM-14 | A13 Basic profile, A14 Your area | new account | Complete the basic profile and the area during setup. | Both are saved; the area lists depend on each other (district, then DS division, then GN division). |
| MEM-15 | A15 Optional joining survey | new account | Skip the survey on one account; answer it on another. | Skipping never blocks setup. Answers are saved and can be changed or deleted later from the profile. |
| MEM-16 | A16 Recover access | any account | Choose "Forgot password" and ask for a code. | The app says codes cannot be sent yet. **Blocked** by INT-01 (no SMS provider). |
| MEM-17 | A18 Resume setup | member-registered | Sign out in the middle of setup and sign in again. | Setup continues at the next unfinished step; images already received are not asked for again. |
| MEM-18 | H01 Home, active member | member-active | Sign in. | Home shows one next step, the next event nearby if there is one, and locked features with their reason. |
| MEM-19 | H03 Notifications | member-active | Open Notifications. Use "Action needed", then mark all as read. | Notices are listed (for example the membership activation); read and "action needed" are separate. |
| MEM-20 | H04 Community Hub | member-active | Open the Hub and every tile. | Phase 1 services open; Phase 2 tiles say "Not available yet"; nothing leads to an error page. |
| MEM-21 | H17 Party fund, H18 Receipt | member-active | Open Party fund. | It says contributions are not available yet. **Blocked** until FIN-01 to FIN-05 are approved and the virus scanner is installed. |
| MEM-22 | E01 Events list | member-active | Open Events. Remove the "My area" filter. | Coming events are listed soonest first; "My area" is a default that can be removed; cancelled events say so. |
| MEM-23 | E02 Events map | member-active | Switch to the map, with and without allowing location. | Events can be found without giving a location. |
| MEM-24 | E03 Event filters | member-active | Filter by type, by your response and by search text; clear the filters. | Results match each filter; clearing brings the full list back. |
| MEM-25 | E04 Event detail | member-active | Open an event published in DSH-13. | Time, venue, meeting point, agenda, contact route and accessibility details come before the response buttons. |
| MEM-26 | E05 Your RSVP | member-active | Answer Going, then Maybe, then Going. On an event that is full, answer Going. | The answer and its history are kept; on a full event you are placed on the waiting list and told so. |
| MEM-27 | E06 Event pass | member-active (Going) | Open the event pass. | A code with a 60-second countdown that renews itself. A member who may not attend sees why instead. |
| MEM-28 | C01 My member card | member-active | Open the card. | Name, member ID, area and membership status are shown. |
| MEM-29 | C02 Show secure code | member-active | Show the secure code. | The code is shown (at full brightness where the phone allows) and renews when it expires. |
| MEM-30 | C03 Card while offline | member-active (phone) | Open the card online once, go offline, then reopen the app. | The card confirmed online is shown without a code, marked "Online check needed" with its time; online again, it updates. |
| MEM-31 | C05 My progress | member-active | Open My progress after DSH-13 check-in. | Only confirmed records, such as attended events, are counted. |
| MEM-32 | C06 Card not available | member-verified | Open the card. | It explains why the card is not available yet and what happens next. |
| MEM-33 | G01 Albums, G02 Album, G03 Photo and removal request | member-active (after DSH-14) | Browse albums and open a photo; ask for one photo to be removed, with a reason. | There is no download; the removal request gives a receipt and appears in the staff removal queue (DSH-15). |
| MEM-34 | P01 My profile, P02 Edit profile | member-active | Change the display name and gender; try to change the legal name. | Display name and gender change; legal name, date of birth and ID number are locked, with the reason. |
| MEM-35 | P03 Verification details | member-active | Open verification details. | The verified status and its validity are shown; no ID images are shown back to the member. |
| MEM-36 | P04 My activity | member-active | Open My activity and filter by type. | Receipts are listed newest first (for example a privacy request or an area change). |
| MEM-37 | P05 Account settings, M45 Messages and channels | member-active | Turn push and text messages on or off per topic; try to change the phone number. | Choices are saved; account and review messages stay on. Changing the number needs a code: **Blocked** by INT-01. |
| MEM-38 | P06 Privacy and account | member-active, and a throwaway account | Ask for a copy of your data. On a throwaway account, ask for the account to be closed. | Each request gives a DSR- reference, appears in My activity and reaches the DPO register (DSH-22). |
| MEM-39 | Area change (P02) | member-active | Ask to move to another GN division in Jaffna and upload a proof image. | A receipt with an AC- reference; the area does not change until a reviewer approves (STF-10). |
| MEM-40 | Password change | throwaway account | Change the password, first with a wrong current password, then correctly. | A wrong current password is refused; a change signs out every session. |
| MEM-41 | M04 Verification appeal | a member refused in DSH-06 | Appeal with a reason. | The appeal is received with its status; the decision comes from someone other than the first reviewer (DSH-08). |
| MEM-42 | M06 to M10 Household | member-active and member-household | Create a household, add a member, invite member-household by member ID and accept on that account; read the privacy screen; dissolve the household. | Each step asks for confirmation first; the invitation can be accepted or declined; the privacy screen says what is shared. |
| MEM-43 | M44 Accessibility and data saver | member-active | Set text size to Larger and turn on the data saver; open the gallery. | Text grows on every screen (up to twice the size); gallery photos load only when tapped. |
| MEM-44 | M49 Devices and sessions | member-active on two browsers | From one browser, sign the other out. | The other browser returns to sign-in at its next action and its saved card is removed. |
| MEM-45 | M50 Security alerts | member-active (after MEM-44) | Open Security alerts. | New-device sign-ins and session changes are listed. |
| MEM-46 | Tamil throughout | any account | Complete one whole flow (sign-in to event pass) in Tamil. | Tamil comes first everywhere, with no codes or untranslated keys, in the Noto Sans Tamil font. |

## Staff section of the app

| ID | Screen | Account | Steps | Expected result |
|---|---|---|---|---|
| STF-01 | S01 Staff sign-in and role | staff-tier3a | Sign in to the app and open "Staff section" on Home; add the authenticator shown the first time; sign out, sign in again and open the Staff section with a code. | A code is asked for every session; a wrong code is refused. The Role tab shows "Tier 3A · Jaffna district" and permission names, not codes. |
| STF-02 | S01 No staff role | member-active | Sign in to the app; look at Home and Profile; then go to /staff. | No Staff section entry on Home or Profile; /staff shows the "no staff role" message, a way back, and no staff screens. |
| STF-03 | S02 Tasks and area | staff-tier3a | Open Home. | Counts only for your own areas; each card opens its queue. |
| STF-04 | S03 Member lookup | staff-tier3a | Look up member-active by member ID; then an unknown ID; then a member registered outside Jaffna. | Only the minimal fields are shown; unknown and out-of-area IDs give the same "not found". |
| STF-05 | S08 Attendance scanner | staff-tier3b | Open Check-in: the list shows only events in your areas. Scan member-active's pass from another device, or check in by member ID with a reason; repeat; try your own ID. | Checked in with the name; a repeat says "already checked in"; your own ID is refused as not valid. |
| STF-06 | S08 Card check | staff-tier3b | Check member-active's secure code (MEM-29); then an expired code. | Valid shows the name and member ID only; an expired code says it has expired. |
| STF-07 | S08 Offline check-in | staff-tier3b (phone) | With no connection, scan a pass; reconnect and press Sync now. | Shown as "Saved offline, not yet a check-in"; after syncing the result is counted, or waits for an event manager (DSH-13). |
| STF-08 | S09 Attendance roster | staff-tier2b | Open Attendance for the event. | Expected and attended counts; check-ins by member ID are marked Manual. |
| STF-09 | S10 Volunteer duties | staff-tier1 (after a duty is offered) | Open the duty and accept it. | The duty and its time are shown; accepting is recorded. |
| STF-10 | S13 Approvals | staff-tier3a | Open the area change from MEM-39, view the proof, approve with a reason. Submit your own area change and look for it. | The member's area changes and they are told. Your own request is never in your queue. |
| STF-11 | S14 Alerts | staff-tier3a | Open Alerts and mark all as read. | Operational notices are listed and marked read. |
| STF-12 | Devices and sessions | staff-tier3a on two browsers | Sign the other browser out. | The other browser loses access at its next action. |

## Dashboard

| ID | Screen | Account | Steps | Expected result |
|---|---|---|---|---|
| DSH-01 | Sign-in and modules | staff-tier5 | Sign in to the dashboard; add the authenticator; reload the page. | A code is asked for every session; the menu shows the Tier 5 modules. |
| DSH-02 | Sign-in and modules | staff-tier3a | Sign in; then type the address of a module not in your menu (e.g. /settings). | Only permitted modules are in the menu; the typed address is refused. |
| DSH-03 | W01 Verification queue | staff-tier3a | Filter by state and claim the review submitted in MEM-10. | Only Jaffna reviews are listed; the area is named; claiming assigns it to you. |
| DSH-04 | W02 Identity decision | staff-tier3a | Try to approve before opening an image; then open each image, complete the checklist and approve. Wait 5 minutes and reopen an image link. | The refusal names the image to open; the approval is recorded and the member sees A12; an old image link has expired. |
| DSH-05 | W02 Request an update | staff-tier3a | On another review, request an update for one image with a reason. | The member sees exactly that image asked for (MEM-12). |
| DSH-06 | W02 Unable to verify | staff-tier3a | On another review, record "unable to verify" with a reason category. | The member sees the outcome and can appeal (MEM-41). |
| DSH-07 | D03 Identity screening panel | staff-tier3a | Read the screening signals on a review. | Signals are advice only; the decision stays with the reviewer. |
| DSH-08 | D05 Verification appeals | staff-tier4, staff-tier3a | As staff-tier3a (the first reviewer) try to decide the appeal from MEM-41; as staff-tier4 claim it and uphold or overturn it. | The first reviewer cannot decide it; the outcome and reason reach the member. |
| DSH-09 | D04 Duplicate investigations | staff-tier4 | Open the workspace; record a finding if a case is open. | Cases in your areas are listed; each account gets its own decision. |
| DSH-10 | D06 Membership activation | staff-tier3a | Activate member-verified without ticking the confirmation; then with it and a reason. | Without the confirmation it is refused; with it the membership is active and the member's Home becomes the active Home. |
| DSH-11 | W09 Roles and access | staff-tier4 | Give Tier 1 in one GN division to a verified, active test account; check the preview; confirm; then end the role with a reason. Try to give Tier 4. | The preview names the permissions and area; a tier equal to yours is refused; ending needs a reason. |
| DSH-12 | D31 Access reviews | staff-tier4 | Confirm one due grant and revoke another. | Each decision is recorded; overdue grants are marked. |
| DSH-13 | D07 Event console | staff-tier2b | Create a draft with an agenda, edit it, publish it (with the confirmation), cancel a second event with a reason, download the attendance CSV, open Offline scans. | Members see the published event; responders to the cancelled one are told; the CSV downloads; waiting offline scans can be settled by someone other than the scanner. |
| DSH-14 | D08 Gallery console | staff-tier3b, staff-tier2b | As staff-tier3b create an album, upload photos, add captions in both languages and submit; try to publish it yourself; as staff-tier2b return it with a note; edit its details; publish it. | Publishing your own album is refused; a returned album can be edited; the published album appears in the member gallery. |
| DSH-15 | D08 Removal queue | staff-tier3a | Decide the removal request from MEM-33 (remove, blur or keep) with a reason. | The decision is recorded and the member is told. |
| DSH-16 | D09 Broadcasts | staff-tier3a, staff-tier4 | Compose a bilingual broadcast to Jaffna; once put an NIC number in the text; preview the reach; submit; approve it as staff-tier4 if it needs approval. | The NIC is refused; the preview shows how many it reaches; members find it in their inbox. |
| DSH-17 | D10 Finance queue | staff-tier3b | Open the finance queue. | It opens with nothing to review. **Blocked** like MEM-21. |
| DSH-18 | D22 Election mode | staff-tier5 | Declare a test election period for Jaffna with a silence window; publish a notice; during the silence window try to send a broadcast; end the period with a reason. | Overlaps are warned; announcements are held during silence; members see the election banner. |
| DSH-19 | D32 Analytics | staff-tier3a | Open the 7, 30 and 90-day figures. | Counts only, for your areas; groups under 10 are hidden. |
| DSH-20 | D33 Audit log | staff-tier5 | Filter by an action from the steps above; check the hash chain. | The actions are there with ids only, no personal details; the chain checks out. |
| DSH-21 | D34 Settings and registry | staff-tier5 | Browse the geography registry and the feature-flag list. | The registry opens district, then DS, then GN; turning a module on needs a recorded gate. |
| DSH-22 | D35 Privacy requests | staff-tier5 | Complete the copy request from MEM-38 with a note. | The member sees the completion and the note; due dates count working days. |
| DSH-23 | Policy decisions | staff-tier5 | Open the register and one decision. | The blocked decisions and their owners are listed; nothing is approved without evidence. |
| DSH-24 | Operations and governance | staff-tier5 | Open the page. | Controls stay blocked until their decisions are approved. |
| DSH-25 | D01 Community reports | staff-tier3a | Open the reports list and one report. | Only your areas; the location is named. |
| DSH-26 | D02 Members and households | staff-tier3a | Open the household from MEM-42 for a case. | Only what the case purpose needs is shown, and the view is recorded. |
| DSH-27 | Tamil throughout | staff-tier3a | Switch the dashboard to Tamil and repeat DSH-03 and DSH-10. | Tamil first, including area and permission names. |

## Rules that cut across the apps

| ID | Screen | Account | Steps | Expected result |
|---|---|---|---|---|
| RUL-01 | Nobody decides their own record | staff-tier3a | Look for your own area change, identity review and appeal in your queues; try opening them by address. | Never listed; opening them directly is refused. |
| RUL-02 | Area limits | staff-tier3a | Register a test account in Mannar; look it up, look for its review and try to activate it. | Outside your area: not found or refused, never shown. |
| RUL-03 | Second factor every session | staff-tier3a | Sign in to the dashboard, and to the app's Staff section, in a new private window. | A code is asked for again in each new session. |
| RUL-04 | Signing out everywhere | member-active | Sign out from one browser while signed in on another. | Both browsers need to sign in again. |
| RUL-05 | Identity images stay private | staff-tier3a | Copy an image link from DSH-04 into another browser that is not signed in; open /evidence/ on the staging address. | Both are refused. |
| RUL-06 | Audit without personal data | staff-tier5 | In the audit log, open entries for the identity, membership and roles actions above. | Entries show ids and codes only, never names, ID numbers or images. |
