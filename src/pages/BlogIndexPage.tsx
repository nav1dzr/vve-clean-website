import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MobileStickyFooter from '../components/MobileStickyFooter';
import { BLOG_POSTS } from '../data/blog';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

  return (
    <div className="mobile-page-bottom min-h-screen bg-[#fafbfd] lg:pb-0">
      <Navbar />
      <main id="main-content">
        <div className="navy-gradient pt-32 pb-14 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-silver-300 text-xs tracking-widest font-medium uppercase">Guides &amp; Advice</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              VVE Clean Blog
            </h1>
            <p className="text-silver-200 text-base sm:text-lg max-w-xl mx-auto">
              Practical guides on cleaning, tenancy deposits and moving home in London.
            </p>
          </div>
        </div>

        <section className="max-w-3xl mx-auto px-4 py-14">
          <div className="grid gap-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className="block bg-white border border-silver-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-royal-300 transition-all duration-200"
              >
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-royal-600 mb-2">
                  {post.category}
                </p>
                <h2 className="font-display text-xl font-bold text-navy-900 mb-2 leading-snug">
                  {post.title}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-3">{post.excerpt}</p>
                <p className="text-silver-500 text-xs">{formatDate(post.publishedDate)}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
      <MobileStickyFooter />
    </div>
  );
}
