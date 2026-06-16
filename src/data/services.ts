// Central image registry — all paths are local assets stored in public/.
// IMPORTANT: Do NOT change these paths unless the files in public/ are also renamed.
// These images must remain permanently connected even if design, layout, or text changes are made.

export const SERVICE_IMAGES = {
  deepCleaning:    '/images/services/Deep_Cleaning.png',
  endOfTenancy:    '/images/services/End_of_Tenancy.png',
  gardeningService:'/images/services/gardening-service.png',
  gutterCleaning:  '/images/services/Gutter_Cleaning.png',
  officeService:   '/images/services/Office_Service.png',
  pressureWashing: '/images/services/Pressure_Washing.jpg',
  windowCleaning:  '/images/services/Window_Cleaning.jpg',
} as const;

export const BEFORE_AFTER_IMAGES = {
  drivewayBefore:       '/images/before-after/driveway_pressure_washing_before.png',
  drivewayAfter:        '/images/before-after/driveway_pressure_washing_after.png',
  deepCleaningBefore:   '/images/before-after/deep_cleaning_before.png',
  deepCleaningAfter:    '/images/before-after/deep_cleaning_after.png',
  endOfTenancyBefore:   '/images/before-after/End_of_tenancy_before.jpg',
  endOfTenancyAfter:    '/images/before-after/End_of_tenancy_after.jpg',
  windowCleaningBefore: '/images/before-after/window_cleaning_before.png',
  windowCleaningAfter:  '/images/before-after/window_cleaning_after.png',
} as const;

export const BEFORE_AFTER_PAIRS = [
  {
    before: '/gallery/End_of_tenancy_before.jpg',
    after:  '/gallery/End_of_tenancy_after.jpg',
    label:  'End of Tenancy',
  },
  {
    before: '/gallery/carpet_cleaning_before_.jpg',
    after:  '/gallery/carpet_cleaning_after.jpg',
    label:  'Carpet Cleaning',
  },
  {
    before: '/gallery/upholstery_before.jpg',
    after:  '/gallery/upholstery_after.jpg',
    label:  'Upholstery Clean',
  },
  {
    before: '/gallery/driveway_pressure_washing_before.png',
    after:  '/gallery/driveway_pressure_washing_after.png',
    label:  'Pressure Washing',
  },
] as const;
