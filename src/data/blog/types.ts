import type { ReactNode } from 'react';

// Content is block-typed rather than raw freeform JSX per post, so
// BlogPostLayout controls consistent typography/spacing/anchor IDs across
// every post — the same balance ServiceLandingData strikes for benefits/FAQs.
// `ReactNode` content still allows inline links and emphasis within a block.
export type BlogPostBlock =
  | { type: 'heading'; text: string; id: string }
  | { type: 'paragraph'; content: ReactNode }
  | { type: 'list'; items: ReactNode[] }
  | { type: 'callout'; content: ReactNode };

export interface BlogPost {
  slug: string;
  title: string;
  /** Used for the meta description and the index-page card. */
  excerpt: string;
  /** ISO date (YYYY-MM-DD), real — never backdated or invented. */
  publishedDate: string;
  updatedDate?: string;
  category: string;
  body: BlogPostBlock[];
  relatedServiceHref?: string;
  relatedServiceLabel?: string;
}
