export interface ServiceTemplateGroup {
  group: string;
  templates: string[];
}

export const SERVICE_DESCRIPTION_TEMPLATES: ServiceTemplateGroup[] = [
  {
    group: 'Carpet cleaning',
    templates: [
      'Professional carpet cleaning — 1 bedroom',
      'Professional carpet cleaning — 2 bedrooms',
      'Professional carpet cleaning — 3 bedrooms',
      'Professional carpet cleaning — living room',
      'Professional carpet cleaning — hallway',
      'Professional carpet cleaning — one flight of stairs',
      'Professional carpet cleaning — bedroom, hallway and stairs',
      'Professional carpet cleaning — stain treatment',
    ],
  },
  {
    group: 'Upholstery',
    templates: [
      'Professional upholstery cleaning — 2-seater sofa',
      'Professional upholstery cleaning — 3-seater sofa',
      'Professional upholstery cleaning — 4-seater sofa',
      'Professional upholstery cleaning — L-shaped sofa',
      'Professional upholstery cleaning — armchair',
      'Professional upholstery cleaning — dining chair',
      'Professional carpet and upholstery cleaning',
    ],
  },
  {
    group: 'Mattress and rugs',
    templates: [
      'Mattress cleaning — single mattress',
      'Mattress cleaning — double mattress',
      'Mattress cleaning — king-size mattress',
      'Professional rug cleaning',
    ],
  },
  {
    group: 'Property cleaning',
    templates: [
      'End-of-tenancy cleaning — studio property',
      'End-of-tenancy cleaning — 1-bedroom property',
      'End-of-tenancy cleaning — 2-bedroom property',
      'End-of-tenancy cleaning — 3-bedroom property',
      'Professional deep cleaning',
      'After-builders cleaning',
    ],
  },
  {
    group: 'Additional services',
    templates: [
      'Professional oven cleaning',
      'Professional curtain cleaning',
      'Professional window cleaning',
      'Professional stair cleaning',
      'Professional office cleaning',
    ],
  },
];
