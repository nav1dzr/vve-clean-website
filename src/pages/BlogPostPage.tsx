import { useParams } from 'react-router-dom';
import BlogPostLayout from '../components/BlogPostLayout';
import NotFoundPage from './NotFoundPage';
import { BLOG_POSTS_BY_SLUG } from '../data/blog';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? BLOG_POSTS_BY_SLUG[slug] : undefined;

  if (!post) return <NotFoundPage />;

  return <BlogPostLayout post={post} />;
}
