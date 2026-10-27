/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * AL RAWAHI GARAGE MANAGEMENT SYSTEM - AKASHA AI
 * 
 * Reusable Commercial UI Component: Card & Panel
 */

import React from 'react';

export function Card({
  children,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-[#222d42] bg-[#121927] text-slate-100 shadow-md ${
        onClick ? 'cursor-pointer hover:border-amber-500/40 hover:bg-[#161f30] transition-all' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 sm:p-5 border-b border-[#1f293d] flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  icon,
  className = '',
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-sm font-semibold text-slate-100 flex items-center gap-2.5 ${className}`}>
      {icon && <span className="text-amber-400 shrink-0">{icon}</span>}
      <span>{children}</span>
    </h3>
  );
}

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}
