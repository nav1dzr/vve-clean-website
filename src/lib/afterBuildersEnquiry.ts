export const AFTER_BUILDERS_DRAFT_KEY = 'vve_after_builders_enquiry_v1';
export const AFTER_BUILDERS_SUBMISSION_SCOPE = 'after_builders_enquiry';

export const CLEANING_AREAS = { unsure: 'Not sure yet', whole: 'Whole property', selected: 'Selected rooms or one area' } as const;
export const PROPERTY_TYPES = { unsure: 'Not sure yet', flat: 'Flat', house: 'House', studio: 'Studio', commercial: 'Commercial property', other: 'Other property' } as const;
export const WORK_TYPES = { unsure: 'Not sure yet', renovation: 'Renovation or refurbishment', decorating: 'Painting or decorating', extension: 'Extension', new_build: 'New build', other: 'Other building work' } as const;
export const TRADES_STATUS = { unsure: 'Not sure yet', finished: 'The building work is finished', ongoing: 'Trades are still working' } as const;
export const PARKING_OPTIONS = { unsure: 'Not sure yet', free: 'Free parking available', paid: 'Paid parking or a permit is needed' } as const;
export const PHOTO_OPTIONS = { later: 'I can send photos on WhatsApp', help: 'Please help me arrange photos or an assessment', unsure: 'Not sure yet' } as const;
export const ASSESSMENT_ITEMS = { dust: 'Fine building dust', paint: 'Paint or plaster marks', adhesive: 'Adhesive, silicone or grout residue', delicate: 'Delicate or newly finished surfaces', unsure: 'Please advise from photos' } as const;
export const EXTRA_SERVICES = {
  carpet: { label: 'Carpet extraction', unit: 'carpet areas' },
  upholstery: { label: 'Sofa or upholstery cleaning', unit: 'items' },
  appliances: { label: 'Appliance interior cleaning', unit: 'appliances' },
  windows: { label: 'Exterior or specialist window cleaning', unit: 'windows' },
  pressure_washing: { label: 'Pressure washing', unit: 'm²' },
  garden: { label: 'Garden work', unit: '' },
} as const;
export const CORE_CLEANING = [
  'Building dust on reachable surfaces, doors and skirting in the agreed rooms.',
  'Kitchen and bathroom surfaces and fittings in the agreed rooms.',
  'Suitable vacuuming and floor cleaning; carpet extraction is a separate service.',
  'Empty storage and internal glazing to be specified in the written cleaning list.',
];

export type ExtraService = keyof typeof EXTRA_SERVICES;
export interface AfterBuildersEnquiryState {
  cleaningArea: keyof typeof CLEANING_AREAS;
  propertyType: keyof typeof PROPERTY_TYPES;
  workType: keyof typeof WORK_TYPES;
  bedrooms: string;
  bathrooms: string;
  floorArea: string;
  extras: ExtraService[];
  quantities: Partial<Record<ExtraService, string>>;
  assessment: (keyof typeof ASSESSMENT_ITEMS)[];
  trades: keyof typeof TRADES_STATUS;
  parking: keyof typeof PARKING_OPTIONS;
  photos: keyof typeof PHOTO_OPTIONS;
  postcode: string;
  workDetails: string;
  preferredDate: string;
  accessNotes: string;
}
type AfterBuildersChoices = Omit<AfterBuildersEnquiryState, 'postcode' | 'workDetails' | 'preferredDate' | 'accessNotes'>;
export const createAfterBuildersEnquiry = (): AfterBuildersEnquiryState => ({
  cleaningArea: 'unsure', propertyType: 'unsure', workType: 'unsure', bedrooms: '', bathrooms: '', floorArea: '',
  extras: [], quantities: {}, assessment: [], trades: 'unsure', parking: 'unsure', photos: 'unsure',
  postcode: '', workDetails: '', preferredDate: '', accessNotes: '',
});

