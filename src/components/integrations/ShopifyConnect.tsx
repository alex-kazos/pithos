import React, { useState } from 'react';
import { ShoppingBag, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

interface ShopifyConnectProps {
  onClose: () => void;
}

export function ShopifyConnect({ onClose }: ShopifyConnectProps) {
  useLockBodyScroll();
  const { user } = useAuth();
  const [storeUrl, setStoreUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [showApiToken, setShowApiToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeUrl || !apiToken || !user) return;

    setConnecting(true);
    setError(null);

    try {
      // Save credentials to Firebase
      await setDoc(doc(db, 'shopify_credentials', user.uid), {
        shopUrl: storeUrl,
        apiToken: apiToken,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });

      // Test connection with backend
      const response = await fetch('/api/products', {
        method: 'GET',
        headers: {
          'X-User-ID': user.uid,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to connect to Shopify. Please check your credentials.');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Shopify. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  const toggleApiTokenVisibility = () => {
    setShowApiToken(!showApiToken);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="card card-hover max-w-md w-full relative bg-[#1C1B23] p-6 rounded-lg">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          ×
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-indigo-500/10 rounded-lg mb-4">
            <ShoppingBag className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-white text-center">Connect Your Shopify Store</h3>
          <p className="text-gray-400 text-center mt-2">Enter your store URL and Admin API token to get started</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center text-red-400">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="storeUrl" className="block text-sm font-medium text-gray-300 mb-2">
              Store URL
            </label>
            <input
              type="text"
              id="storeUrl"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="quickstart-d39ab598.myshopify.com"
              className="w-full px-4 py-2 bg-[#252432] border border-[#2D2B3B] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="apiToken" className="block text-sm font-medium text-gray-300 mb-2">
              Admin API Token
            </label>
            <div className="relative">
              <input
                type={showApiToken ? "text" : "password"}
                id="apiToken"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full px-4 py-2 bg-[#252432] border border-[#2D2B3B] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                required
              />
              <button
                type="button"
                onClick={toggleApiTokenVisibility}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showApiToken ? (
                  <Eye className="w-5 h-5" />
                ) : (
                  <EyeOff className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            <a
              href="https://www.youtube.com/watch?v=ZB6JtJPgBCQ"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 flex items-center"
            >
              Don't know how to create your Admin API?
            </a>
          </div>

          <button
            type="submit"
            disabled={connecting || !storeUrl || !apiToken}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {connecting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-5 h-5" />
                <span>Connect Store</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}