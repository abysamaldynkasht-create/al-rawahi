/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Reusable Commercial UI Component: Button
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'gold' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      icon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0b0f17] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-xs px-3.5 py-2 gap-2',
      lg: 'text-sm px-5 py-2.5 gap-2.5',
    };

    const variantStyles = {
      gold: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-950/40 hover:from-amber-400 hover:to-amber-300 focus:ring-amber-400 border border-amber-300/60',
      secondary:
        'bg-[#192233] text-slate-200 hover:bg-[#232f46] hover:text-white border border-[#2b3a56] focus:ring-amber-500/50 shadow-sm',
      outline:
        'bg-transparent text-amber-400 border border-amber-500/40 hover:bg-amber-500/10 focus:ring-amber-400/50',
      danger:
        'bg-rose-950/80 text-rose-200 hover:bg-rose-900 border border-rose-800/80 focus:ring-rose-500 shadow-sm',
      ghost:
        'bg-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 focus:ring-slate-500',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-current" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
