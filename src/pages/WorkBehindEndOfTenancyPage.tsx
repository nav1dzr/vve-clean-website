import { Link, useSearchParams } from 'react-router-dom';
import { BookingProvider } from '../context/BookingContext';
import QuoteCalculator from '../components/QuoteCalculator';
import GuaranteeTerms from '../components/GuaranteeTerms';
import { WbDock, WbFooter, WbHeader, WbLink, WbPage, WB_PHONE_DISPLAY, WB_PHONE_HREF } from '../components/workbehind/WbChrome';
import { EotOpeningCheckout, EotOpeningRooms } from '../components/workbehind/EotOpenings';
import { EOT_SIZES, FAQS, SCHEMA } from '../data/endOfTenancyContent';
import { EOT_FEATURED_BEFORE_AFTER } from '../data/galleryMedia';
import { useResolvedWebsiteMedia } from '../lib/websiteMediaPositions';
import { BOOKING_REQUEST_NOTE, CONDITIONAL_DEPOSIT_NOTE, VAT_NOTE } from '../data/businessPolicy';
import { REVIEWS } from '../data/reviews';
import {
  EOT_TAILORED_START_PRICES_P, EOT_EXTRA_BATH_P, EOT_EXTRA_WC_P,
  penceToDisplay as gbp,
} from '../data/pricing';

// End of Tenancy in "The Work Behind" design. The quote is the existing
// End of Tenancy wizard (same prices, same booking handoff); only its look is
// re-themed through .wb-legacy. FAQ text and schema come from one shared
// module, so the visible answers and the structured data cannot drift.
const INCLUDED = [
  'Oven, hob, grill and extractor',
  'Microwave, emptied fridge/freezer, dishwasher and washing-machine interiors',
  'Inside all cupboards, drawers and wardrobes',
  'Bathrooms cleaned and descaled',
  'Accessible internal windows',
  'Skirting boards, switches and door frames',
];
const TENANCY_REVIEWS = REVIEWS.filter(review => /tenancy/i.test(review.service) || /end of tenancy/i.test(review.text)).slice(0, 3);

export default function WorkBehindEndOfTenancyPage() {
  // Design comparison only: ?opening=b shows the second candidate opening.
  const [params] = useSearchParams();
  const opening = params.get('opening') === 'b' ? 'b' : 'a';
  const pairs = useResolvedWebsiteMedia(EOT_FEATURED_BEFORE_AFTER);

  return (
    <BookingProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SCHEMA }} />
      <WbPage>
        <WbHeader ctaHref="#quote" />
        <main id="main-content">
          {opening === 'b' ? <EotOpeningCheckout included={INCLUDED} /> : <EotOpeningRooms />}

          {opening !== 'b' && (
            <section className="wb-sec" id="prices" aria-labelledby="wb-eot-prices">
              <div className="wb-w">
                <h2 className="wb-h2" id="wb-eot-prices">Fixed prices</h2>
                <p className="wb-sub">Complete clean, vacant flat, one bathroom. {VAT_NOTE}</p>
                <table className="wb-table">
                  <caption>Each extra bathroom +{gbp(EOT_EXTRA_BATH_P)}. Each separate WC +{gbp(EOT_EXTRA_WC_P)}. Houses, Tailored (from {gbp(EOT_TAILORED_START_PRICES_P.studio)}) and 5+ bedrooms are priced in the quote below.</caption>
                  <tbody>{EOT_SIZES.map(([label, pence]) => <tr key={label}><th scope="row">{label}</th><td>{gbp(pence)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          <div className="wb-legacy"><QuoteCalculator mode="eot" /></div>

          <section className="wb-sec wb-sec--mist" id="results" aria-labelledby="wb-eot-results">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-eot-results">Our move-out cleans</h2>
              <div className="wb-pairs">
                {pairs.map(pair => pair.type === 'before-after' && (
                  <figure className="wb-fig wb-pair" key={pair.id}>
                    <div className="wb-two">
                      <div className="wb-fig"><img src={pair.before} alt={pair.beforeAlt} loading="lazy" decoding="async" /><span className="wb-tape">Before</span></div>
                      <div className="wb-fig"><img src={pair.after} alt={pair.afterAlt} loading="lazy" decoding="async" /><span className="wb-tape">After</span></div>
                    </div>
                    <figcaption><p><b>{pair.label}</b></p></figcaption>
                  </figure>
                ))}
              </div>
              <Link className="wb-link" to="/gallery" style={{ marginTop: 16 }}>See more of our work</Link>
            </div>
          </section>

          <section className="wb-sec" aria-labelledby="wb-eot-included">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-eot-included">What Complete includes</h2>
              <ul className="wb-list">{INCLUDED.map(item => <li key={item}>{item}</li>)}</ul>
              <p className="wb-cap">Carpet cleaning, upholstery, outside windows, balconies and rubbish removal are paid extras. <Link to="/how-we-clean-end-of-tenancy">See the full checklist</Link></p>
            </div>
          </section>

          <section className="wb-sec wb-sec--carpet" aria-labelledby="wb-eot-steps">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-eot-steps">From request to confirmed visit</h2>
              <ol className="wb-steps">
                <li><b>1</b><h3>Send your request</h3><p>Choose your property and a time. No payment is taken.</p></li>
                <li><b>2</b><h3>We agree the job</h3><p>We confirm the work, price and arrival time with you.</p></li>
                <li><b>3</b><h3>We confirm by email</h3><p>{CONDITIONAL_DEPOSIT_NOTE}</p></li>
              </ol>
            </div>
          </section>

          {TENANCY_REVIEWS.length > 0 && (
            <section className="wb-sec" aria-labelledby="wb-eot-said">
              <div className="wb-w">
                <h2 className="wb-h2" id="wb-eot-said">What tenants wrote</h2>
                <div className="wb-quotes">
                  {TENANCY_REVIEWS.map(review => <blockquote key={review.name}><p>“{review.text}”</p><cite>{review.name}, {review.location}. {review.date}</cite></blockquote>)}
                </div>
              </div>
            </section>
          )}

          <div className="wb-legacy"><GuaranteeTerms /></div>

          <section className="wb-sec" id="faq" aria-labelledby="wb-eot-faq">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-eot-faq">Questions</h2>
              <div className="wb-faq">
                {FAQS.map(faq => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}
              </div>
            </div>
          </section>

          <section className="wb-sec wb-sec--carpet wb-last" aria-labelledby="wb-eot-last">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-eot-last">Moving out?</h2>
              <p className="wb-sub">{BOOKING_REQUEST_NOTE}</p>
              <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink></div>
              <a className="wb-last__tel" href={WB_PHONE_HREF}>{WB_PHONE_DISPLAY}</a>
            </div>
          </section>
        </main>
        <WbFooter />
        <WbDock quoteHref="#quote" watch="#quote" />
      </WbPage>
    </BookingProvider>
  );
}
