import { useReveal } from '../hooks/useReveal';
import { Check } from 'lucide-react';
import { useManagedWebsiteMedia } from '../lib/managedGalleryMedia';

const ticks = [
  'Hot-water extraction for carpets and upholstery',
  'Pressure washing for exterior surfaces',
  'Equipment and cleaning products supplied',
];

export default function OurKit() {
  const { ref, visible } = useReveal();
  const managedEquipment = useManagedWebsiteMedia('homepage-equipment-image');
  const equipmentImage = managedEquipment?.type === 'photo' ? managedEquipment : null;

  return (
    <section
      ref={ref}
      className="navy-gradient px-4 py-20"
    >
      <div className="max-w-6xl mx-auto">
        <div
          className={`grid lg:grid-cols-2 gap-10 lg:gap-16 items-center transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Image */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-3xl bg-sky-300/10" />
            <img
              src={equipmentImage?.src || '/gallery/van-equipment.webp'}
              srcSet={equipmentImage?.srcSet}
              sizes={equipmentImage?.sizes}
              alt={equipmentImage?.alt || 'VVE Clean van and professional cleaning equipment'}
              width={780}
              height={520}
              loading="lazy"
              decoding="async"
              className="relative w-full rounded-2xl shadow-2xl object-cover"
            />
          </div>

          {/* Text */}
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-200/40 px-4 py-1">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-200">Our equipment</span>
            </div>

            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-5 leading-tight">
              The equipment we bring
            </h2>

            <p className="text-slate-300 text-base leading-relaxed mb-8">
              The equipment is chosen for the service booked, including hot-water extraction for
              suitable carpets and upholstery, plus pressure-washing equipment for exterior work.
            </p>

            <ul className="space-y-4 border-t border-sky-200/20 pt-6">
              {ticks.map((tick) => (
                <li key={tick} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-200 ring-1 ring-inset ring-emerald-200/40">
                    <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span className="text-slate-100 text-sm leading-relaxed">{tick}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
