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
  return [
    {
      id: "simple", label: "Simple caption",
      title: category === "end-of-tenancy"
        ? `${Stage} the end-of-tenancy clean`
        : `${service.subject} ${stage} cleaning`,
      altText: stage === "during"
        ? `${Type} taken during our ${service.work} work.`
        : `${Stage}-cleaning ${type} from our ${service.work} work.`,
    },
    {
      id: "service", label: "Service first",
      title: `${service.title} — ${stage}`,
      altText: `${Type} from our ${service.work} work, taken ${stage} cleaning.`,
    },
    {
      id: "stage", label: "Short title",
      title: `${Stage} cleaning`,
      altText: `Our ${service.work} work, shown ${stage} cleaning in this ${type}.`,
    },
  ];
}
