/** Source catalogue for the generated CRM/public placement contract.
 * Read real website manifests here; never copy a second gallery image list.
 * Run node scripts/generateWebsiteMediaPositions.mjs after changing defaults.
 */
import { GALLERY_MEDIA, CARPET_FEATURED_BEFORE_AFTER, EOT_FEATURED_BEFORE_AFTER, EOT_ROTATING_PHOTOS, type GalleryItem, type GalleryCategory } from './galleryMedia';
import { CARPET_PROCESS_VIDEO, CARPET_RESULT_VIDEOS } from './carpetMedia';
import { SOFA_MEDIA, SOFA_FEATURE_VIDEO } from './sofaMedia';
import { HOMEPAGE_CURATED_PROOF, getHomepageProofPairs } from './homepageProof';
import { AREAS } from './areas';
import { getAreaShowcaseVideos } from './areaShowcase';
import { matchesNamedArea } from '../lib/areaMatch';
import { TEAM_MEMBERS } from './team';
import { buildersJobPhotos } from './afterBuildersPhotos';

export type WebsiteMediaPosition = {
  key: string; slotKey: string; targetType: 'website' | 'gallery'; kind: 'photo' | 'video' | 'before_after';
  category: GalleryCategory | 'property-services'; topicKey?: string; pageLabel: string; purposeLabel: string;
  description: string; defaultMedia: GalleryItem | null; fallbackService?: GalleryCategory;
  pages: { path: string; label: string; section: string }[];
};
const still = (id: string, src: string, alt: string, label = alt): GalleryItem => ({ type: 'photo', id, src, alt, label });
const identity = (item: GalleryItem) => item.type === 'before-after' ? `${item.before}|${item.after}` : item.src;
const services = [
  { category: 'carpet', topic: 'carpet', label: 'Carpet cleaning', path: '/carpet-cleaning-london', src: '/images/carpet-cleaning-hero.webp', alt: 'Extraction equipment working on a blue carpet', caption: 'Carpet extraction in progress', cardAlt: 'Extraction equipment cleaning a blue carpet', cardTitle: 'Carpet cleaning', slideAlt: 'Extraction equipment cleaning a blue carpet', slideCaption: 'Carpet extraction in progress' },
  { category: 'sofa-upholstery', topic: 'sofa', label: 'Sofa & upholstery', path: '/sofa-cleaning-london', src: '/sofa_upholstery/web/gallery/sofa-gallery-01.webp', alt: 'A technician cleaning sofa upholstery', caption: 'Upholstery cleaning in progress', cardAlt: 'A technician cleaning sofa upholstery', cardTitle: 'Sofa & upholstery cleaning', slideAlt: 'A VVE Clean technician in branded uniform cleaning a navy velvet sofa', slideCaption: 'Cleaning a velvet sofa' },
  { category: 'end-of-tenancy', topic: 'end-of-tenancy', label: 'End of tenancy', path: '/end-of-tenancy-cleaning-london', src: '/end_of_tenancy/before-after/kitchen1_after.jpg', alt: 'Kitchen hob after cleaning', caption: 'A real end of tenancy result', cardAlt: 'Kitchen hob after cleaning', cardTitle: 'End of tenancy cleaning', slideAlt: 'Kitchen hob after cleaning', slideCaption: 'Kitchen hob after cleaning' },
] as const;

