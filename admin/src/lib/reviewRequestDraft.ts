import { GOOGLE_REVIEW_BUTTON, GOOGLE_REVIEW_URL } from '../../../shared/googleReview.js';

export { GOOGLE_REVIEW_URL };

export function reviewRequestDraft(name: string) {
  // Keep the supplied name, including initials and surname. Never guess a title.
  const recipientName = name.trim().replace(/\s+/g, ' ');
  return {
    subject: 'How was your clean with VVE Clean?',
    style: 'branded' as const,
    body: [
      recipientName ? `Hi ${recipientName},` : 'Hello,',
      'Thank you for choosing VVE Clean. If you have a moment, please share your experience on Google. Your honest feedback helps other customers decide whether we are right for them.',
      GOOGLE_REVIEW_BUTTON,
      'Thank you for your time.',
      'Kind regards,\nThe VVE Clean team',
    ].join('\n\n'),
  };
}

export function containsReviewLink(body: string) {
  return body.includes(GOOGLE_REVIEW_URL);
}

export function hasReviewRecipient(recipient: string) {
  return /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient.trim());
}
