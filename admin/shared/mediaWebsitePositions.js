import { WEBSITE_MEDIA_POSITIONS } from './mediaWebsiteCatalogue.js';
export { WEBSITE_MEDIA_POSITIONS };
export const WEBSITE_PHOTO_PAGE_KEYS = Object.freeze(WEBSITE_MEDIA_POSITIONS.filter(position => position.kind === 'photo').map(position => position.key));
export const WEBSITE_VIDEO_PAGE_KEYS = Object.freeze(WEBSITE_MEDIA_POSITIONS.filter(position => position.kind === 'video').map(position => position.key));
export const findWebsiteMediaPosition = key => WEBSITE_MEDIA_POSITIONS.find(position => position.key === key);
