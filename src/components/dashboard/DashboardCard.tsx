import React from 'react';

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`col-span-2 bg-surface p-6 rounded-xl border border-white/[0.07] font-archivo ${className}`}>
      {children}
    </div>
  );
};
