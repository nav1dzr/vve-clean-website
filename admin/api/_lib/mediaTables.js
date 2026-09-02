// Media data lives in its own CRM namespace by table prefix. These tables are
// never used for customers, bookings, invoices, or Auth, and browser table
// access remains closed by RLS.
export const MEDIA_ASSETS_TABLE = 'media_assets';
export const MEDIA_GALLERY_TOPICS_TABLE = 'media_gallery_topics';
export const MEDIA_GALLERY_SLOTS_TABLE = 'media_gallery_slots';
export const MEDIA_WEBSITE_SLOTS_TABLE = 'media_website_slots';
export const MEDIA_ASSIGNMENTS_TABLE = 'media_assignments';
export const MEDIA_REFERENCES_TABLE = 'media_page_references';
