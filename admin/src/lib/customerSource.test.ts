import { describe, expect, it } from 'vitest';
import { customerSourceChoice, customerSourceInput } from './customerSource';
describe('Checkatrade compatibility note', () => {
  it('retains unrelated notes and writes the source once on repeated edits', () => {
    const first = customerSourceInput('checkatrade', 'Original note\nAnother note');
    expect(first).toEqual({ source: 'other', notes: 'Customer source: Checkatrade.\nOriginal note\nAnother note' });
    expect(customerSourceInput('checkatrade', first.notes!)).toEqual(first);
    expect(customerSourceChoice(first.source, first.notes)).toBe('checkatrade');
  });
  it('removes only its exact marker when the owner changes source', () => {
    expect(customerSourceInput('phone', 'Customer source: Checkatrade.\nCustomer mentioned Checkatrade.')).toEqual({ source: 'phone', notes: 'Customer mentioned Checkatrade.' });
    expect(customerSourceChoice('phone', 'Customer source: Checkatrade.')).toBe('phone');
    expect(customerSourceChoice('other', 'Mentioned Checkatrade.')).toBe('other');
  });
});
