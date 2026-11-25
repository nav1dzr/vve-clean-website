import { LayoutImg, WbLink } from './WbChrome';
import { HIGH_PRIORITY, WB_PHOTO, useEotHeroPhoto, type WbStill } from './wbMedia';
import { GOOGLE_RATING_ARIA_LABEL, GOOGLE_RATING_LABEL, HAS_VERIFIED_RATING } from '../../data/googleRating';
import { GOOGLE_READ_REVIEWS_LINK } from '../GoogleBrand';
import { EOT_BASE_PRICES_P, EOT_EXTRA_BATH_P, EOT_EXTRA_WC_P, EOT_GUARANTEE_HOURS, penceToDisplay as gbp } from '../../data/pricing';
import { VAT_SHORT_NOTE } from '../../data/businessPolicy';
import { EOT_SIZES } from '../../data/endOfTenancyContent';
import '../../styles/wb-openings.css';

// End of Tenancy opening chosen on 23 November 2026: the checkout sheet on
// phones and tablets (lead photo, then the checklist and price ladder directly
// underneath), the room-by-room layout on desktop (lead photo across the top,
// three supporting photos, each a different part of the clean).
//
// One lead photo serves both layouts. It reads the CRM position
// "End of tenancy · Opening photograph" (service-end-of-tenancy-hero); until
// the owner's wide photo of a finished, empty room is published there, a
// labelled preview placeholder shows the crop. The placeholder must be
// replaced before release.
//
// The three supporting photos appear on desktop only and are never downloaded
// by phones (see LayoutImg).

const DAYS = EOT_GUARANTEE_HOURS / 24;
const HEADLINE_PRICE = `Studio ${gbp(EOT_BASE_PRICES_P.studio)} · 2 bedrooms ${gbp(EOT_BASE_PRICES_P.bed2)}`;
const GUARANTEE = `Tell us within ${DAYS} days if we missed agreed work and we come back once to re-clean it.`;

const LEAD_PLACEHOLDER: WbStill = {
  src: '/images/work-behind/placeholder-eot-room.svg',
  alt: 'Placeholder for a wide photo of a finished, empty kitchen or living room',
  caption: 'Placeholder: your wide photo of a finished, empty room goes here.',
};
const SUPPORT: WbStill[] = [
  { ...WB_PHOTO.jobOven, caption: 'Oven, racks and glass' },
  { src: '/images/work-behind/eot-cupboard.webp', alt: 'The cupboard under a kitchen sink before and after cleaning, side by side', caption: 'Inside the cupboards' },
  { src: '/images/work-behind/eot-shower.webp', alt: 'A curved shower screen and fittings over a bath after cleaning', caption: 'Bathroom, descaled' },
];

function Rating() {
  return HAS_VERIFIED_RATING
    ? <a className="wb-rating" href={GOOGLE_READ_REVIEWS_LINK} target="_blank" rel="noopener noreferrer" aria-label={GOOGLE_RATING_ARIA_LABEL}>{GOOGLE_RATING_LABEL}</a>
    : null;
}

export function EotOpening({ included }: { included: readonly string[] }) {
  const lead = useEotHeroPhoto(LEAD_PLACEHOLDER);
  return (
    <section className="wbo-eot" aria-labelledby="wbo-eot-title">
      <div className="wbo-eot__in">
        <div className="wbo-eot__head">
          <h1 id="wbo-eot-title" className="wbo-h1">
            <span className="wbo-kick">End of tenancy cleaning</span>{' '}
            <span className="wbo-narrow">Oven to skirting boards.</span>
            <span className="wbo-wide">Every room. Every cupboard.</span>
          </h1>
        </div>

        <div className="wbo-eot__media">
          <figure className="wbo-eot__lead">
            <img src={lead.src} srcSet={lead.srcSet} sizes={lead.srcSet ? '(max-width: 1000px) 100vw, (max-width: 1600px) 59vw, 944px' : undefined} alt={lead.alt} {...HIGH_PRIORITY} />
            <span className="wbo-tag wbo-narrow">{HEADLINE_PRICE}</span>
            <figcaption>{lead.caption}</figcaption>
          </figure>
          {SUPPORT.map(tile => (
            <figure key={tile.src} className="wbo-eot__tile wbo-wide">
              <LayoutImg only="wide" src={tile.src} alt={tile.alt} loading="lazy" decoding="async" />
              <figcaption>{tile.caption}</figcaption>
            </figure>
          ))}
        </div>

        <div className="wbo-eot__sheet wbo-narrow">
          <div>
            <h2 className="wbo-sheet__h">Every room gets</h2>
            <ul className="wbo-ticks">{included.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h2 className="wbo-sheet__h">Fixed price, one bathroom</h2>
            <table className="wbo-ladder">
              <tbody>{EOT_SIZES.map(([label, pence]) => <tr key={label}><th scope="row">{label}</th><td>{gbp(pence)}</td></tr>)}</tbody>
            </table>
            <p className="wbo-fine">Extra bathroom +{gbp(EOT_EXTRA_BATH_P)}, separate WC +{gbp(EOT_EXTRA_WC_P)}. Houses and 5+ bedrooms are priced in the quote. {VAT_SHORT_NOTE} {GUARANTEE}</p>
          </div>
        </div>

        <div className="wbo-eot__pitch">
          <p className="wbo-price wbo-wide">{HEADLINE_PRICE}</p>
          <p className="wbo-wide">Complete clean of a vacant flat: oven, fridge and the inside of every cupboard included. {GUARANTEE}</p>
          <div className="wb-acts"><WbLink className="wb-btn" href="#quote">Get my price</WbLink><Rating /></div>
        </div>
      </div>
    </section>
  );
}
