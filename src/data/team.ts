export type TeamSlotGroup = 'founding' | 'team';

export interface TeamSlot {
  id: string;
  group: TeamSlotGroup;
  // Small label shown on the placeholder — "Founding team" / "Team member" —
  // not a status word like "pending" used as the public headline.
  groupLabel: string;
  // Populate once the owner supplies real details — leave null until then.
  // Never fill these with invented names, roles or photos.
  name: string | null;
  role: string | null;
  photoUrl: string | null;
  photoAlt: string;
}

// Centralised so a real name, role and photo can be dropped in per person
// without touching TeamPage.tsx. Six intentional placeholder slots: three
// founding team, three wider team.
export const TEAM_SLOTS: TeamSlot[] = [
  { id: 'founding-1', group: 'founding', groupLabel: 'Founding team', name: null, role: null, photoUrl: null, photoAlt: 'Photo and profile coming soon' },
  { id: 'founding-2', group: 'founding', groupLabel: 'Founding team', name: null, role: null, photoUrl: null, photoAlt: 'Photo and profile coming soon' },
  { id: 'founding-3', group: 'founding', groupLabel: 'Founding team', name: null, role: null, photoUrl: null, photoAlt: 'Photo and profile coming soon' },
  { id: 'team-1', group: 'team', groupLabel: 'Team member', name: null, role: null, photoUrl: null, photoAlt: 'Photo and profile coming soon' },
  { id: 'team-2', group: 'team', groupLabel: 'Team member', name: null, role: null, photoUrl: null, photoAlt: 'Photo and profile coming soon' },
  { id: 'team-3', group: 'team', groupLabel: 'Team member', name: null, role: null, photoUrl: null, photoAlt: 'Photo and profile coming soon' },
];

// A single reserved slot for a real group/team photo on the homepage
// team-trust section — kept separate from TEAM_SLOTS because it represents
// one shared image, not a per-person one.
export const TEAM_GROUP_PHOTO: { url: string | null; alt: string } = {
  url: null,
  alt: 'The VVE Clean team — group photo coming soon',
};
