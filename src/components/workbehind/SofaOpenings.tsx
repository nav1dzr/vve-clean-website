import { LayoutImg, WbLink } from './WbChrome';
import { HIGH_PRIORITY, useSofaHeroItem, useSofaHeroPhoto, type WbStill } from './wbMedia';
import { GOOGLE_RATING_ARIA_LABEL, GOOGLE_RATING_LABEL, HAS_VERIFIED_RATING } from '../../data/googleRating';
import { GOOGLE_READ_REVIEWS_LINK } from '../GoogleBrand';
import { CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, penceToDisplay as gbp } from '../../data/pricing';
import { SOFA_BEFORE_AFTER } from '../../data/sofaMedia';
import '../../styles/wb-openings.css';

// Sofa & Upholstery opening chosen on 23 November 2026: the same cushion
// before and after on phones and tablets, the half-cleaned velvet close-up on
// desktop. The first prices and the visit minimum sit together in both. Both
// photos read the sofa CRM hero position (service-sofa-hero): a published
// before-and-after replaces the pair, and its "after" photo (or a published
// single photo) replaces the desktop close-up.

const FIRST_PRICES = `3-seater ${gbp(CARPET_ITEM_PRICES_P.sofa_3)} · Armchair ${gbp(CARPET_ITEM_PRICES_P.armchair)} · Minimum visit ${gbp(CARPET_MIN_BOOKING_P)}`;
const ITEMS = [
  ['Armchair', gbp(CARPET_ITEM_PRICES_P.armchair)],
  ['2-seater sofa', gbp(CARPET_ITEM_PRICES_P.sofa_2)],
  ['3-seater sofa', gbp(CARPET_ITEM_PRICES_P.sofa_3)],
  ['Corner sofa', `from ${gbp(CARPET_ITEM_PRICES_P.sofa_corner)}`],
] as const;
const MINIMUM = `A 2-seater on its own costs the ${gbp(CARPET_MIN_BOOKING_P)} minimum. Sofas, chairs, mattresses and carpets all count towards it.`;
const CARE = 'We test the fabric and dye first. Fabric upholstery only, not leather.';
const STRIPE: WbStill = {
  src: '/sofa_upholstery/web/gallery/sofa-gallery-10.webp',
  alt: 'An extraction tool part-way across a blue velvet seat cushion; the strip it has passed over is visibly lighter and brighter',
  caption: 'Blue velvet seat, part-way through. The lighter strip is where the tool has already been.',
};
const SEAT = SOFA_BEFORE_AFTER[0];
// Phone-sized copies of the built-in pair (the originals are 1350px, up to 686 KB).
const sized = (name: string) => [480, 640, 800].map(w => `/images/work-behind/${name}-${w}.webp ${w}w`).join(', ');
const SEAT_SRCSET = { before: sized('sofa-seat-before'), after: sized('sofa-seat-after') };
const PAIR_SIZES = '(max-width: 1000px) 50vw, 1px';

function Rating() {
  return HAS_VERIFIED_RATING
    ? <a className="wb-rating" href={GOOGLE_READ_REVIEWS_LINK} target="_blank" rel="noopener noreferrer" aria-label={GOOGLE_RATING_ARIA_LABEL}>{GOOGLE_RATING_LABEL}</a>
    : null;
}

export function SofaOpening() {
  const managed = useSofaHeroItem();
  const pair = managed?.type === 'before-after' ? managed : SEAT;
  const stripe = useSofaHeroPhoto(STRIPE);
  return (
    <section className="wbo-sofa" aria-labelledby="wbo-sofa-title">
      <div className="wbo-sofa__stage">
        <div className="wbo-sofa__head">
          <h1 id="wbo-sofa-title" className="wbo-h1">
            <span className="wbo-kick">Sofa &amp; upholstery cleaning</span>{' '}
            <span className="wbo-narrow">Same cushion, before and after.</span>
            <span className="wbo-wide">Fabric checked, then deep-cleaned.</span>
          </h1>
          <p className="wbo-price wbo-sofa__first wbo-narrow">{FIRST_PRICES}</p>
        </div>

        {/* Each layout downloads only its own opening photos (LayoutImg), and loads them first. */}
        <figure className="wbo-sofa__pair wbo-narrow">
          <div className="wbo-sofa__two">
            <div className="wb-fig"><LayoutImg only="narrow" src={pair.before} srcSet={pair === SEAT ? SEAT_SRCSET.before : undefined} sizes={pair === SEAT ? PAIR_SIZES : undefined} alt={pair.beforeAlt} {...HIGH_PRIORITY} /><span className="wb-tape">{pair.beforeLabel ?? 'Before'}</span></div>
            <div className="wb-fig"><LayoutImg only="narrow" src={pair.after} srcSet={pair === SEAT ? SEAT_SRCSET.after : undefined} sizes={pair === SEAT ? PAIR_SIZES : undefined} alt={pair.afterAlt} {...HIGH_PRIORITY} /><span className="wb-tape">{pair.afterLabel ?? 'After'}</span></div>
          </div>
          <figcaption>{pair === SEAT ? 'Dried spill rings on a taupe seat cushion, then the same cushion after hot-water extraction.' : pair.label}</figcaption>
        </figure>
        <LayoutImg only="wide" className="wbo-sofa__stripe wbo-wide" src={stripe.src} srcSet={stripe.srcSet} alt={stripe.alt} {...HIGH_PRIORITY} />

        <div className="wbo-sofa__pitch">
          <p className="wbo-price wbo-wide">{FIRST_PRICES}</p>
          <table className="wbo-ladder wbo-narrow">
            <tbody>
              {ITEMS.map(([label, price]) => <tr key={label}><th scope="row">{label}</th><td>{price}</td></tr>)}
              <tr className="wbo-ladder__min"><th scope="row">Minimum visit</th><td>{gbp(CARPET_MIN_BOOKING_P)}</td></tr>
            </tbody>
          </table>
          <div className="wbo-sofa__terms">
            <p>{MINIMUM}</p>
            <p className="wbo-fine">{CARE}</p>
          </div>
          <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink><Rating /></div>
        </div>
      </div>
      <div className="wb-under wbo-wide"><div className="wb-w">{stripe.caption}</div></div>
    </section>
  );
}
