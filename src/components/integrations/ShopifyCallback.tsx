import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

export function ShopifyCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Setting up your integration...');
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      try {
        // Simulate the integration process with progress updates
        setProgress(20);
        setMessage('Validating authentication...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        setProgress(40);
        setMessage('Fetching store information...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        setProgress(60);
        setMessage('Syncing product catalog...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        setProgress(80);
        setMessage('Setting up inventory tracking...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        setProgress(100);
        setMessage('Integration complete!');
        setStatus('success');

        // Redirect after showing success
        setTimeout(() => {
          navigate('/features/integration');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Failed to complete integration');
      }
    }

    handleCallback();
  }, [navigate]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#13111C] flex items-center justify-center p-4">
        <div className="card card-hover max-w-md w-full text-center py-12">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-6" />
          <h2 className="text-2xl font-semibold text-white mb-4">Connection Failed</h2>
          <p className="text-gray-400 mb-8">{message}</p>
          <button
            onClick={() => navigate('/features/integration')}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            <span>Try Again</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#13111C] flex items-center justify-center p-4">
      <div className="card card-hover max-w-md w-full py-12">
        <div className="text-center">
          {status === 'loading' ? (
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-6" />
          ) : (
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-6" />
          )}

          <h2 className="text-2xl font-semibold text-white mb-4">
            {status === 'loading' ? 'Setting Up Integration' : 'Integration Complete!'}
          </h2>
          <p className="text-gray-400 mb-8">{message}</p>

          {status === 'loading' && (
            <div className="max-w-xs mx-auto">
              <div className="h-2 bg-[#2D2B3B] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-400 mt-2">{progress}% complete</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}