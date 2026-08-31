export type MediaType = 'image' | 'video';
export type MediaStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'archived';
export type MediaCategory = 'end-of-tenancy' | 'carpet' | 'sofa-upholstery';
export type BeforeAfter = 'before' | 'after' | 'none';

export interface MediaAsset {
  id: string;
  mediaType: MediaType;
  status: MediaStatus;
  title: string;
  altText: string;
  service: string;
  category: MediaCategory;
  beforeAfter: BeforeAfter;
  pairKey: string;
  locationLabel: string;
  websiteVisible: boolean;
  googleEnabled: boolean;
  socialEnabled: boolean;
  requestedSlotKey: string | null;
  activeSlotKey: string | null;
  imageUrl: string | null;
  muxPlaybackId: string | null;
  processingError: string;
  createdAt: string;
}

export interface MediaSlot {
  key: string;
  label: string;
  assetId: string | null;
}

export interface MediaLibrary {
  assets: MediaAsset[];
  slots: MediaSlot[];
}
