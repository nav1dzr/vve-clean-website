import { Link } from 'react-router-dom';
import { FACEBOOK_URL, GOOGLE_REVIEW_URL, INSTAGRAM_URL } from '../../data/social';
import type { GalleryCategory } from '../../data/galleryMedia';

const IG_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

export default function GalleryInstagramCta({
  galleryCategory,
  showGalleryLink = true,
  showAllNetworks = false,
  onDark = false,
}: {
  galleryCategory: GalleryCategory;
  // The Gallery page itself renders this CTA row too (for its Instagram
  // link) — on that page a "View full Gallery" link would point back at the
  // page the visitor is already on, so GalleryPage passes false here.
  showGalleryLink?: boolean;
  /** Gallery page only: expose the other verified public profiles too. */
  showAllNetworks?: boolean;
  // Light-on-dark treatment for the Sofa page's navy proof section. The
  // default navy-800 text would be all but invisible there.
  onDark?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
      {showGalleryLink && (
        <Link
          to={`/gallery?category=${galleryCategory}`}
          className={`inline-flex items-center justify-center gap-2 border-2 font-semibold text-sm px-5 py-2.5 min-h-[44px] rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            onDark
              ? 'border-white/30 hover:border-sky-300 text-white focus-visible:outline-sky-300'
              : 'border-navy-200 hover:border-royal-400 text-navy-800 focus-visible:outline-royal-600'
          }`}
        >
          View full Gallery
        </Link>
      )}
      {INSTAGRAM_URL ? (
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow VVE Clean on Instagram"
          className="inline-flex items-center gap-2.5 px-5 py-2.5 min-h-[44px] rounded-full text-white text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
          style={{ background: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)' }}
        >
          {IG_SVG}
          Follow on Instagram
        </a>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-full border border-silver-300 text-silver-400 text-sm font-semibold cursor-not-allowed"
        >
          Instagram coming soon
        </span>
      )}
      {showAllNetworks && (
        <>
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow VVE Clean on Facebook"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#1877f2] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900"
          >
            Facebook
          </a>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="See VVE Clean on Google"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-silver-200 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:border-royal-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal-600"
          >
            Google reviews
          </a>
        </>
      )}
    </div>
  );
}
