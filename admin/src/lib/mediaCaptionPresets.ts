import type { BeforeAfter, MediaCategory, MediaType } from "../types/media";

export type MediaCaptionPreset = {
  id: "simple" | "service" | "stage";
  label: string;
  title: string;
  altText: string;
};

const services = {
  carpet: { subject: "Carpet", title: "Carpet cleaning", work: "carpet cleaning" },
  "sofa-upholstery": {
    subject: "Upholstery",
    title: "Sofa & upholstery cleaning",
    work: "sofa and upholstery cleaning",
  },
  "end-of-tenancy": {
    subject: "End of tenancy",
    title: "End-of-tenancy cleaning",
    work: "end-of-tenancy cleaning",
  },
  "property-services": {
    subject: "Property",
    title: "Property services",
    work: "property services",
  },
} as const;

// These are editable starters based only on the owner's classifications.
// Do not add inferred locations, materials, treatments or cleaning outcomes.
export function mediaCaptionPresets(
  category: MediaCategory,
  stage: BeforeAfter,
  mediaType: MediaType,
): MediaCaptionPreset[] {
  const service = services[category];
  const type = mediaType === "video" ? "video" : "photo";
  const Type = mediaType === "video" ? "Video" : "Photo";
  if (stage === "none") {
    return [
      {
        id: "simple", label: "Simple caption",
        title: `${service.title} ${type}`,
        altText: `${Type} from our ${service.work} work.`,
      },
      {
        id: "service", label: "Service first",
        title: `${service.title} — our work`,
        altText: `Our ${service.work} work, shown in a ${type}.`,
      },
      {
        id: "stage", label: "Short title",
        title: "A look at our work",
        altText: `A ${type} from our ${service.work} work.`,
      },
    ];
  }
  const Stage = stage.charAt(0).toUpperCase() + stage.slice(1);
  const activity = category === "property-services" ? "work" : "cleaning";
  return [
    {
      id: "simple", label: "Simple caption",
      title: category === "end-of-tenancy"
        ? `${Stage} the end-of-tenancy clean`
        : `${service.subject} ${stage} ${activity}`,
      altText: stage === "during"
        ? `${Type} taken during our ${service.work} work.`
        : `${Stage}-${activity} ${type} from our ${service.work} work.`,
    },
    {
      id: "service", label: "Service first",
      title: `${service.title} — ${stage}`,
      altText: `${Type} from our ${service.work} work, taken ${stage} ${activity}.`,
    },
    {
      id: "stage", label: "Short title",
      title: `${Stage} ${activity}`,
      altText: `Our ${service.work} work, shown ${stage} ${activity} in this ${type}.`,
    },
  ];
}
