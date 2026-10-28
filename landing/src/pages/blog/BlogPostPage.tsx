import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { getBlogPostBySlug, blogPosts } from '../../data/blogPosts';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { ROUTES } from '../../constants/routes';

const STRUCTURED_DATA_ID = 'blog-post-structured-data';

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPostBySlug(slug) : undefined;

  useDocumentMeta(
    post ? `${post.title} - StockPilot Blog` : 'Post not found - StockPilot Blog',
    post ? post.description : 'This post could not be found.'
  );

  // BlogPosting structured data helps Google show richer search results
  // (author, date) for this post - same JS-only caveat as useDocumentMeta.
  useEffect(() => {
    if (!post) return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = STRUCTURED_DATA_ID;
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      url: `https://stockpilotai.com/blog/${post.slug}`,
      author: { '@type': 'Organization', name: 'StockPilot' },
      publisher: { '@type': 'Organization', name: 'StockPilot' },
    });
    document.head.appendChild(script);

    return () => {
      document.getElementById(STRUCTURED_DATA_ID)?.remove();
    };
  }, [post]);

  if (!post) {
    return (
      <div className="container mx-auto px-4 pb-24 max-w-3xl text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Post not found</h1>
        <Link to={ROUTES.BLOG} className="text-indigo-400 hover:text-indigo-300">
          ← Back to the blog
        </Link>
      </div>
    );
  }

  const otherPosts = blogPosts.filter(p => p.slug !== post.slug).slice(0, 2);

  return (
    <div className="container mx-auto px-4 pb-24 max-w-3xl">
      <Link
        to={ROUTES.BLOG}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8 w-fit"
      >
        ← Back to blog
      </Link>

      <article>
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-300">
              {tag}
            </span>
          ))}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">{post.title}</h1>

        <div className="flex items-center gap-3 text-sm text-gray-500 mb-10">
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
          <span>·</span>
          <span>{post.readingTimeMinutes} min read</span>
        </div>

        <div className="prose prose-invert prose-indigo max-w-none prose-headings:font-semibold prose-a:text-indigo-400 hover:prose-a:text-indigo-300">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>

      {otherPosts.length > 0 && (
        <div className="mt-16 pt-8 border-t border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">More from the blog</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {otherPosts.map(p => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="block bg-[#1C1B23] border-2 border-gray-800 rounded-xl p-4 hover:border-indigo-500/50 transition-colors"
              >
                <p className="text-white font-medium">{p.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
