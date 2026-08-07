// Real Google review quotes, extracted from Reviews.tsx so area pages can
// filter them by location without duplicating content. Reviews.tsx imports
// this back — same data, same runtime output.
//
// `rating` is the star count recorded against that specific review on the
// Google profile. Every card previously drew a hardcoded five filled stars
// regardless — an assumption, not data. A card shows stars only when its own
// rating has been read off the profile and entered here. None have been, so
// the field is absent everywhere and the quoted text stands on its own.
export interface Review {
  name: string;
  initial: string;
  color: string;
  location: string;
  service: string;
  date: string;
  isLocalGuide: boolean;
  text: string;
  /** Verified star count for THIS review. Omit unless read off the profile. */
  rating?: number;
}

export const REVIEWS: Review[] = [
  {
    name: 'Hannah M.',
    initial: 'H',
    color: '#5d4037',
    location: 'Islington, N1',
    service: 'End of Tenancy',
    date: 'June 2026',
    isLocalGuide: true,
    text: 'Amazing job for my end of tenancy clean — the carpets looked brand new and they even included the oven cleaning for free. Very professional and thorough from start to finish.',
  },
  {
    name: 'Marcin P.',
    initial: 'M',
    color: '#1a237e',
    location: 'East London',
    service: 'Sofa Cleaning',
    date: 'June 2026',
    isLocalGuide: true,
    text: 'I am happy with the sofa cleaning service. The guys were eager, energetic, and worked efficiently throughout the job. Great results and a very professional team.',
  },
  {
    name: 'Ahmad B.',
    initial: 'A',
    color: '#e53935',
    location: 'Stratford, E15',
    service: 'Carpet Cleaning',
    date: 'June 2026',
    isLocalGuide: false,
    text: 'Really happy with the service. The team did a brilliant job on my end of tenancy carpet clean. The carpets looked fresh and like new again. Friendly, professional, and great results. Would definitely recommend.',
  },
  {
    name: 'Snehal F.',
    initial: 'S',
    color: '#7b1fa2',
    location: 'London',
    service: 'Carpet & Sofa',
    // No verified date is available for this review, so we show a neutral
    // "Google review" label instead of guessing — never fabricate a date.
    date: 'Google review',
    isLocalGuide: false,
    text: 'Brilliant service from VVE clean. They done a great job at my house. My carpets and couch look like I just bought it new. Thankyou so much! Very good customer service.',
  },
  {
    name: 'Sam M.',
    initial: 'S',
    color: '#00796b',
    location: 'London',
    service: 'Carpet Cleaning',
    date: 'Google review',
    isLocalGuide: false,
    text: 'Very professional, punctual, and polite. My carpets look brand new again after the cleaning. I highly recommend them and will definitely use their services again.',
  },
];