const choice = <T extends string>(value: unknown, options: Record<T, unknown>, fallback: T): T =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(options, value) ? value as T : fallback;
const count = (value: unknown) => typeof value === 'string' && /^(?:0|[1-5]|6\+)$/.test(value) ? value : '';
export function enquiryQuantity(value: unknown, squareMetres = false): string {
  const format = squareMetres ? /^(?:\d{1,5}(?:\.\d{1,5})?|\.\d{1,5})$/ : /^\d{1,5}$/;
  return typeof value === 'string' && format.test(value) && Number(value) > 0 ? value : '';
}

// Whitelist fixed choices and numeric quantities only. Free text can contain personal
// information, so never retain it, postcode, contact details or preferred dates.
export function nonPersonalAfterBuildersChoices(input: unknown): AfterBuildersChoices {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const next = createAfterBuildersEnquiry();
  next.cleaningArea = choice(value.cleaningArea, CLEANING_AREAS, 'unsure');
  next.propertyType = choice(value.propertyType, PROPERTY_TYPES, 'unsure');
  next.workType = choice(value.workType, WORK_TYPES, 'unsure');
  next.trades = choice(value.trades, TRADES_STATUS, 'unsure');
  next.parking = choice(value.parking, PARKING_OPTIONS, 'unsure');
  next.photos = choice(value.photos, PHOTO_OPTIONS, 'unsure');
  next.bedrooms = count(value.bedrooms); next.bathrooms = count(value.bathrooms); next.floorArea = enquiryQuantity(value.floorArea, true);
  next.extras = Array.isArray(value.extras) ? [...new Set(value.extras.filter((key): key is ExtraService => typeof key === 'string' && Object.prototype.hasOwnProperty.call(EXTRA_SERVICES, key)))] : [];
  next.assessment = Array.isArray(value.assessment) ? [...new Set(value.assessment.filter((key): key is keyof typeof ASSESSMENT_ITEMS => typeof key === 'string' && Object.prototype.hasOwnProperty.call(ASSESSMENT_ITEMS, key)))] : [];
  if (value.quantities && typeof value.quantities === 'object') {
    for (const extra of next.extras) next.quantities[extra] = enquiryQuantity((value.quantities as Record<string, unknown>)[extra], extra === 'pressure_washing');
  }
  return {
    cleaningArea: next.cleaningArea, propertyType: next.propertyType, workType: next.workType,
    bedrooms: next.bedrooms, bathrooms: next.bathrooms, floorArea: next.floorArea,
    extras: next.extras, quantities: next.quantities, assessment: next.assessment,
    trades: next.trades, parking: next.parking, photos: next.photos,
  };
}

let memoryDraft: { savedAt: number; choices: AfterBuildersChoices } | undefined;
const DRAFT_LIFETIME = 14 * 24 * 60 * 60 * 1000;
export function saveAfterBuildersDraft(state: AfterBuildersEnquiryState): void {
  memoryDraft = { savedAt: Date.now(), choices: nonPersonalAfterBuildersChoices(state) };
  try { localStorage.setItem(AFTER_BUILDERS_DRAFT_KEY, JSON.stringify({ version: 1, ...memoryDraft })); } catch { /* Current-tab choices still work when storage is blocked. */ }
}
export function readAfterBuildersDraft(): AfterBuildersEnquiryState {
  let value: unknown = memoryDraft;
  try {
    const raw = localStorage.getItem(AFTER_BUILDERS_DRAFT_KEY);
    if (raw) { const stored = JSON.parse(raw); value = stored.version === 1 ? stored : undefined; }
  } catch { /* Fall back to this tab's non-personal choices. */ }
  if (!value || typeof value !== 'object') return createAfterBuildersEnquiry();
  const draft = value as { savedAt?: number; choices?: unknown };
  if (typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > DRAFT_LIFETIME || draft.savedAt > Date.now() + 60000) return createAfterBuildersEnquiry();
  return { ...createAfterBuildersEnquiry(), ...nonPersonalAfterBuildersChoices(draft.choices) };
}
export function clearAfterBuildersDraft(): void {
  memoryDraft = undefined;
  try { localStorage.removeItem(AFTER_BUILDERS_DRAFT_KEY); } catch { /* Nothing else needs clearing. */ }
}

