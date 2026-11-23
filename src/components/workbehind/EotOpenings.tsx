import { WbLink } from './WbChrome';
import { HIGH_PRIORITY, WB_PHOTO, useEotHeroPhoto, type WbStill } from './wbMedia';
import { GOOGLE_RATING_ARIA_LABEL, GOOGLE_RATING_LABEL, HAS_VERIFIED_RATING } from '../../data/googleRating';
import { GOOGLE_READ_REVIEWS_LINK } from '../GoogleBrand';
import { EOT_BASE_PRICES_P, EOT_EXTRA_BATH_P, EOT_GUARANTEE_HOURS, penceToDisplay as gbp } from '../../data/pricing';
import { VAT_SHORT_NOTE } from '../../data/businessPolicy';
import { EOT_SIZES } from '../../data/endOfTenancyContent';
import '../../styles/wb-openings.css';

// Two candidate openings for the End of Tenancy page (design comparison,
// 23 November 2026). Both use VVE's own move-out photographs, the live
// catalogue prices and the same "#quote" action; only the composition differs.
// The lead photo in each still reads the CRM hero position, so a photo
// published in CRM Media replaces it.

const DAYS = EOT_GUARANTEE_HOURS / 24;
const HEADLINE_PRICE = `Studio ${gbp(EOT_BASE_PRICES_P.studio)} · 2 bedrooms ${gbp(EOT_BASE_PRICES_P.bed2)}`;
const GUARANTEE = `Tell us within ${DAYS} days if we missed agreed work and we come back once to re-clean it.`;

const EOT = '/end_of_tenancy';
const ROOMS: WbStill[] = [
  { src: `${EOT}/gallery/4.jpg`, alt: 'A mirrored bathroom cabinet after cleaning, reflecting the open door to an empty carpeted bedroom', caption: 'Mirrors and cabinets' },
  { src: `${EOT}/gallery/1.jpg`, alt: 'A black kitchen sink and drainer after cleaning', caption: 'Kitchen sink and drainer' },
  { src: `${EOT}/gallery/10.jpg`, alt: 'A curved shower screen and fittings over a bath after cleaning', caption: 'Bathroom, descaled' },
];
const LAST_LOOK: WbStill = {
  src: `${EOT}/gallery/5.jpg`,
  alt: 'An emptied fridge standing open after cleaning, its shelves and door racks clear',
  caption: 'An emptied fridge after our move-out clean, ready for the check-out inspection.',
};

function Rating() {
  return HAS_VERIFIED_RATING
    ? <a className="wb-rating" href={GOOGLE_READ_REVIEWS_LINK} target="_blank" rel="noopener noreferrer" aria-label={GOOGLE_RATING_ARIA_LABEL}>{GOOGLE_RATING_LABEL}</a>
    : null;
}

/** A: room by room. A contact sheet of the rooms we clean, in our own photos. */
export function EotOpeningRooms() {
  const oven = useEotHeroPhoto({ ...WB_PHOTO.jobOven, caption: 'The oven, racks and glass' });
  const tiles = [{ ...oven, caption: oven.caption ?? 'The oven, racks and glass' }, ...ROOMS];
  return (
    <section className="wbo-rooms" aria-labelledby="wbo-eot-title">
      <div className="wbo-rooms__in">
        <div className="wbo-rooms__head">
          <h1 id="wbo-eot-title" className="wbo-h1"><span className="wbo-kick">End of tenancy cleaning</span> Every room. Every cupboard.</h1>
        </div>
        <div className="wbo-mosaic">
          {tiles.map((tile, index) => (
            <figure key={tile.src} className={`wbo-mosaic__t${index + 1}`}>
              <img src={tile.src} srcSet={tile.srcSet} alt={tile.alt} {...(index < 2 ? HIGH_PRIORITY : { loading: 'lazy' as const })} decoding="async" />
              <figcaption>{tile.caption}</figcaption>
            </figure>
          ))}
        </div>
        <div className="wbo-pitch">
          <p className="wbo-price">{HEADLINE_PRICE}</p>
          <p>Complete clean of a vacant flat: oven, fridge and the inside of every cupboard included. {GUARANTEE}</p>
          <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink><Rating /></div>
        </div>
      </div>
      <div className="wb-under"><div className="wb-w">Our photos from move-out cleans in East and North London.</div></div>
    </section>
  );
}

/** B: the last look round. One quiet photo beside a checkout sheet and the price ladder. */
export function EotOpeningCheckout({ included }: { included: readonly string[] }) {
  const photo = useEotHeroPhoto(LAST_LOOK);
  return (
    <section className="wbo-check" aria-labelledby="wbo-eot-title">
      <div className="wbo-check__in">
        <figure className="wbo-check__ph">
          <img src={photo.src} srcSet={photo.srcSet} alt={photo.alt} {...HIGH_PRIORITY} />
          <span className="wbo-tag">{HEADLINE_PRICE}</span>
          <figcaption>{photo.caption}</figcaption>
        </figure>
        <div className="wbo-check__body">
          <h1 id="wbo-eot-title" className="wbo-h1"><span className="wbo-kick">End of tenancy cleaning</span> Oven to skirting boards.</h1>
          <div className="wbo-sheet">
            <div>
              <h2 className="wbo-sheet__h">Every room gets</h2>
              <ul className="wbo-ticks">{included.map(item => <li key={item}>{item}</li>)}</ul>
            </div>
            <div>
              <h2 className="wbo-sheet__h">Fixed price, one bathroom</h2>
              <table className="wbo-ladder">
                <tbody>{EOT_SIZES.map(([label, pence]) => <tr key={label}><th scope="row">{label}</th><td>{gbp(pence)}</td></tr>)}</tbody>
              </table>
              <p className="wbo-fine">Extra bathroom +{gbp(EOT_EXTRA_BATH_P)}. {VAT_SHORT_NOTE} {GUARANTEE}</p>
            </div>
          </div>
          <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink><Rating /></div>
        </div>
      </div>
    </section>
  );
}
