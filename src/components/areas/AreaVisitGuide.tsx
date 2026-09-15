import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { AREAS, type AreaInfo } from '../../data/areas';
import { BOOKING_REQUEST_NOTE } from '../../data/businessPolicy';

/** Practical visit details use confirmed coverage, without inventing local jobs. */
export default function AreaVisitGuide({ area }: { area: AreaInfo }) {
  const covered = area.coverageConfirmed !== false;
  const nearbyPages = AREAS.filter((entry) =>
    entry.coverageConfirmed !== false && area.neighbourAreas.includes(entry.name),
  );
  const whatsapp = `https://wa.me/447845451111?text=${encodeURIComponent(`Hi VVE Clean, I would like to check cleaning availability in ${area.name}. My full postcode is `)}`;

  return (
    <section className="px-4 py-12 sm:py-16" aria-labelledby={`${area.slug}-visit-heading`}>
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-sky-50 p-6 sm:p-8">
            <MapPin className="mb-4 h-6 w-6 text-royal-700" aria-hidden="true" />
            <h2 id={`${area.slug}-visit-heading`} className="font-display text-2xl font-bold leading-tight text-navy-900 sm:text-3xl">
              {covered ? `Planning a clean in ${area.name}` : `Check your ${area.name} postcode`}
            </h2>
            {covered ? (
              <>
                <p className="mt-4 text-sm leading-relaxed text-slate-700">Our published postcode districts for {area.name}:</p>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${area.name} postcode districts`}>
                  {area.postcodes.map((postcode) => (
                    <li key={postcode} className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-navy-900">{postcode}</li>
                  ))}
                </ul>
                <p className="mt-4 text-sm leading-relaxed text-slate-700">Send your full postcode and preferred date so we can check your visit.</p>
              </>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-slate-700">{area.name} is outside our currently published postcode list. Send your full postcode and the service you need before making a booking request.</p>
            )}
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="whatsapp-text-link mt-4 inline-flex min-h-[44px] items-center gap-2 font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              Check my postcode on WhatsApp
            </a>
          </div>
          <div className="p-6 sm:p-8">
            <h3 className="font-display text-xl font-bold text-navy-900">Tell us about access</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">Include the floor, lift or stair access, and where we can park with the cleaning equipment. For a move-out clean, tell us who will provide the keys.</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{covered ? 'We use the same published service prices across our confirmed coverage area. ' : ''}Any applicable parking or Congestion Charge is shown separately and agreed before the appointment.</p>
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="font-display text-lg font-bold text-navy-900">{covered ? 'How we confirm your visit' : 'Once we have checked availability'}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{BOOKING_REQUEST_NOTE}</p>
            </div>
          </div>
        </div>
        {nearbyPages.length > 0 && (
          <nav aria-label={`Covered areas near ${area.name}`} className="border-t border-slate-200 px-6 py-4 sm:px-8">
            <p className="text-sm font-semibold text-navy-900">Nearby areas we cover</p>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {nearbyPages.map((nearby) => (
                <li key={nearby.slug}><Link to={`/cleaning-${nearby.slug}`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-royal-700 underline underline-offset-4 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{nearby.name}</Link></li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  );
}