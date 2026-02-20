'use client';

import { Clock } from 'lucide-react';

interface TimerProps {
  seconds: number;
  formatted: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Timer({ seconds, formatted, size = 'md' }: TimerProps) {
  const hours = Math.floor(seconds / 3600);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-8 h-8',
  };

  return (
    <div className="flex items-center gap-2 text-text-primary">
      <Clock className={`${iconSizes[size]} text-accent-gold`} />
      <span className={`font-mono font-bold ${sizeClasses[size]}`}>
        {formatted}
      </span>
    </div>
  );
}
