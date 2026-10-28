import { Link } from 'react-router-dom';
import { blogPosts } from '../../data/blogPosts';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export default function BlogIndexPage() {
  useDocumentMeta(
    'Blog - StockPilot',
    'Guides on Shopify and WooCommerce inventory management, demand forecasting, and how to stop losing sales to stockouts.'
  );

  const sortedPosts = [...blogPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <div className="container mx-auto px-4 pb-24 max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <img src="/images/logo/stockpilot-icon.svg" alt="" className="w-7 h-7 rounded-md" />
        <h1 className="text-3xl md:text-4xl font-bold text-white">StockPilot Blog</h1>
      </div>
      <p className="text-gray-400 mb-12">
        Guides on Shopify and WooCommerce inventory management, demand forecasting, and avoiding stockouts.
      </p>

      <div className="space-y-6">
        {sortedPosts.map(post => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            className="block bg-[#1C1B23] border-2 border-gray-800 rounded-xl p-6 hover:border-indigo-500/50 transition-colors"
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {post.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-300">
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">{post.title}</h2>
            <p className="text-gray-400 mb-4">{post.description}</p>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
              <span>·</span>
              <span>{post.readingTimeMinutes} min read</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
