/** The dashboard's modules from BRD v1.1 §15A.6, with where the BRD defines them. */
export const plannedModules = [
  { name: 'Identity verification and screening', brd: '§11.2, §11.19 · W01–W02, D03–D06' },
  { name: 'Roles, areas and permissions', brd: '§9, §11.15 · W09' },
  { name: 'Members and households', brd: '§11.14, §11.20' },
  { name: 'Community cases', brd: '§11.4 · W03–W08' },
  { name: 'Assistance case management', brd: '§11.21' },
  { name: 'Finance and reconciliation', brd: '§11.9, §11.41' },
  { name: 'Promise tracker and scorecards', brd: '§11.23, §11.24' },
  { name: 'Events, town halls and budgeting', brd: '§11.11, §11.25, §11.26' },
  { name: 'Content, moderation and signing', brd: '§11.13, §11.40' },
  { name: 'Committees', brd: '§11.29' },
  { name: 'Election mode', brd: '§11.28, §16.5' },
  { name: 'Reports, audit log and AI monitoring', brd: '§11.16, §15B.5, §17' },
] as const;
