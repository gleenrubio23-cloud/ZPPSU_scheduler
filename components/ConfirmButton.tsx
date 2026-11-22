'use client';
import type { ReactNode } from 'react';

/** A submit button that asks "Are you sure?" first. */
export default function ConfirmButton({
  message, className, children,
}: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
