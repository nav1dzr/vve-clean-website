import { Link } from 'react-router-dom';
import { BookingProvider } from '../context/BookingContext';
import QuoteCalculator from '../components/QuoteCalculator';
import LazyVideo from '../components/media/LazyVideo';
import ManagedServiceMedia from '../components/media/ManagedServiceMedia';
import { WbDock, WbFooter, WbHeader, WbLink, WbPage, WB_PHONE_DISPLAY, WB_PHONE_HREF } from '../components/workbehind/WbChrome';
import { CarpetOpening } from '../components/workbehind/CarpetOpening';
import { FAQS, SCHEMA } from '../data/carpetContent';
import { CARPET_FEATURED_BEFORE_AFTER } from '../data/galleryMedia';
import { CARPET_PROCESS_VIDEO, CARPET_RESULT_VIDEOS } from '../data/carpetMedia';
import { useResolvedWebsiteMedia } from '../lib/websiteMediaPositions';
import { BOOKING_REQUEST_NOTE, VAT_NOTE } from '../data/businessPolicy';
import { REVIEWS } from '../data/reviews';
import { CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, STAIRS_EXTRA_P, STAIRS_FIRST_P, penceToDisplay as gbp } from '../data/pricing';

// Carpet Cleaning London in "The Work Behind" design. The quote is the
// existing carpet calculator (same prices, minimum, bundle discount and booking
// handoff), re-themed through .wb-legacy. FAQ text and schema come from
// carpetContent.ts. Results keep their CRM positions, their job clips and the
// CRM-published extra media for this page (carpet-main-results).

// A short, factual note for each built-in pair, taken from what the photos show.
const PAIR_NOTES: Record<string, string> = {
  'carpet-brown': 'Heavy staining through the middle of the room, lifted by extraction.',
  'carpet-blue': 'Dull and patchy with debris before; an even, deep blue after.',
  'carpet-office': 'Traffic marks and spills between the desks, gone after hot-water extraction.',
};
const PAIR_ORDER = ['carpet-brown', 'carpet-blue', 'carpet-office'];
// Smaller web copies of the built-in result photos. A photo replaced in CRM keeps its own file.
const webCopy = (src: string) => {
  const match = src.match(/^\/carpet\/before-after\/web\/carpet-(\w+-(?:before|after))\.jpg$/);
  return match ? `/images/work-behind/carpet-${match[1]}-640.webp 640w, ${src} 1600w` : undefined;
};
const PAIR_SIZES = '(max-width: 1000px) 50vw, 21vw';

const INCLUDED = [
  'A look at the fibre and the marks first, with an honest view on what will lift',
  'Pre-treatment on heavy soiling and stains',
  'Hot-water extraction where the fibre and construction suit it',
  'Grooming afterwards to set the pile',
  'Furniture slides to protect floors while we work',
  'All equipment and cleaning products supplied',
];
const ALL_PRICES = [
  ['Bedroom', gbp(CARPET_ITEM_PRICES_P.bedroom)],
  ['Living or dining room', gbp(CARPET_ITEM_PRICES_P.living_room)],
  ['Large or through lounge', gbp(CARPET_ITEM_PRICES_P.large_lounge)],
  ['Hallway', gbp(CARPET_ITEM_PRICES_P.hallway)],
  ['Landing', gbp(CARPET_ITEM_PRICES_P.landing)],
  ['Stairs, first flight', gbp(STAIRS_FIRST_P)],
  ['Stairs, each extra flight', gbp(STAIRS_EXTRA_P)],
  ['Rug', 'Add-on, photo quote'],
] as const;
const CARPET_REVIEWS = REVIEWS.filter(review => /carpet/i.test(review.service)).slice(0, 3);

