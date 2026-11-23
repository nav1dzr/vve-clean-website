import { Link } from 'react-router-dom';
import { BookingProvider } from '../context/BookingContext';
import QuoteCalculator from '../components/QuoteCalculator';
import { WbDock, WbFooter, WbHeader, WbLink, WbPage, WB_PHONE_DISPLAY, WB_PHONE_HREF } from '../components/workbehind/WbChrome';
import { SofaOpening } from '../components/workbehind/SofaOpenings';
import { FAQS, SCHEMA } from '../data/sofaContent';
import { SOFA_BEFORE_AFTER } from '../data/sofaMedia';
import { useResolvedWebsiteMedia } from '../lib/websiteMediaPositions';
import { BOOKING_REQUEST_NOTE } from '../data/businessPolicy';

// Sofa & Upholstery in "The Work Behind" design. The quote is the existing
// upholstery calculator (same prices, same minimum, same booking handoff),
// re-themed through .wb-legacy. FAQ text and schema come from sofaContent.ts.
const INCLUDED = [
  'Fabric and dye-stability test before we start',
  'Pre-treatment on stains and heavily soiled areas',
  'Hot-water extraction where the fabric is suitable',
  'Deodourising treatment as standard',
  'All equipment and cleaning products supplied',
  'A final check of the upholstery and cushions',
];

export default function WorkBehindSofaPage() {
  const pairs = useResolvedWebsiteMedia(SOFA_BEFORE_AFTER);

  return (
    <BookingProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SCHEMA }} />
      <WbPage>
        <WbHeader ctaHref="#quote" />
        <main id="main-content">
          <SofaOpening />

          <div className="wb-legacy"><QuoteCalculator mode="upholstery" /></div>

          <section className="wb-sec wb-sec--mist" id="results" aria-labelledby="wb-sofa-results">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-sofa-results">Sofas we have cleaned</h2>
              <div className="wb-pairs">
                {pairs.map((pair, index) => (
                  // Phones and tablets already saw the first pair at the top of the page.
                  <figure className={`wb-fig wb-pair${index === 0 ? ' wbo-wide' : ''}`} key={pair.id}>
                    <div className="wb-two">
                      <div className="wb-fig"><img src={pair.before} alt={pair.beforeAlt} loading="lazy" decoding="async" /><span className="wb-tape">{pair.beforeLabel ?? 'Before'}</span></div>
                      <div className="wb-fig"><img src={pair.after} alt={pair.afterAlt} loading="lazy" decoding="async" /><span className="wb-tape">{pair.afterLabel ?? 'After'}</span></div>
                    </div>
                    <figcaption><p><b>{pair.label}</b></p></figcaption>
                  </figure>
                ))}
              </div>
              <Link className="wb-link" to="/gallery" style={{ marginTop: 16 }}>See more of our work</Link>
            </div>
          </section>

          <section className="wb-sec" aria-labelledby="wb-sofa-included">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-sofa-included">Every sofa clean includes</h2>
              <ul className="wb-list">{INCLUDED.map(item => <li key={item}>{item}</li>)}</ul>
              <p className="wb-cap">Results depend on the fabric and the stain; we never guarantee complete stain removal. <Link to="/how-we-clean-sofas-upholstery">How we clean upholstery</Link></p>
            </div>
          </section>

          <section className="wb-sec" id="faq" aria-labelledby="wb-sofa-faq">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-sofa-faq">Questions</h2>
              <div className="wb-faq">
                {FAQS.map(faq => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}
              </div>
            </div>
          </section>

          <section className="wb-sec wb-sec--carpet wb-last" aria-labelledby="wb-sofa-last">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-sofa-last">Sofa looking tired?</h2>
              <p className="wb-sub">{BOOKING_REQUEST_NOTE}</p>
              <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink></div>
              <a className="wb-last__tel" href={WB_PHONE_HREF}>{WB_PHONE_DISPLAY}</a>
            </div>
          </section>
        </main>
        <WbFooter />
        <WbDock quoteHref="#quote" />
      </WbPage>
    </BookingProvider>
  );
}
