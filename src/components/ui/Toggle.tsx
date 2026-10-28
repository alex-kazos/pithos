import React from 'react';

interface ToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  leftLabel: string;
  rightLabel: string;
}

export default function Toggle({ enabled, onChange, leftLabel, rightLabel }: ToggleProps) {
  return (
    <div className="flex items-center justify-center space-x-4">
      <span className={`text-sm ${!enabled ? 'text-white' : 'text-gray-400'}`}>
        {leftLabel}
      </span>
      <button
        onClick={() => onChange(!enabled)}
        className="relative w-14 h-7 bg-gray-700 rounded-full transition-colors hover:bg-gray-600"
        aria-checked={enabled}
        role="switch"
      >
        <span 
          className={`block w-5 h-5 bg-[#6366F1] rounded-full transition-transform duration-200 ease-in-out ${
            enabled ? 'translate-x-8' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-sm ${enabled ? 'text-white' : 'text-gray-400'}`}>
        {rightLabel}
      </span>
    </div>
  );
}