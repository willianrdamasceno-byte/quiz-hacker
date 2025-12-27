
import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = Math.round((current / total) * 100);
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between mb-1 text-xs text-hacker-green/70 uppercase tracking-tighter">
        <span>Progress: {current}/{total}</span>
        <span>{percentage}% Complete</span>
      </div>
      <div className="h-4 bg-hacker-dark border border-hacker-green relative overflow-hidden">
        <div 
          className="h-full bg-hacker-green transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,255,65,0.5)]"
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-hacker-dark/30" />
          ))}
        </div>
      </div>
    </div>
  );
};
