import { WbLink } from './WbChrome';
import { HIGH_PRIORITY, useCarpetHeroPhoto, type WbStill } from './wbMedia';
import { GOOGLE_RATING_ARIA_LABEL, GOOGLE_RATING_LABEL, HAS_VERIFIED_RATING } from '../../data/googleRating';
import { GOOGLE_READ_REVIEWS_LINK } from '../GoogleBrand';
import { CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, STAIRS_FIRST_P, penceToDisplay as gbp } from '../../data/pricing';
import '../../styles/wb-openings.css';

// Carpet opening (Work Behind design, 25 November 2026). One real job photo:
// a single pass of the extraction tool, the cleaned lane green, the rest of
// the carpet still grey with soil. The headline says what the customer can see
// in it, and stays true for any carpet photo published from CRM Media
// ("Carpet cleaning · Opening photograph", service-carpet-hero). The useful
// room prices and the visit minimum sit together, and "Get my price" lands on
// the calculator's first step, where rooms are chosen.

const LANE = '/images/work-behind/carpet-lane';
const LANE_PHOTO: WbStill = {
  src: `${LANE}-1080.webp`,
  srcSet: `${LANE}-480.webp 480w, ${LANE}-720.webp 720w, ${LANE}-1080.webp 1080w`,
  alt: 'An extraction tool part-way across a patterned carpet: the lane behind it is clean green, the carpet either side still dull grey with soil',
  caption: 'One pass of hot-water extraction. The green lane is cleaned; the grey either side is still waiting.',
};
const ROOMS = [
  ['Bedroom', gbp(CARPET_ITEM_PRICES_P.bedroom)],
  ['Living or dining room', gbp(CARPET_ITEM_PRICES_P.living_room)],
  ['Hallway', gbp(CARPET_ITEM_PRICES_P.hallway)],
  ['Stairs, first flight', gbp(STAIRS_FIRST_P)],
] as const;
const MINIMUM = gbp(CARPET_MIN_BOOKING_P);

function Rating() {
  return HAS_VERIFIED_RATING
    ? <a className="wb-rating" href={GOOGLE_READ_REVIEWS_LINK} target="_blank" rel="noopener noreferrer" aria-label={GOOGLE_RATING_ARIA_LABEL}>{GOOGLE_RATING_LABEL}</a>
    : null;
}

export function CarpetOpening() {
  const photo = useCarpetHeroPhoto(LANE_PHOTO);
  return (
    <section className="wbo-carpet" aria-labelledby="wbo-carpet-title">
      <div className="wbo-carpet__in">
        <div className="wbo-carpet__head">
          <h1 id="wbo-carpet-title" className="wbo-h1"><span className="wbo-kick">Carpet cleaning London</span> Watch the colour come back.</h1>
          <p className="wbo-price wbo-carpet__first wbo-narrow">Bedroom {gbp(CARPET_ITEM_PRICES_P.bedroom)} · Minimum visit {MINIMUM}</p>
        </div>

        <figure className="wbo-carpet__ph">
          <img src={photo.src} srcSet={photo.srcSet} sizes={photo.srcSet ? '(max-width: 1000px) 100vw, 46vw' : undefined} alt={photo.alt} {...HIGH_PRIORITY} />
          <figcaption>{photo.caption}</figcaption>
        </figure>

        <div className="wbo-carpet__board">
          <table className="wbo-ladder">
            <caption className="wbo-sheet__h">Room prices</caption>
            <tbody>
              {ROOMS.map(([label, price]) => <tr key={label}><th scope="row">{label}</th><td>{price}</td></tr>)}
              <tr className="wbo-ladder__min"><th scope="row">Minimum visit</th><td>{MINIMUM}</td></tr>
            </tbody>
          </table>
          <p className="wbo-fine">One bedroom on its own costs the {MINIMUM} minimum. Carpets, sofas and mattresses all count towards it. Every price is in the calculator.</p>
          <div className="wb-acts"><WbLink className="wb-btn" href="#quote-start">Get my price</WbLink><Rating /></div>
        </div>
      </div>
    </section>
  );
}
