import React from 'react';

/**
 * LoadingSpinner Component
 * 
 * Displays a centered loading animation while content is being loaded.
 * Used as a fallback for Suspense boundaries and loading states.
 */
export const LoadingSpinner: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#13111C] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
};