export function isEnquiryPostcodeValid(value: string): boolean {
  return !value.trim() || /^(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?(?:\s?\d[A-Z]{2})?)$/i.test(value.trim());
}
const supplied = (text: string) => text.trim() || 'Not sure yet';
function projectScopeLines(state: AfterBuildersChoices) {
  return [
    `Cleaning area: ${CLEANING_AREAS[state.cleaningArea]}`,
    `Property: ${PROPERTY_TYPES[state.propertyType]}`,
    `Bedrooms: ${supplied(state.bedrooms)}; bathrooms: ${supplied(state.bathrooms)}`,
    `Approximate floor area: ${state.floorArea ? `${state.floorArea} m²` : 'Not known'}`,
    `Building work: ${WORK_TYPES[state.workType]}`,
  ];
}
function extraServiceLines(state: AfterBuildersChoices) {
  if (!state.extras.length) return ['No optional services selected.'];
  return state.extras.map(key => {
    const { label, unit } = EXTRA_SERVICES[key];
    return state.quantities[key] && unit ? `${label}: ${state.quantities[key]} ${unit}` : `${label} — quantity and work to agree`;
  });
}

export function afterBuildersPhotoMessage(state: AfterBuildersEnquiryState, submitted: boolean): string {
  const choices = nonPersonalAfterBuildersChoices(state);
  return [
    submitted ? 'Hello, I’ve sent an after-builders enquiry on your website. Here are photos for that enquiry.'
      : 'Hello, I’d like a quote for an after-builders clean. Here are photos and the details I’ve selected so far.',
    projectScopeLines(choices).join('\n'),
    extraServiceLines(choices).join('\n'),
    ...choices.assessment.map(key => ASSESSMENT_ITEMS[key]),
    'Please assess the work and confirm the cleaning list and final price in writing.',
  ].join('\n\n');
}

export function afterBuildersEnquirySections(state: AfterBuildersEnquiryState) {
  return [
    { title: 'Your project', lines: [
      ...projectScopeLines(state),
      `Postcode: ${supplied(state.postcode.toUpperCase())}`,
      ...(state.workDetails.trim() ? [`Project details: ${state.workDetails.trim()}`] : []),
    ] },
    { title: 'Core cleaning to confirm in your quote', lines: CORE_CLEANING },
    { title: 'Optional services requested', lines: extraServiceLines(state) },
    { title: 'Condition and finishes', lines: [state.assessment.length ? state.assessment.map(key => ASSESSMENT_ITEMS[key]).join('; ') : 'Please assess the dust, residue and surfaces.'] },
    { title: 'Timing, access and photos', lines: [
      `Trades: ${TRADES_STATUS[state.trades]}`,
      `Preferred date: ${state.preferredDate || 'Flexible / to agree'}`,
      `Parking: ${PARKING_OPTIONS[state.parking]}`,
      `Photos: ${PHOTO_OPTIONS[state.photos]}`,
      ...(state.accessNotes.trim() ? [`Access notes: ${state.accessNotes.trim()}`] : []),
    ] },
  ];
}
export function buildAfterBuildersEnquiryMessage(state: AfterBuildersEnquiryState): string {
  return ['After-builders cleaning enquiry', ...afterBuildersEnquirySections(state).map(section => `${section.title.toUpperCase()}\n${section.lines.map(line => `- ${line}`).join('\n')}`),
    'REQUEST STATUS\nPlease assess this request and confirm the cleaning list, any exclusions, access costs, final price and appointment. This is an enquiry, not a fixed quote or confirmed booking. No payment is taken with this request.',
  ].join('\n\n');
}
