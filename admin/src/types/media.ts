export type MediaType = 'image' | 'video';
export type MediaStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'archived';
export type MediaCategory = 'end-of-tenancy' | 'carpet' | 'sofa-upholstery';
export type MediaPlacement = 'main-home' | 'gallery-end-of-tenancy' | 'gallery-carpet' | 'gallery-sofa' | 'carpet-page' | 'sofa-page' | 'end-of-tenancy-page';
export type BeforeAfter = 'before' | 'after' | 'none';

export interface MediaAsset {
  id: string;
  mediaType: MediaType;
  status: MediaStatus;
  title: string;
  altText: string;
  service: string;
  category: MediaCategory;
  placement: MediaPlacement;
  beforeAfter: BeforeAfter;
  pairKey: string;
  locationLabel: string;
  websiteVisible: boolean;
  googleEnabled: boolean;
  socialEnabled: boolean;
  requestedSlotKey: string | null;
  activeSlotKey: string | null;
  usages: MediaUsage[];
  imageUrl: string | null;
  muxPlaybackId: string | null;
  processingError: string;
  createdAt: string;
}

export interface MediaUsage {
  key: string;
  pageKey: string;
  pageLabel: string;
  componentLabel: string;
}

export interface MediaAssignment {
  assetId: string;
  role: 'before' | 'after' | 'primary';
}

export interface GalleryTopic {
  key: 'carpet' | 'sofa' | 'end-of-tenancy' | string;
  label: string;
  description: string;
  sortOrder: number;
}

export interface GallerySlot {
  id: string;
  topicKey: string;
  code: string;
  kind: 'before_after' | 'video' | 'photo';
  label: string;
  sortOrder: number;
  assignments: MediaAssignment[];
  usages: MediaUsage[];
}

export interface WebsiteSlot {
  id: string;
  key: string;
  pageLabel: string;
  purposeLabel: string;
  description: string;
  sortOrder: number;
  assignments: MediaAssignment[];
  usages: MediaUsage[];
}

export interface MediaReference {
  id: string;
  key: string;
  pageKey: string;
  pageLabel: string;
  componentLabel: string;
  gallerySlotId: string | null;
  websiteSlotId: string | null;
  sortOrder: number;
}

export interface MediaLibrary {
  assets: MediaAsset[];
  topics: GalleryTopic[];
  gallerySlots: GallerySlot[];
  websiteSlots: WebsiteSlot[];
  references: MediaReference[];
}
