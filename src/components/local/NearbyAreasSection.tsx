import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { LocalAreaConfig } from '../../data/localEotAreas';

// Exactly three links to other implemented local pages, per the approved
// nearby graph in src/data/localEotAreas.ts — every destination is a real,
// routed page (see AppRoutes.tsx), never a placeholder.
export default function NearbyAreasSection({
  area,
  nearby,
}: {
  area: LocalAreaConfig;
  nearby: LocalAreaConfig[];
}) {
  return (
    <section className="max-w-4xl mx-auto px-4 py-16">
      <h2 className="font-display text-xl font-bold text-navy-900 mb-5 text-center">
        We also cover areas near {area.areaName}
      </h2>
      <div className="flex flex-wrap justify-center gap-3">
        {nearby.map((n) => (
          <Link
            key={n.slug}
            to={n.path}
            className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-royal-500 text-slate-700 hover:text-royal-600 text-sm font-medium px-4 py-2 rounded-full transition-all duration-200 bg-white hover:bg-royal-50"
          >
            <MapPin size={13} className="text-royal-500 flex-shrink-0" aria-hidden="true" />
            End of Tenancy Cleaning in {n.areaName} ({n.postcode})
          </Link>
        ))}
      </div>
    </section>
  );
}
