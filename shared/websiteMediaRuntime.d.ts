export const WEBSITE_MEDIA_RUNTIME: readonly {
  key: string;
  kind: 'photo' | 'video' | 'before_after';
  defaultMedia: { type: 'photo' | 'video'; src: string } | { type: 'before-after'; before: string; after: string } | null;
}[];