export default function WorkBehindCarpetPage() {
  const resolved = useResolvedWebsiteMedia(CARPET_FEATURED_BEFORE_AFTER);
  const pairs = [...resolved].sort((a, b) => PAIR_ORDER.indexOf(a.id) - PAIR_ORDER.indexOf(b.id));

  return (
    <BookingProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SCHEMA }} />
      <WbPage>
        <WbHeader ctaHref="#quote-start" />
        <main id="main-content">
          <CarpetOpening />

          <div className="wb-legacy"><QuoteCalculator mode="carpet" /></div>

          <section className="wb-sec wb-sec--mist" id="results" aria-labelledby="wb-carpet-results">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-carpet-results">Three carpets, before and after</h2>
              <p className="wb-sub">Our own photos from recent jobs.</p>
              <div className="wbc-results">
                {pairs.map(pair => {
                  const clip = CARPET_RESULT_VIDEOS.find(video => video.pairedWith === pair.id);
                  return (
                    <figure className="wb-fig wb-pair" key={pair.id}>
                      <div className="wb-two">
                        <div className="wb-fig"><img src={pair.before} srcSet={webCopy(pair.before)} sizes={PAIR_SIZES} alt={pair.beforeAlt} loading="lazy" decoding="async" /><span className="wb-tape">{pair.beforeLabel ?? 'Before'}</span></div>
                        <div className="wb-fig"><img src={pair.after} srcSet={webCopy(pair.after)} sizes={PAIR_SIZES} alt={pair.afterAlt} loading="lazy" decoding="async" /><span className="wb-tape">{pair.afterLabel ?? 'After'}</span></div>
                      </div>
                      <figcaption>
                        <p><b>{pair.label}</b>{PAIR_NOTES[pair.id] ?? ''}</p>
                        {clip && (
                          <details className="wbc-clip">
                            <summary>Watch: {clip.label}</summary>
                            <div><LazyVideo video={clip} className="aspect-[3/4] w-full" /></div>
                          </details>
                        )}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
              <div className="wb-legacy"><ManagedServiceMedia pageKey="carpet-main-results" /></div>
              <Link className="wb-link" to="/gallery" style={{ marginTop: 16 }}>See more of our work</Link>
            </div>
          </section>

          <section className="wb-sec wb-sec--carpet" id="process" aria-labelledby="wb-carpet-process">
            <div className="wb-w wbc-process">
              <div>
                <h2 className="wb-h2" id="wb-carpet-process">How we clean your carpets</h2>
                {CARPET_PROCESS_VIDEO && <div style={{ marginTop: 24 }}><LazyVideo video={CARPET_PROCESS_VIDEO} className="aspect-video w-full" /></div>}
              </div>
              <div>
                <ul className="wb-list">{INCLUDED.map(item => <li key={item}>{item}</li>)}</ul>
                <p className="wb-cap" style={{ color: '#d5e2f5' }}>£5m public liability insurance. <Link to="/how-we-clean-carpets" style={{ color: '#fff' }}>The full method</Link></p>
              </div>
            </div>
          </section>

          {CARPET_REVIEWS.length > 0 && (
            <section className="wb-sec" aria-labelledby="wb-carpet-said">
              <div className="wb-w">
                <h2 className="wb-h2" id="wb-carpet-said">What customers wrote</h2>
                <div className="wb-quotes">
                  {CARPET_REVIEWS.map(review => <blockquote key={review.name}><p>“{review.text}”</p><cite>{review.name}, {review.location}{/\d{4}/.test(review.date) ? `. ${review.date}` : ''}</cite></blockquote>)}
                </div>
              </div>
            </section>
          )}

          <section className="wb-sec wb-sec--mist" id="prices" aria-labelledby="wb-carpet-prices">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-carpet-prices">Every carpet price</h2>
              <p className="wb-sub">Minimum visit {gbp(CARPET_MIN_BOOKING_P)}, shared with sofas and mattresses. {VAT_NOTE}</p>
              <table className="wb-table">
                <caption>The calculator applies the current carpet and upholstery bundle discount automatically, subject to the minimum. Any agreed access costs are separate.</caption>
                <tbody>{ALL_PRICES.map(([label, price]) => <tr key={label}><th scope="row">{label}</th><td>{price}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="wb-sec" id="faq" aria-labelledby="wb-carpet-faq">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-carpet-faq">Questions</h2>
              <div className="wb-faq">
                {FAQS.map(faq => <details key={faq.q}><summary>{faq.q}</summary><p>{faq.a}</p></details>)}
              </div>
            </div>
          </section>

          <section className="wb-sec wb-sec--carpet wb-last" aria-labelledby="wb-carpet-last">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-carpet-last">Carpets due a clean?</h2>
              <p className="wb-sub">{BOOKING_REQUEST_NOTE}</p>
              <div className="wb-acts"><WbLink className="wb-btn" href="#quote-start">Get my price</WbLink></div>
              <a className="wb-last__tel" href={WB_PHONE_HREF}>{WB_PHONE_DISPLAY}</a>
            </div>
          </section>
        </main>
        <WbFooter />
        <WbDock quoteHref="#quote-start" />
      </WbPage>
    </BookingProvider>
  );
}
