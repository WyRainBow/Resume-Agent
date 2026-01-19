import React from 'react';

interface SidebarTooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

const sideClassMap: Record<NonNullable<SidebarTooltipProps['side']>, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
};

export function SidebarTooltip({
  content,
  children,
  side = 'right',
}: SidebarTooltipProps) {
  if (!content) {
    return <>{children}</>;
  }

  return (
    <span className="relative inline-flex group">
      {children}
      <span
        className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${sideClassMap[side]}`}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}