export function createWebsiteMediaPositions(): WebsiteMediaPosition[] {
  const positions: WebsiteMediaPosition[] = [];
  const add = (position: WebsiteMediaPosition) => { positions.push(position); return position; };
  const named = (key: string, pageLabel: string, purposeLabel: string, path: string, category: WebsiteMediaPosition['category'], defaultMedia: GalleryItem | null, extra: Partial<WebsiteMediaPosition> = {}) => add({
    key, slotKey: key, targetType: 'website', kind: 'photo', category, pageLabel, purposeLabel,
    description: 'Replaces this photograph only. Removing the selection restores the built-in photograph, or hides the section when no default exists.',
    defaultMedia, pages: [{ path, label: pageLabel, section: purposeLabel }], ...extra,
  });
  for (const service of services) {
    const fallback = still(`${service.topic}-hero`, service.src, service.alt, service.caption);
    named(`service-${service.topic}-hero`, service.label, 'Opening photograph', `${service.path}#main-content`, service.category, fallback, { fallbackService: service.category, description: 'This named opening photo takes priority. When empty, the first suitable service result is used, then the built-in photograph.' });
    named(`homepage-service-${service.topic}`, 'Homepage', `Service card · ${service.label}`, '/#services', service.category, still(`homepage-service-${service.topic}`, service.src, service.cardAlt, service.cardTitle));
    named(service.topic === 'carpet' ? 'homepage-hero-image' : `homepage-${service.topic}-image`, 'Homepage', `Opening slideshow · ${service.label}`, '/#cleaning-photos', service.category, still(`homepage-slide-${service.topic}`, service.src, service.slideAlt, service.slideCaption),
      service.topic === 'carpet' ? { slotKey: 'homepage-hero' } : { fallbackService: service.category });
  }
  const equipment = still('equipment', '/gallery/van-equipment.webp', 'VVE Clean van and cleaning equipment');
  named('homepage-equipment-image', 'Homepage', 'The equipment we bring', '/#equipment', 'property-services', equipment, { slotKey: 'homepage-equipment' });
  named('about-equipment-image', 'About', 'Our story', '/about#main-content', 'property-services', equipment);

  const homePool = new Set<string>();
  // The daily selection has a fixed set of sources. Include every potential
  // source in impact previews, not just the two selected on today's date.
  for (let day = 0; day < 366; day += 1)
    for (const pair of getHomepageProofPairs(new Date(Date.UTC(2026, 0, 1 + day)))) homePool.add(`${pair.before}|${pair.after}`);
  const areas = AREAS.filter(area => area.coverageConfirmed !== false);
  for (const service of services) {
    const sectionItems = service.category === 'carpet'
      ? [...CARPET_FEATURED_BEFORE_AFTER, ...CARPET_RESULT_VIDEOS, ...(CARPET_PROCESS_VIDEO ? [CARPET_PROCESS_VIDEO] : [])]
      : service.category === 'sofa-upholstery' ? SOFA_MEDIA : [...EOT_FEATURED_BEFORE_AFTER, ...EOT_ROTATING_PHOTOS];
    for (const item of GALLERY_MEDIA[service.category]) {
      const kind = item.type === 'before-after' ? 'before_after' : item.type;
      const section = item.type === 'before-after' ? 'Before-and-after results' : item.type === 'video' ? 'Cleaning videos' : 'Job photographs';
      const key = `builtin-${service.category}-${item.id}`;
      const pages = [{ path: `/gallery?category=${service.category}#gallery-collection`, label: 'Gallery', section: `${service.label} · ${section}` }];
      if (sectionItems.some(candidate => candidate.id === item.id)) {
        const anchor = item.id === CARPET_PROCESS_VIDEO?.id ? 'process' : item.type === 'before-after' ? 'results' : service.category === 'sofa-upholstery' ? (item.id === SOFA_FEATURE_VIDEO.id ? 'extraction' : 'gallery') : 'results';
        pages.push({ path: `${service.path}#${anchor}`, label: service.label, section });
        if (service.category === 'carpet') pages.push({ path: `/how-we-clean-carpets#${anchor}`, label: 'How we clean carpets', section });
        if (service.category === 'sofa-upholstery' && (item.type === 'before-after' || item.id === SOFA_FEATURE_VIDEO.id))
          pages.push({ path: `/how-we-clean-sofas-upholstery#${anchor}`, label: 'How we clean sofas', section });
      }
      if (item.type === 'before-after' && homePool.has(identity(item))) pages.push({ path: '/#gallery', label: 'Homepage', section: `Before-and-after results · ${service.label}` });
      if (item.id === 'carpet-office') pages.push({ path: '/commercial-carpet-cleaning-london#main-content', label: 'Commercial carpet', section: 'Office carpet before and after' });
      for (const area of areas) {
        if (item.type === 'video' && getAreaShowcaseVideos(area.slug).some(video => video.src === item.src)) pages.push({ path: `/cleaning-${area.slug}#area-services`, label: 'Local area pages', section: `${area.name} · Cleaning in progress` });
        if (matchesNamedArea(item.location, area.name)) pages.push({ path: `/cleaning-${area.slug}#main-content`, label: 'Local area pages', section: `${area.name} · Tagged job` });
      }
      add({ key, slotKey: kind === 'before_after' ? `BUILTIN_${item.id.replace(/-/g, '_').toUpperCase()}` : key,
        targetType: kind === 'before_after' ? 'gallery' : 'website', kind, category: service.category, topicKey: service.topic,
        pageLabel: service.label, purposeLabel: item.label, defaultMedia: item, pages,
        description: kind === 'before_after' ? 'Replaces this complete comparison everywhere listed. Choose two photographs from the same job. Both sides are published together.' : 'Replaces this original website item everywhere listed, including its larger gallery view. Choose media that matches the purpose of this position.',
      });
    }
  }
  for (const pair of HOMEPAGE_CURATED_PROOF) {
    const media: GalleryItem = { ...pair, type: 'before-after' };
    if (positions.some(position => position.defaultMedia && identity(position.defaultMedia) === identity(media))) continue;
    const category = pair.service.includes('Carpet') ? 'carpet' : pair.service.includes('Upholstery') ? 'sofa-upholstery' : 'property-services';
    add({ key: `homepage-proof-${pair.id}`, slotKey: `BUILTIN_HOME_${pair.id.replace(/-/g, '_').toUpperCase()}`, targetType: 'gallery', kind: 'before_after', category, topicKey: category === 'sofa-upholstery' ? 'sofa' : category,
      pageLabel: 'Homepage', purposeLabel: `Before-and-after results · ${pair.service}`, defaultMedia: media, pages: [{ path: '/#gallery', label: 'Homepage', section: `Before-and-after results · ${pair.service}` }], description: 'Replaces both sides of this homepage comparison together. Choose before and after photographs from the same job.' });
  }
  for (const [index, member] of TEAM_MEMBERS.entries()) if (member.photo) named(`about-team-${index + 1}`, 'About', `Our team · ${member.name}`, '/about#main-content', 'property-services', still(`team-${member.name}`, member.photo, member.name));
  const hero = buildersJobPhotos.hero;
  named('after-builders-hero', 'After builders', 'Opening photograph', '/after-builders-cleaning-london#main-content', 'property-services', hero?.src && hero.alt.trim() ? still('builders-hero', hero.src, hero.alt) : null);
  named('homepage-service-after-builders', 'Homepage', 'Service card · After builders', '/#services', 'property-services', null);
  const { before, after } = buildersJobPhotos;
  add({ key: 'after-builders-comparison', slotKey: 'BUILTIN_AFTER_BUILDERS', targetType: 'gallery', kind: 'before_after', category: 'property-services', topicKey: 'property-services', pageLabel: 'After builders', purposeLabel: 'Before and after the builders’ clean',
    defaultMedia: before?.src && after?.src && before.alt.trim() && after.alt.trim() ? { type: 'before-after', id: 'builders-comparison', label: 'Before and after the builders’ clean', before: before.src, after: after.src, beforeAlt: before.alt, afterAlt: after.alt } : null,
    pages: [{ path: '/after-builders-cleaning-london#builders-results', label: 'After builders', section: 'Before and after the builders’ clean' }], description: 'Hidden until a complete before-and-after pair is published. Both photographs must be from the same job.' });
  return positions;
}
