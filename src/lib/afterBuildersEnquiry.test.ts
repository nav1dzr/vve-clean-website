import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AFTER_BUILDERS_DRAFT_KEY, CORE_CLEANING, EXTRA_SERVICES, buildAfterBuildersEnquiryMessage,
  clearAfterBuildersDraft, createAfterBuildersEnquiry, isEnquiryPostcodeValid,
  nonPersonalAfterBuildersChoices, readAfterBuildersDraft, saveAfterBuildersDraft,
} from './afterBuildersEnquiry';

beforeEach(() => { clearAfterBuildersDraft(); localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); clearAfterBuildersDraft(); });

describe('after-builders enquiry summary', () => {
  it('turns unsure defaults into a useful assessed enquiry without a fabricated quote', () => {
    const message = buildAfterBuildersEnquiryMessage(createAfterBuildersEnquiry());
    expect(message).toContain('After-builders cleaning enquiry');
    expect(message).toContain('Cleaning area: Not sure yet');
    expect(message).toContain('No optional services selected.');
    expect(message).toContain('not a fixed quote or confirmed booking');
    CORE_CLEANING.forEach(line => expect(message).toContain(line));
    expect(message).not.toMatch(/£\d|pay now|booking confirmed/i);
  });

  it('preserves requested quantities and notes without pricing them or adding unselected extras', () => {
    const state = { ...createAfterBuildersEnquiry(), postcode: 'e17 3aa', bedrooms: '2', extras: ['carpet', 'windows'] as const, quantities: { carpet: '3', windows: '5', appliances: '2' }, workDetails: 'Kitchen refit.', accessNotes: 'Lift access.' };
    const message = buildAfterBuildersEnquiryMessage({ ...state, extras: [...state.extras] });
    expect(message).toContain('Postcode: E17 3AA');
    expect(message).toContain('Carpet extraction: 3 carpet areas');
    expect(message).toContain('Exterior or specialist window cleaning: 5 windows');
    expect(message).toContain('Project details: Kitchen refit.');
    expect(message).toContain('Access notes: Lift access.');
    expect(message).not.toContain('Appliance interior cleaning');
  });

  it('keeps every allowed answer below the contact API 5,000-character limit', () => {
    const state = createAfterBuildersEnquiry();
    state.extras = Object.keys(EXTRA_SERVICES) as (keyof typeof EXTRA_SERVICES)[];
    state.quantities = Object.fromEntries(state.extras.map(key => [key, '99999']));
    state.assessment = ['dust', 'paint', 'adhesive', 'delicate', 'unsure'];
    state.workDetails = 'a'.repeat(600); state.accessNotes = 'b'.repeat(400);
    state.postcode = 'SW1A 1AA'; state.preferredDate = '2026-11-20';
    expect(buildAfterBuildersEnquiryMessage(state).length).toBeLessThan(5000);
  });

  it.each(['', 'E17', 'E17 3AA', 'SW1A1AA', 'GIR 0AA', 'n1c 4ag'])('allows an unknown, district or full postcode: %s', value => {
    expect(isEnquiryPostcodeValid(value)).toBe(true);
  });
  it.each(['address here', '12345', '<script>', 'E17 3'])('rejects a malformed supplied postcode: %s', value => {
    expect(isEnquiryPostcodeValid(value)).toBe(false);
  });
});

describe('private draft storage', () => {
  it('stores only whitelisted choices, never contact details, postcode, dates or free text', () => {
    const state = { ...createAfterBuildersEnquiry(), propertyType: 'house' as const, postcode: 'E17 3AA', preferredDate: '2026-11-20', workDetails: 'person@example.com', accessNotes: 'Call 07123456789', name: 'Private Name', email: 'person@example.com', phone: '07123456789', address: 'Private address', extras: ['carpet'] as const, quantities: { carpet: '2' } };
    saveAfterBuildersDraft({ ...state, extras: [...state.extras] });
    const raw = localStorage.getItem(AFTER_BUILDERS_DRAFT_KEY)!;
    for (const word of ['postcode', 'preferredDate', 'workDetails', 'accessNotes', 'name', 'email', 'phone', 'address', 'person@example.com']) expect(raw).not.toContain(word);
    expect(readAfterBuildersDraft()).toMatchObject({ propertyType: 'house', extras: ['carpet'], quantities: { carpet: '2' }, postcode: '', preferredDate: '', workDetails: '', accessNotes: '' });
  });

  it('rejects unknown option keys and non-numeric content from stored choices', () => {
    const state = nonPersonalAfterBuildersChoices({ propertyType: 'some-address', extras: ['windows', '__proto__', 'anything'], quantities: { windows: 'person@example.com' }, bedrooms: 'sensitive', floorArea: '<script>', assessment: ['dust', 'bad'] });
    expect(state).toMatchObject({ propertyType: 'unsure', extras: ['windows'], quantities: { windows: '' }, bedrooms: '', floorArea: '', assessment: ['dust'] });
  });

  it('continues safely in memory when browser storage is blocked', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } });
    expect(() => saveAfterBuildersDraft({ ...createAfterBuildersEnquiry(), cleaningArea: 'whole' })).not.toThrow();
    expect(readAfterBuildersDraft().cleaningArea).toBe('whole');
    expect(() => clearAfterBuildersDraft()).not.toThrow();
    expect(readAfterBuildersDraft().cleaningArea).toBe('unsure');
  });

  it('ignores broken, wrong-version and expired stored drafts', () => {
    localStorage.setItem(AFTER_BUILDERS_DRAFT_KEY, '{bad');
    expect(readAfterBuildersDraft()).toEqual(createAfterBuildersEnquiry());
    localStorage.setItem(AFTER_BUILDERS_DRAFT_KEY, JSON.stringify({ version: 2, savedAt: Date.now(), choices: { propertyType: 'house' } }));
    expect(readAfterBuildersDraft().propertyType).toBe('unsure');
    localStorage.setItem(AFTER_BUILDERS_DRAFT_KEY, JSON.stringify({ version: 1, savedAt: Date.now() - 15 * 24 * 60 * 60 * 1000, choices: { propertyType: 'house' } }));
    expect(readAfterBuildersDraft().propertyType).toBe('unsure');
  });
});
