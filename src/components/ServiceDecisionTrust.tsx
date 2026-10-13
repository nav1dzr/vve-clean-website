import GoogleBadge from './GoogleBadge';
import { DEPOSIT_P, EOT_GUARANTEE_HOURS, penceToDisplay } from '../data/pricing';
import { CARPET_ITEM_DEFS, type CarpetCounts } from '../data/carpetPricing';

type CheckedReview = {
  verified: true;
  name: string;
  text: string;
  sourceUrl: string;
  checkedAt: string;
};

// Supply a review only after checking its original source and permissions.
// No record is automatically marked verified by this presentation component.
export default function ServiceDecisionTrust({ service, carpetCounts, eotPackage, review }: {
  service: 'carpet' | 'sofa' | 'carpet-upholstery' | 'eot' | 'other';
  carpetCounts?: CarpetCounts;
  eotPackage?: 'complete' | 'tailored';
  review?: CheckedReview;
}) {
  // Combined quotes use the selected items, not the landing-page label. A sofa
  // quote can include carpets, and returning to it must keep the proof accurate.
  const hasCarpet = CARPET_ITEM_DEFS.some(item => item.group === 'Carpets' && (carpetCounts?.[item.key] ?? 0) > 0);
  const hasUpholstery = CARPET_ITEM_DEFS.some(item => item.group === 'Sofas & Upholstery' && (carpetCounts?.[item.key] ?? 0) > 0);
  const context = service === 'carpet-upholstery'
    ? hasCarpet && !hasUpholstery ? 'carpet' : hasUpholstery && !hasCarpet ? 'sofa' : service
    : service;
  const reassurance = context === 'eot'
    ? `${EOT_GUARANTEE_HOURS / 24}-day reporting window on ${eotPackage === 'tailored' ? 'selected tasks' : 'the agreed checklist'}. One free return for covered missed work.`
    : context === 'carpet'
      ? 'We check the carpet fibres and condition before treatment, and explain any marks that may remain.'
      : context === 'sofa'
        ? 'We check the fabric and test a small area before treatment, and explain any limitations before cleaning.'
        : context === 'carpet-upholstery'
          ? 'We check carpet fibres and upholstery fabrics before treatment, and explain any marks that may remain.'
          : null;
  return (
    <aside aria-label="Before you send your request" className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
      <GoogleBadge />
      {reassurance && <p className="mt-3 text-sm leading-relaxed text-slate-700">{reassurance}</p>}
      {service === 'eot' && <a href="/end-of-tenancy-cleaning-london#guarantee" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-royal-800 underline underline-offset-4">Re-clean terms<span className="sr-only"> (opens in a new tab)</span></a>}
      <p className="mt-3 text-sm leading-relaxed text-navy-950"><strong>No payment to send your request.</strong> We review your request and agree the details before emailing your {penceToDisplay(DEPOSIT_P)} deposit options. The deposit comes off your total. Your booking is confirmed once the deposit is paid.</p>
      {review?.verified === true && (
        <figure className="mt-4 border-t border-sky-200 pt-4">
          <blockquote className="text-sm leading-relaxed text-navy-950">{review.text}</blockquote>
          <figcaption className="mt-2 text-sm text-slate-600">
            {review.name} · <a href={review.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-royal-800 underline underline-offset-4">Read the original review</a>
            <span className="mt-1 block">Source checked {review.checkedAt}</span>
          </figcaption>
        </figure>
      )}
    </aside>
  );
}
