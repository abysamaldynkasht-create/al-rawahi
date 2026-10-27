/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Reusable Commercial UI Component: Badge & StatusIndicator
 */

import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'gold' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({
  children,
  variant = 'slate',
  size = 'md',
  icon,
  className = '',
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
  };

  const variantStyles = {
    gold: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
