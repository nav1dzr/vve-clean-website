import type { BlogPost } from './types';
import { londonDepositDeductionGuide } from './posts/london-deposit-deduction-guide';

export type { BlogPost, BlogPostBlock } from './types';

// One seed post proves the blog pipeline end-to-end (routing, layout,
// prerender, sitemap). The remaining three posts named in the SEO brief
// ("End of Tenancy Checklist", "Carpet Cleaning Before Moving", "How to
// Choose a Cleaner in Hackney") are a content-authoring follow-up on this
// same infrastructure, not part of this change.
export const BLOG_POSTS: BlogPost[] = [londonDepositDeductionGuide];

export const BLOG_POSTS_BY_SLUG: Record<string, BlogPost> = Object.fromEntries(
  BLOG_POSTS.map((post) => [post.slug, post]),
);
