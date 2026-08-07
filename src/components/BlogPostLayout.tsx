import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileStickyFooter from './MobileStickyFooter';
import { BookingProvider } from '../context/BookingContext';
import type { BlogPost, BlogPostBlock } from '../data/blog';

const BASE_URL = 'https://vveclean.co.uk';

function buildArticleSchema(post: BlogPost): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedDate,
    dateModified: post.updatedDate ?? post.publishedDate,
    author: { '@type': 'Organization', name: 'VVE Clean' },
    publisher: { '@type': 'Organization', name: 'VVE Clean', url: BASE_URL },
    mainEntityOfPage: `${BASE_URL}/blog/${post.slug}`,
  });
}

function Block({ block }: { block: BlogPostBlock }) {
  switch (block.type) {
    case 'heading':
      return (
        <h2 id={block.id} className="font-display text-2xl md:text-3xl font-bold text-navy-900 mt-10 mb-4 scroll-mt-24">
          {block.text}
        </h2>
      );
    case 'paragraph':
      return <p className="text-slate-600 text-base leading-relaxed mb-4">{block.content}</p>;
    case 'list':
      return (
        <ul className="list-disc pl-6 space-y-2 mb-4">
          {block.items.map((item, i) => (
            <li key={i} className="text-slate-600 text-base leading-relaxed">{item}</li>
          ))}
        </ul>
      );
    case 'callout':
      return (
        <div className="border-l-4 border-royal-400 bg-royal-50 rounded-r-xl px-5 py-4 mb-6 text-navy-800 text-sm leading-relaxed">
          {block.content}
        </div>
      );
  }
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export default function BlogPostLayout({ post }: { post: BlogPost }) {
  return (
    <BookingProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: buildArticleSchema(post) }} />

      <div className="min-h-screen bg-[#fafbfd] pb-[56px] lg:pb-0">
        <Navbar />
        <main id="main-content">
          <nav aria-label="Breadcrumb" className="pt-24 pb-2 px-4 max-w-3xl mx-auto">
            <ol className="flex items-center gap-2 text-xs text-silver-500 flex-wrap">
              <li><Link to="/" className="hover:text-navy-900 transition-colors">Home</Link></li>
              <li aria-hidden="true" className="text-silver-300">›</li>
              <li><Link to="/blog" className="hover:text-navy-900 transition-colors">Blog</Link></li>
              <li aria-hidden="true" className="text-silver-300">›</li>
              <li className="text-navy-700 font-medium">{post.title}</li>
            </ol>
          </nav>

          <article className="max-w-3xl mx-auto px-4 py-10">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-royal-600 mb-3">
              {post.category}
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-navy-900 leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-silver-500 text-sm mb-10">
              Published {formatDate(post.publishedDate)}
              {post.updatedDate && post.updatedDate !== post.publishedDate && (
                <> · Updated {formatDate(post.updatedDate)}</>
              )}
            </p>

            <div>
              {post.body.map((block, i) => <Block key={i} block={block} />)}
            </div>

            {post.relatedServiceHref && post.relatedServiceLabel && (
              <div className="mt-10 bg-[#f0f7ff] border border-royal-100 rounded-2xl p-6 text-center">
                <p className="text-navy-800 text-sm mb-4">
                  Looking for professional {post.relatedServiceLabel.toLowerCase()}?
                </p>
                <Link
                  to={post.relatedServiceHref}
                  className="inline-flex items-center gap-2 bg-royal-500 hover:bg-royal-600 text-white font-bold px-6 py-3 rounded-xl transition-all duration-200 text-sm"
                >
                  See {post.relatedServiceLabel}
                </Link>
              </div>
            )}
          </article>
        </main>
        <Footer />
      </div>

      <MobileStickyFooter />
    </BookingProvider>
  );
}
