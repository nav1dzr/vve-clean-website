import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookingProvider } from '../context/BookingContext';
import FAQ from '../components/FAQ';
import { WbDock, WbFooter, WbHeader, WbLink, WbPage, WB_PHONE_DISPLAY, WB_PHONE_HREF, WB_WHATSAPP_HREF } from '../components/workbehind/WbChrome';
import { HIGH_PRIORITY, WB_PAIRS, WB_PHOTO, useHomeHeroPhoto, useHomeServicePhoto, type WbStill } from '../components/workbehind/wbMedia';
import {
  CARPET_ITEM_PRICES_P, CARPET_MIN_BOOKING_P, STAIRS_FIRST_P, EOT_BASE_PRICES_P, EOT_GUARANTEE_HOURS,
  MOVEIN_BASE_PRICES_P, COMMERCIAL_REGULAR_MIN_CHARGE_P, COMMERCIAL_COMMUNAL_FROM_P, COMMERCIAL_ONCEOFF_MIN_CHARGE_P,
  COMMERCIAL_EOL_FROM_P, COVERAGE_POSTCODES, penceToDisplay as gbp,
} from '../data/pricing';
import { BUILDERS_BUDGET_GUIDE, formatBuildersRange } from '../../shared/afterBuildersGuide.js';
import { CONDITIONAL_DEPOSIT_NOTE, RESCHEDULING_NOTICE, VAT_NOTE } from '../data/businessPolicy';
import { REVIEWS } from '../data/reviews';
import { GOOGLE_RATING_ARIA_LABEL, GOOGLE_RATING_LABEL, HAS_VERIFIED_RATING, VERIFIED_GOOGLE_RATING } from '../data/googleRating';
import { GOOGLE_READ_REVIEWS_LINK } from '../components/GoogleBrand';

// Homepage in "The Work Behind" design. Every price is read from the live
// catalogue and every claim from an existing approved source, so nothing here
// can drift from the quote or the booking request.
const GUARANTEE_DAYS = EOT_GUARANTEE_HOURS / 24;
const BUILDERS_FLAT = BUILDERS_BUDGET_GUIDE.find(row => row.key === 'flat_1_2')!;
const QUOTED = ['Ahmad B.', 'Marcin P.', 'Hannah M.'];

function Photo({ still, eager = false }: { still: WbStill; eager?: boolean }) {
  return <img src={still.src} srcSet={still.srcSet} alt={still.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

function Pair({ pair }: { pair: (typeof WB_PAIRS)[keyof typeof WB_PAIRS] }) {
  return (
    <figure className="wb-fig wb-pair">
      <div className="wb-two">
        <div className="wb-fig"><Photo still={pair.before} /><span className="wb-tape">Before</span></div>
        <div className="wb-fig"><Photo still={pair.after} /><span className="wb-tape">After</span></div>
      </div>
      <figcaption><p><b>{pair.title}</b>{pair.body}</p></figcaption>
    </figure>
  );
}

function PostcodeCheck() {
  const [message, setMessage] = useState('');
  const check = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get('postcode') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!raw) { setMessage('Type your postcode, such as E8 1AA.'); return; }
    const outward = raw.length >= 5 ? raw.slice(0, -3) : raw;
    setMessage((COVERAGE_POSTCODES as readonly string[]).includes(outward)
      ? `Yes, we cover ${outward}.`
      : `${outward} is outside our usual area. Ask us and we will tell you if we can travel to you.`);
  };
  return (
    <form className="wb-pc" onSubmit={check} noValidate>
      <label htmlFor="wb-postcode">Check your postcode</label>
      <div className="wb-pc__row">
        <input id="wb-postcode" name="postcode" autoComplete="postal-code" placeholder="E8 1AA" maxLength={8} />
        <button className="wb-btn wb-btn--dark" type="submit">Check</button>
      </div>
      <output aria-live="polite">{message}</output>
    </form>
  );
}

