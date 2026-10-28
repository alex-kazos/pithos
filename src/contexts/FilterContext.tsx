import React, { createContext, useContext, useState, ReactNode } from 'react';

interface FilterContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  selectedTimeRange: string;
  setSelectedTimeRange: (range: string) => void;
  customDateRange: { from: string; to: string };
  setCustomDateRange: (range: { from: string; to: string }) => void;
  useCustomDateRange: boolean;
  setUseCustomDateRange: (use: boolean) => void;
  stockRange: { min: number; max: number | null };
  setStockRange: (range: { min: number; max: number | null }) => void;
  salesRange: { min: number; max: number | null };
  setSalesRange: (range: { min: number; max: number | null }) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTimeRange, setSelectedTimeRange] = useState('Last 12 Months');
  const [customDateRange, setCustomDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [stockRange, setStockRange] = useState<{ min: number; max: number | null }>({ min: 0, max: null });
  const [salesRange, setSalesRange] = useState<{ min: number; max: number | null }>({ min: 0, max: null });

  return (
    <FilterContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        selectedTimeRange,
        setSelectedTimeRange,
        customDateRange,
        setCustomDateRange,
        useCustomDateRange,
        setUseCustomDateRange,
        stockRange,
        setStockRange,
        salesRange,
        setSalesRange
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
}
