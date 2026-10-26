import { describe, expect, it } from 'vitest';
import { containsReviewLink, GOOGLE_REVIEW_URL, hasReviewRecipient, reviewRequestDraft } from './reviewRequestDraft';

describe('manual review draft', () => {
  it.each(['P Munt', 'P. Munt', 'Anne Marie Long-Surname'])('preserves the supplied customer name %s', name => {
    const draft = reviewRequestDraft(name);
    expect(draft.body.startsWith(`Hi ${name},`)).toBe(true);
    expect(draft.style).toBe('branded');
    expect(draft.body).toContain(GOOGLE_REVIEW_URL);
    expect(draft.body).not.toMatch(/five.star|5.star|discount|happy|£/i);
  });
  it('does not invent a name for an empty contact', () => {
    expect(reviewRequestDraft('  ').body.startsWith('Hello,')).toBe(true);
  });
  it('recognises the fixed review destination without accepting incomplete recipients', () => {
    expect(containsReviewLink(reviewRequestDraft('P Munt').body)).toBe(true);
    expect(hasReviewRecipient('client@example.com')).toBe(true);
    expect(hasReviewRecipient('contact@')).toBe(false);
    expect(hasReviewRecipient('a@example.com,b@example.com')).toBe(false);
  });
});
