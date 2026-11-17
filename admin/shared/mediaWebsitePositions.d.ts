export const WEBSITE_PHOTO_PAGE_KEYS: readonly string[];
export const WEBSITE_VIDEO_PAGE_KEYS: readonly string[];
export type WebsiteMediaPosition = import('../../src/data/websiteMediaPositionSource').WebsiteMediaPosition;
export const WEBSITE_MEDIA_POSITIONS: readonly WebsiteMediaPosition[];
export function findWebsiteMediaPosition(key: string): WebsiteMediaPosition | undefined;
