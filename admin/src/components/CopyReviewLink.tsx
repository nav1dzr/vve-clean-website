import { useState } from 'react';
import { copyToClipboard } from '../lib/format';
import { GOOGLE_REVIEW_URL } from '../lib/reviewRequestDraft';

export default function CopyReviewLink() {
  const [message, setMessage] = useState('');
  async function copy() {
    const copied = await copyToClipboard(GOOGLE_REVIEW_URL);
    setMessage(copied ? 'Review link copied. Nothing has been sent.' : 'Copying is unavailable. Select and copy the link below.');
  }
  return <div>
    <button type="button" onClick={() => void copy()} className="min-h-11 rounded-lg border border-silver-300 px-3.5 text-sm font-medium text-navy-900 hover:bg-silver-100">Copy Google review link</button>
    {message && <p role="status" className="mt-2 text-sm text-navy-700">{message}</p>}
    {message.startsWith('Copying') && <p className="mt-2 break-all text-sm text-navy-900">{GOOGLE_REVIEW_URL}</p>}
  </div>;
}
