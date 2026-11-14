export type BuildersPhotoSlot = 'hero' | 'before' | 'after';

export interface BuildersJobPhoto {
  src: string;
  alt: string;
  caption?: string;
}

// Add an approved project photo here. Before and after must show the same job.
export const buildersJobPhotos: Partial<Record<BuildersPhotoSlot, BuildersJobPhoto>> = {};
