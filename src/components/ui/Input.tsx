/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Reusable Commercial UI Component: Input & SearchInput
 */

import React from 'react';
import { Search } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-[#111827] text-slate-100 placeholder-slate-500 text-xs rounded-lg border ${
              error ? 'border-rose-500/80 focus:ring-rose-500' : 'border-[#243048] focus:border-amber-500/80 focus:ring-amber-500/40'
            } ${icon ? 'ps-9 pe-3' : 'px-3'} py-2 focus:outline-none focus:ring-1 transition-colors shadow-inner disabled:opacity-50 disabled:bg-slate-900 ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-[11px] text-rose-400 mt-1">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export function SearchInput({
  placeholder = 'Search...',
  value,
  onChange,
  className = '',
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <Input
      icon={<Search className="w-3.5 h-3.5 text-amber-400/80" />}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`max-w-xs ${className}`}
    />
  );
}
