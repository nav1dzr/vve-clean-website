export type TeamSlotStatus = 'Founder profile pending' | 'Team profile pending';

export interface TeamSlot {
  id: string;
  status: TeamSlotStatus;
  // Populate once the owner supplies real details — leave null until then.
  // Never fill these with invented names, roles or photos.
  name: string | null;
  role: string | null;
  photoUrl: string | null;
  photoAlt: string;
}

// Centralised so a real name, role and photo can be dropped in per person
// without touching TeamPage.tsx. Six intentional placeholder slots: three
// founders, three team members.
export const TEAM_SLOTS: TeamSlot[] = [
  { id: 'founder-1', status: 'Founder profile pending', name: null, role: null, photoUrl: null, photoAlt: 'Founder photo coming soon' },
  { id: 'founder-2', status: 'Founder profile pending', name: null, role: null, photoUrl: null, photoAlt: 'Founder photo coming soon' },
  { id: 'founder-3', status: 'Founder profile pending', name: null, role: null, photoUrl: null, photoAlt: 'Founder photo coming soon' },
  { id: 'team-1', status: 'Team profile pending', name: null, role: null, photoUrl: null, photoAlt: 'Team member photo coming soon' },
  { id: 'team-2', status: 'Team profile pending', name: null, role: null, photoUrl: null, photoAlt: 'Team member photo coming soon' },
  { id: 'team-3', status: 'Team profile pending', name: null, role: null, photoUrl: null, photoAlt: 'Team member photo coming soon' },
];
