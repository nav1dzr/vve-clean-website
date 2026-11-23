import { WbLink } from './WbChrome';
import { HIGH_PRIORITY, useSofaHeroItem, useSofaHeroPhoto, type WbStill } from './wbMedia';
import { GOOGLE_RATING_ARIA_LABEL, GOOGLE_RATING_LABEL, HAS_VERIFIED_RATING } from '../../data/googleRating';
import { GOOGLE_READ_REVIEWS_LINK } from '../GoogleBrand';
import { CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, penceToDisplay as gbp } from '../../data/pricing';
import { SOFA_BEFORE_AFTER } from '../../data/sofaMedia';
import '../../styles/wb-openings.css';

// Two candidate openings for the Sofa & Upholstery page (design comparison,
// 23 November 2026). Both use VVE's own job photographs and the live item
// prices; the visit minimum is spelled out with a worked example. Both read the
// page's CRM hero position, so a photo published in CRM Media still takes over.

const ITEMS = [
  ['Armchair', gbp(CARPET_ITEM_PRICES_P.armchair)],
  ['2-seater sofa', gbp(CARPET_ITEM_PRICES_P.sofa_2)],
  ['3-seater sofa', gbp(CARPET_ITEM_PRICES_P.sofa_3)],
  ['Corner sofa', `from ${gbp(CARPET_ITEM_PRICES_P.sofa_corner)}`],
] as const;
const MINIMUM = `Minimum visit ${gbp(CARPET_MIN_BOOKING_P)}, so a 2-seater on its own costs ${gbp(CARPET_MIN_BOOKING_P)}. Sofas, chairs, mattresses and carpets all count towards it.`;
const STRIPE: WbStill = {
  src: '/sofa_upholstery/web/gallery/sofa-gallery-10.webp',
  alt: 'An extraction tool part-way across a blue velvet seat cushion; the strip it has passed over is visibly lighter and brighter',
  caption: 'Blue velvet seat, part-way through. The lighter strip is where the tool has already been.',
};
const SEAT = SOFA_BEFORE_AFTER[0];

function Rating() {
  return HAS_VERIFIED_RATING
    ? <a className="wb-rating" href={GOOGLE_READ_REVIEWS_LINK} target="_blank" rel="noopener noreferrer" aria-label={GOOGLE_RATING_ARIA_LABEL}>{GOOGLE_RATING_LABEL}</a>
    : null;
}

/** A: the clean line. One close-up of extraction, the fabric filling the frame. */
export function SofaOpeningLine() {
  const photo = useSofaHeroPhoto(STRIPE);
  return (
    <section className="wbo-line" aria-labelledby="wbo-sofa-title">
      <div className="wbo-line__stage">
        <div className="wbo-line__head">
          <h1 id="wbo-sofa-title" className="wbo-h1"><span className="wbo-kick">Sofa &amp; upholstery cleaning</span> Fabric checked, then deep-cleaned.</h1>
          <p className="wbo-price wbo-line__price">3-seater {gbp(CARPET_ITEM_PRICES_P.sofa_3)} · Armchair {gbp(CARPET_ITEM_PRICES_P.armchair)}</p>
        </div>
        <img className="wbo-line__img" src={photo.src} srcSet={photo.srcSet} alt={photo.alt} {...HIGH_PRIORITY} />
        <div className="wbo-line__pitch">
          <p className="wbo-price">3-seater {gbp(CARPET_ITEM_PRICES_P.sofa_3)} · Armchair {gbp(CARPET_ITEM_PRICES_P.armchair)}</p>
          <div className="wbo-line__terms">
            <p>{MINIMUM}</p>
            <p className="wbo-fine">We test the fabric and dye first. Fabric upholstery only, not leather.</p>
          </div>
          <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink><Rating /></div>
        </div>
      </div>
      <div className="wb-under"><div className="wb-w">{photo.caption}</div></div>
    </section>
  );
}

/** B: same cushion, before and after. The evidence first, the prices beside it. */
export function SofaOpeningPair() {
  const managed = useSofaHeroItem();
  const pair = managed?.type === 'before-after' ? managed : SEAT;
  return (
    <section className="wbo-pair" aria-labelledby="wbo-sofa-title">
      <div className="wbo-pair__in">
        <div className="wbo-pair__head">
          <h1 id="wbo-sofa-title" className="wbo-h1"><span className="wbo-kick">Sofa &amp; upholstery cleaning</span> Same cushion, before and after.</h1>
        </div>
        <figure className="wbo-pair__ph">
          <div className="wbo-pair__two">
            <div className="wb-fig"><img src={pair.before} alt={pair.beforeAlt} {...HIGH_PRIORITY} /><span className="wb-tape">{pair.beforeLabel ?? 'Before'}</span></div>
            <div className="wb-fig"><img src={pair.after} alt={pair.afterAlt} {...HIGH_PRIORITY} /><span className="wb-tape">{pair.afterLabel ?? 'After'}</span></div>
          </div>
          <figcaption>{pair === SEAT ? 'Dried spill rings on a taupe seat cushion, then the same cushion after hot-water extraction.' : pair.label}</figcaption>
        </figure>
        <div className="wbo-pair__pitch">
          <table className="wbo-ladder">
            <tbody>{ITEMS.map(([label, price]) => <tr key={label}><th scope="row">{label}</th><td>{price}</td></tr>)}</tbody>
          </table>
          <p className="wbo-fine">{MINIMUM} We test the fabric and dye first. Fabric upholstery only, not leather.</p>
          <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink><Rating /></div>
        </div>
      </div>
    </section>
  );
}
