import { CheckCircle, XCircle, Shield } from 'lucide-react';
import { EOT_GUARANTEE_HOURS } from '../data/pricing';
import { GUARANTEE_COVERED, GUARANTEE_NOT_COVERED, GUARANTEE_SUMMARY } from '../data/guarantee';

/**
 * The full re-clean guarantee terms, on the page the guarantee belongs to.
 *
 * The homepage carries the promise and the four qualifying conditions; the
 * complete exclusion list lives here (§9: move detailed guarantee exclusions
 * to their relevant page). Both render from src/data/guarantee.ts, so the
 * short and long versions cannot contradict each other.
 *
 * `id="guarantee"` is the anchor the homepage links to.
 */
export default function GuaranteeTerms() {
  return (
    <section id="guarantee" className="scroll-mt-24 bg-surface px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <Shield className="shrink-0 text-royal-500" size={26} aria-hidden="true" />
          <h2 className="font-display text-2xl font-bold text-navy-900 sm:text-3xl">
            {EOT_GUARANTEE_HOURS}-hour re-clean guarantee: the full terms
          </h2>
        </div>

        <p className="mt-4 leading-7 text-muted">{GUARANTEE_SUMMARY}</p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-navy-900">
              <CheckCircle size={17} className="shrink-0 text-green-600" aria-hidden="true" />
              What is covered
            </h3>
            <ul className="mt-4 space-y-2.5">
              {GUARANTEE_COVERED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle size={14} className="mt-1 shrink-0 text-green-600" aria-hidden="true" />
                  <span className="text-sm leading-snug text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-navy-900">
              <XCircle size={17} className="shrink-0 text-muted" aria-hidden="true" />
              What is not covered
            </h3>
            <ul className="mt-4 space-y-2.5">
              {GUARANTEE_NOT_COVERED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <XCircle size={14} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                  <span className="text-sm leading-snug text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-muted">
          The guarantee covers cleaning work only. It does not guarantee that a tenancy deposit
          will be returned, and it does not cover damage, repairs or anything outside the scope of
          the booking you confirmed.
        </p>
      </div>
    </section>
  );
}
