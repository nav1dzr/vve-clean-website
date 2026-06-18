import { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2 } from 'lucide-react';
import { useReveal } from '../hooks/useReveal';

const WA_LINK = 'https://wa.me/447845451111?text=Hi%20VVE%20Clean%2C%20I%27d%20like%20to%20get%20a%20quote.';
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xbdedojo';

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: size, height: size }}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function Contact() {
  const { ref, visible } = useReveal();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [subscribe, setSubscribe] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return; // bot filled the hidden field — silently drop
    if (!name || !email || !message) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || '—',
          message,
          'Marketing opt-in': subscribe ? 'Yes' : 'No',
          _gotcha: honeypot,
        }),
      });

      setLoading(false);

      if (res.ok) {
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
        setSubscribe(false);
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { errors?: { message: string }[] })?.errors?.[0]?.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setLoading(false);
      setError('Something went wrong. Please try again or call us.');
    }
  };

  return (
    <section id="contact" ref={ref} className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center mb-14 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="inline-flex items-center gap-2 bg-royal-500/10 border border-royal-500/20 rounded-full px-4 py-1.5 mb-4">
            <Mail size={12} className="text-royal-600" />
            <span className="text-royal-600 text-xs tracking-widest font-semibold uppercase">Get in Touch</span>
          </div>
          <h2 className="section-heading mb-4">Contact VVE Clean</h2>
          <p className="section-subheading mx-auto">
            We usually reply within the hour — message us anytime on WhatsApp.
          </p>
        </div>

        <div
          className={`grid lg:grid-cols-5 gap-0 rounded-2xl overflow-hidden shadow-xl transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {/* Info panel */}
          <div className="lg:col-span-2 navy-gradient p-8 flex flex-col">
            <div>
              <h3 className="font-display text-2xl font-bold text-white mb-2">Get in Touch</h3>
              <p className="text-silver-300 text-sm mb-8 leading-relaxed">
                Our team is ready to help. Contact us today for a free consultation or instant quote.
              </p>

              <div className="space-y-5">
                {/* Phone */}
                <div className="flex items-start gap-4">
                  <div className="glass-card rounded-lg p-2 flex-shrink-0">
                    <Phone className="text-royal-400" size={16} />
                  </div>
                  <div>
                    <div className="text-silver-300 text-xs mb-0.5">Phone</div>
                    <a href="tel:02080502233" className="text-white font-semibold hover:text-silver-200 transition-colors block">
                      020 8050 2233
                    </a>
                  </div>
                </div>

                {/* WhatsApp — sits directly under phone block */}
                <a
                  href={WA_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 w-full justify-center"
                >
                  <WhatsAppIcon size={15} />
                  Open WhatsApp Chat · 07845 451111
                </a>

                <div className="flex items-start gap-4">
                  <div className="glass-card rounded-lg p-2 flex-shrink-0">
                    <Mail className="text-royal-400" size={16} />
                  </div>
                  <div>
                    <div className="text-silver-300 text-xs mb-0.5">Email</div>
                    <a href="mailto:contact@vveclean.co.uk" className="text-white font-semibold hover:text-silver-200 transition-colors">
                      contact@vveclean.co.uk
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="glass-card rounded-lg p-2 flex-shrink-0">
                    <MapPin className="text-royal-400" size={16} />
                  </div>
                  <div>
                    <div className="text-silver-300 text-xs mb-0.5">Address</div>
                    <span className="text-white font-semibold text-sm block">23-25 Queensway</span>
                    <span className="text-silver-400 text-xs block">London, W2 4QP</span>
                    <span className="text-silver-300 text-xs mt-1 block">Serving East &amp; North London</span>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="glass-card rounded-lg p-2 flex-shrink-0">
                    <Clock className="text-royal-400" size={16} />
                  </div>
                  <div>
                    <div className="text-silver-300 text-xs mb-0.5">Hours</div>
                    <div className="text-white font-semibold text-sm">Mon – Fri: 9:00 AM – 6:00 PM</div>
                    <div className="text-silver-400 text-xs">Sat: 10:00 AM – 3:00 PM</div>
                    <div className="text-silver-400 text-xs">Sun: Closed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form panel */}
          <div className="lg:col-span-3 bg-white p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <CheckCircle2 className="text-green-500 mb-4" size={56} />
                <h3 className="text-2xl font-bold text-navy-900 mb-2">Message Sent!</h3>
                <p className="text-silver-600">
                  Thank you! We will be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Honeypot — hidden from humans, filled by bots; Formspree drops the submission if non-empty */}
                <input
                  type="text"
                  name="_gotcha"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
                />
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-navy-900 font-semibold text-sm mb-1.5">Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Smith"
                      className="w-full border-2 border-silver-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-royal-400 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-navy-900 font-semibold text-sm mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full border-2 border-silver-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-royal-400 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-navy-900 font-semibold text-sm mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07845 451111"
                    className="w-full border-2 border-silver-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-royal-400 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-navy-900 font-semibold text-sm mb-1.5">Message *</label>
                  <textarea
                    name="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Tell us about the service you need, your property, preferred dates..."
                    className="w-full border-2 border-silver-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-royal-400 transition-colors resize-none"
                    required
                  />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={subscribe}
                    onChange={(e) => setSubscribe(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-silver-300 text-royal-500 focus:ring-royal-400 cursor-pointer flex-shrink-0"
                  />
                  <span className="text-silver-500 text-xs leading-relaxed group-hover:text-silver-700 transition-colors">
                    Send me exclusive discounts and cleaning tips via email
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-royal-500 hover:bg-royal-600 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                  {!loading && <Send size={16} />}
                </button>

                <p className="text-slate-500 text-xs text-center">
                  Or{' '}
                  <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="text-green-600 font-medium hover:underline">
                    chat with us on WhatsApp
                  </a>{' '}
                  for an instant reply.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