export default function WorkBehindHomePage() {
  const hero = useHomeHeroPhoto();
  const eotPhoto = useHomeServicePhoto('end-of-tenancy', WB_PHOTO.jobOven);
  const sofaPhoto = useHomeServicePhoto('sofa', WB_PHOTO.jobSofa);
  const quotes = QUOTED.map(name => REVIEWS.find(review => review.name === name)).filter(Boolean);
  const coverage = COVERAGE_POSTCODES as readonly string[];
  const codeRows = ['E', 'N', 'NW'].map(prefix => coverage.filter(code => code.replace(/\d+$/, '') === prefix));

  return (
    <BookingProvider>
      <WbPage>
        <WbHeader ctaHref="#services" />
        <main id="main-content">
          <section className="wb-hero" aria-labelledby="wb-hero-title">
            <div className="wb-hero__stage">
              <h1 id="wb-hero-title">See the work <span className="wb-br">before you book.</span></h1>
              {hero
                ? <img className="wb-hero__img" src={hero.src} srcSet={hero.srcSet} alt={hero.alt} {...HIGH_PRIORITY} />
                : <picture>
                    <source media="(max-width: 1000px)" srcSet={WB_PHOTO.heroPhone} />
                    <img className="wb-hero__img" src={WB_PHOTO.heroWide.src} alt={WB_PHOTO.heroWide.alt} {...HIGH_PRIORITY} width={1280} height={720} />
                  </picture>}
              <div className="wb-hero__pitch">
                <p>Carpet, sofa and end of tenancy cleaning across East and North London. Our own jobs, with the price beside each one.</p>
                <div className="wb-acts">
                  <WbLink className="wb-btn" href="#services">Get my price</WbLink>
                  {HAS_VERIFIED_RATING && <a className="wb-rating" href={GOOGLE_READ_REVIEWS_LINK} target="_blank" rel="noopener noreferrer" aria-label={GOOGLE_RATING_ARIA_LABEL}>{GOOGLE_RATING_LABEL}</a>}
                </div>
              </div>
            </div>
            <div className="wb-under"><div className="wb-w">Our photo. Hot-water extraction on a bedroom carpet.</div></div>
          </section>

          <section className="wb-sec" id="work" aria-labelledby="wb-work-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-work-title">One carpet, start to finish</h2>
              <div className="wb-frames">
                <figure className="wb-fig wb-f1"><Photo still={WB_PHOTO.blueBefore} /><span className="wb-tape">Before</span><figcaption><b>Before</b>Dull and patchy, with dark soiling.</figcaption></figure>
                <figure className="wb-fig wb-f2"><Photo still={WB_PHOTO.blueDuring} /><span className="wb-tape">During</span><figcaption><b>During</b>Hot water in, soil pulled straight back out.</figcaption></figure>
                <figure className="wb-fig wb-f3"><Photo still={WB_PHOTO.blueAfter} /><span className="wb-tape">After</span><figcaption><b>After</b>Colour back and even. Typical drying is 2 to 4 hours.</figcaption></figure>
              </div>
              <p className="wb-swipe" aria-hidden="true">Swipe for during and after →</p>
            </div>
          </section>

          <section className="wb-sec" id="services" aria-labelledby="wb-services-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-services-title">What needs cleaning?</h2>
              <p className="wb-sub">Each price is the first on our list. Pick a job to build yours.</p>
              <div className="wb-grid">
                <article className="wb-job wb-job--feature">
                  <div className="wb-job__ph wb-fig"><Photo still={eotPhoto} /><span className="wb-tape">After</span></div>
                  <h3>End of tenancy</h3>
                  <p className="wb-price"><b>Studio flat {gbp(EOT_BASE_PRICES_P.studio)}</b></p>
                  <p className="wb-xs">1 bedroom {gbp(EOT_BASE_PRICES_P.bed1)}. 2 bedrooms {gbp(EOT_BASE_PRICES_P.bed2)}. Oven included. Tell us within {GUARANTEE_DAYS} days if we missed agreed work and we return once to re-clean it.</p>
                  <Link className="wb-link" to="/end-of-tenancy-cleaning-london" aria-label="Get my end of tenancy price">Get my price</Link>
                </article>
                <article className="wb-job">
                  <div className="wb-job__ph"><Photo still={WB_PHOTO.jobStairs} /></div>
                  <h3>Carpets</h3>
                  <p className="wb-price"><b>Bedroom {gbp(CARPET_ITEM_PRICES_P.bedroom)}</b><span>{gbp(CARPET_MIN_BOOKING_P)} minimum visit</span></p>
                  <p className="wb-xs">Living room {gbp(CARPET_ITEM_PRICES_P.living_room)}. Hallway {gbp(CARPET_ITEM_PRICES_P.hallway)}. Stairs {gbp(STAIRS_FIRST_P)} a flight.</p>
                  <Link className="wb-link" to="/carpet-cleaning-london" aria-label="Get my carpet cleaning price">Get my price</Link>
                </article>
                <article className="wb-job">
                  <div className="wb-job__ph"><Photo still={sofaPhoto} /></div>
                  <h3>Sofas</h3>
                  <p className="wb-price"><b>2-seater {gbp(CARPET_ITEM_PRICES_P.sofa_2)}</b><span>{gbp(CARPET_MIN_BOOKING_P)} minimum visit</span></p>
                  <p className="wb-xs">Armchair {gbp(CARPET_ITEM_PRICES_P.armchair)}. 3-seater {gbp(CARPET_ITEM_PRICES_P.sofa_3)}. Corner sofa {gbp(CARPET_ITEM_PRICES_P.sofa_corner)}.</p>
                  <Link className="wb-link" to="/sofa-cleaning-london" aria-label="Get my sofa cleaning price">Get my price</Link>
                </article>
                <article className="wb-job">
                  <div className="wb-job__ph wb-fig"><Photo still={WB_PHOTO.jobOffice} /><span className="wb-tape">After</span></div>
                  <h3>Offices and communal areas</h3>
                  <p className="wb-price"><b>From {gbp(COMMERCIAL_REGULAR_MIN_CHARGE_P)} a visit</b></p>
                  <p className="wb-xs">We visit first, free of charge, then send a fixed written quote.</p>
                  <Link className="wb-link" to="/commercial" aria-label="Request a tailored commercial quote">Request a tailored quote</Link>
                </article>
                <article className="wb-job wb-job--type wb-job--carpet">
                  <h3>After builders</h3>
                  <p className="wb-price"><b>Written quote</b></p>
                  <p className="wb-xs">Guide: {formatBuildersRange(BUILDERS_FLAT.standard)} for a {BUILDERS_FLAT.label.toLowerCase()}. Tell us which rooms the builders worked in.</p>
                  <Link className="wb-link" to="/after-builders-cleaning-london" aria-label="Get my after builders cleaning quote">Get my cleaning quote</Link>
                </article>
                <article className="wb-job wb-job--type wb-job--wall">
                  <h3>Moving in</h3>
                  <p className="wb-price"><b>Studio {gbp(MOVEIN_BASE_PRICES_P.studio)}</b></p>
                  <p className="wb-xs">A deep clean before your boxes arrive. 1 bedroom {gbp(MOVEIN_BASE_PRICES_P.bed1)}. 2 bedrooms {gbp(MOVEIN_BASE_PRICES_P.bed2)}.</p>
                  <Link className="wb-link" to="/booking" aria-label="Get my move-in cleaning price">Get my price</Link>
                </article>
              </div>
            </div>
          </section>

          <section className="wb-sec wb-sec--mist" aria-labelledby="wb-pairs-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-pairs-title">More before and after</h2>
              <p className="wb-sub">Every pair is one job. We tell you what will lift before we start.</p>
              <div className="wb-pairs">
                <Pair pair={WB_PAIRS.oven} />
                <Pair pair={WB_PAIRS.carpet} />
                <Pair pair={WB_PAIRS.sofa} />
                <Pair pair={WB_PAIRS.shower} />
              </div>
              <Link className="wb-link" to="/gallery" style={{ marginTop: 16 }}>See more of our work</Link>
            </div>
          </section>

          <section className="wb-sec" aria-labelledby="wb-out-title">
            <div className="wb-w wb-split">
              <figure className="wb-fig wb-split__img"><Photo still={WB_PHOTO.wasteWater} /><span className="wb-tape">What came out</span></figure>
              <div>
                <h2 className="wb-h2" id="wb-out-title">This is what the machine takes out</h2>
                <p className="wb-sub">Extraction puts cleaning solution through the fabric, then pulls the soil and water back out. It ends up in the tank, not in your sofa.</p>
              </div>
            </div>
          </section>

          <section className="wb-sec wb-sec--carpet" aria-labelledby="wb-steps-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-steps-title">From request to confirmed visit</h2>
              <ol className="wb-steps">
                <li><b>1</b><h3>Send your request</h3><p>Choose the work and a time that suits you. No payment is taken.</p></li>
                <li><b>2</b><h3>We agree the job</h3><p>We check the date and confirm the work, price and arrival time with you.</p></li>
                <li><b>3</b><h3>We confirm by email</h3><p>{CONDITIONAL_DEPOSIT_NOTE}</p></li>
              </ol>
            </div>
          </section>

          <section className="wb-sec" aria-labelledby="wb-crew-title">
            <div className="wb-w wb-split wb-split--wide">
              <figure className="wb-fig"><Photo still={WB_PHOTO.van} /><figcaption className="wb-cap">Our van and the kit that comes to your door.</figcaption></figure>
              <div>
                <h2 className="wb-h2" id="wb-crew-title">Who turns up, and what they bring</h2>
                <p className="wb-sub">VVE Clean began with three friends who had been working for different companies. You speak directly with the team.</p>
                <ul className="wb-list">
                  <li>Hot-water extraction for carpets and upholstery</li>
                  <li>Pressure washing for exterior surfaces</li>
                  <li>Equipment and cleaning products supplied</li>
                  <li>£5m public liability insurance</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="wb-sec wb-sec--mist" aria-labelledby="wb-terms-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-terms-title">The terms, said plainly</h2>
              <dl className="wb-terms">
                <div><dt>Payment</dt><dd>Nothing to pay to send a request. {CONDITIONAL_DEPOSIT_NOTE}</dd></div>
                <div><dt>VAT</dt><dd>{VAT_NOTE}</dd></div>
                <div><dt>Re-clean</dt><dd>On an end of tenancy clean, tell us within {GUARANTEE_DAYS} days if we missed agreed work and we return once to re-clean it. It is a cleaning promise, not a promise about your deposit. <Link className="wb-link" style={{ fontSize: 17 }} to="/end-of-tenancy-cleaning-london#guarantee">Full re-clean terms</Link></dd></div>
                <div><dt>Changing plans</dt><dd>{RESCHEDULING_NOTICE}</dd></div>
              </dl>
            </div>
          </section>

          <section className="wb-sec" aria-labelledby="wb-said-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-said-title">What customers wrote</h2>
              {HAS_VERIFIED_RATING && VERIFIED_GOOGLE_RATING && (
                <a className="wb-score" href={GOOGLE_READ_REVIEWS_LINK} target="_blank" rel="noopener noreferrer" aria-label={GOOGLE_RATING_ARIA_LABEL} style={{ marginTop: 16 }}>
                  {VERIFIED_GOOGLE_RATING.value}<small>on Google</small>
                </a>
              )}
              <div className="wb-quotes">
                {quotes.map(review => review && (
                  <blockquote key={review.name}><p>“{review.text}”</p><cite>{review.name}, {review.location}. {review.date}</cite></blockquote>
                ))}
              </div>
            </div>
          </section>

          <section className="wb-sec wb-sec--ink" id="commercial" aria-labelledby="wb-trade-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-trade-title">Offices, shops and communal areas</h2>
              <p className="wb-sub">We visit first, free of charge, then send a fixed written quote.</p>
              <ul className="wb-list wb-list--price">
                <li><span>Regular contract cleaning</span><span>{gbp(COMMERCIAL_REGULAR_MIN_CHARGE_P)} minimum a visit</span></li>
                <li><span>Communal areas</span><span>from {gbp(COMMERCIAL_COMMUNAL_FROM_P)} a visit</span></li>
                <li><span>One-off commercial deep clean</span><span>{gbp(COMMERCIAL_ONCEOFF_MIN_CHARGE_P)} minimum</span></li>
                <li><span>End-of-lease commercial clean</span><span>from {gbp(COMMERCIAL_EOL_FROM_P)}</span></li>
              </ul>
              <div className="wb-acts"><Link className="wb-btn" to="/commercial">Request a tailored quote</Link></div>
            </div>
          </section>

          <section className="wb-sec wb-sec--wall" aria-labelledby="wb-areas-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-areas-title">Where we work</h2>
              <p className="wb-sub">East and North London. Not listed? Ask us.</p>
              <PostcodeCheck />
              <p className="wb-codes" style={{ marginTop: 24 }}>{codeRows.map(row => <span key={row[0]}>{row.join(' ')}</span>)}</p>
            </div>
          </section>

          <div className="wb-legacy"><FAQ /></div>

          <section className="wb-sec wb-sec--carpet wb-last" aria-labelledby="wb-last-title">
            <div className="wb-w">
              <h2 className="wb-h2" id="wb-last-title">What needs cleaning?</h2>
              <div className="wb-acts">
                <WbLink className="wb-btn" href="#services">Get my price</WbLink>
                <a className="wb-btn wb-btn--line" href={WB_WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
              </div>
              <a className="wb-last__tel" href={WB_PHONE_HREF}>{WB_PHONE_DISPLAY}</a>
            </div>
          </section>
        </main>
        <WbFooter />
        <WbDock quoteHref="#services" />
      </WbPage>
    </BookingProvider>
  );
}
