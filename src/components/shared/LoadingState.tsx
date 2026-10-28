import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading your store...' }) => {
  return (
    <div className="min-h-screen bg-[#13111c] flex flex-col items-center justify-center p-6">
      <div className="text-center">
        <Loader className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
};
