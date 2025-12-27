
import React from 'react';

interface GlitchTextProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export const GlitchText: React.FC<GlitchTextProps> = ({ 
  text, 
  className = "", 
  as: Component = 'span' 
}) => {
  return (
    <div className={`relative inline-block ${className}`}>
      <Component className="relative z-10">{text}</Component>
      <Component 
        className="absolute top-0 left-0 -z-10 text-hacker-glitch1 opacity-70 animate-glitch-text translate-x-[2px]" 
        aria-hidden="true"
      >
        {text}
      </Component>
      <Component 
        className="absolute top-0 left-0 -z-10 text-hacker-glitch2 opacity-70 animate-glitch-text -translate-x-[2px]" 
        aria-hidden="true"
      >
        {text}
      </Component>
    </div>
  );
};
