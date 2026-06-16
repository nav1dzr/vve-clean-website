import { Star, Quote, Shield, CheckCircle } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const reviews = [
  {
    text: "Great job, really nice doing business with you mate — I'm super happy. Cheers, see you again!",
    name: 'Milad S.',
    service: 'End of Tenancy',
    avatar: 'MS',
  },
  {
    text: "The team did a really good job. They arrived on time, were polite and professional, and the cleaning was done properly. The place looked much fresher after they finished. I'm happy with the service and would recommend them.",
    name: 'Hannah M.',
    service: 'Deep Clean',
    avatar: 'HM',
  },
  {
    text: "Really happy with the cleaning service. They were friendly, worked carefully, and left everything looking clean and fresh. Good communication as well, which made the whole process easy. Would definitely use them again.",
    name: 'Kaydei M.',
    service: 'Carpet Cleaning',
    avatar: 'KM',
  },
];

export default function Reviews() {
  const { ref, visible } = useReveal();

  return (
    <section id="reviews" ref={ref} className="py-24 bg-sky-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="inline-flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-full px-4 py-1.5 mb-4">
            <span className="text-sky-700 text-xs tracking-widest font-semibold uppercase">
              Real feedback from real jobs
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-navy-900 mb-4">
            What Our <span className="text-gradient-blue">Clients Say</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Trusted by property managers, businesses, and residents across London for premium, reliable property care.
          </p>
        </div>

        {/* 3-card grid */}
        <div className="grid sm:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <div
              key={i}
              className={`bg-white border border-sky-200 rounded-2xl p-7 flex flex-col shadow-sm transition-all duration-700 hover:-translate-y-1 hover:shadow-lg hover:border-sky-400 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <Quote className="text-sky-400/60 mb-4 flex-shrink-0" size={30} />
              <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-6">{r.text}</p>

              <div>
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[1, 2, 3, 4, 5].map((k) => (
                    <Star key={k} size={13} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>

                {/* Avatar + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-royal flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {r.avatar}
                  </div>
                  <div>
                    <div className="text-navy-900 text-sm font-semibold">{r.name}</div>
                  </div>
                </div>

                {/* Service label */}
                <div className="pt-4 border-t border-sky-100">
                  <span className="text-sky-600 text-[10px] font-semibold tracking-widest uppercase">
                    {r.service}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div
          className={`mt-10 flex flex-wrap items-center justify-center gap-6 transition-all duration-700 delay-500 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="bg-white border border-sky-200 shadow-sm rounded-xl px-7 py-4 flex items-center gap-4">
            <Shield className="text-sky-500 flex-shrink-0" size={28} />
            <div>
              <div className="text-navy-900 text-sm font-semibold">£5M Public Liability Protection</div>
            </div>
          </div>
          <div className="bg-white border border-sky-200 shadow-sm rounded-xl px-7 py-4 flex items-center gap-4">
            <CheckCircle className="text-green-500 flex-shrink-0" size={28} />
            <div>
              <div className="text-navy-900 text-sm font-semibold">48-Hour Re-Clean Guarantee</div>
              <div className="text-slate-500 text-xs">Or We Re-Clean It Free</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
