'use client';

import { useEffect } from 'react';

/**
 * Escape closes the dialog, and the page behind it stops scrolling while it's up.
 *
 * Every modal in the console was click-outside-only: keyboard users could open
 * one and had no way back out. Esc is the expected escape route, and locking the
 * body prevents the disorienting "I scrolled the page under the dialog" effect.
 */
export function useModal(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
}
