'use client';
import { useEffect } from 'react';

/** Removes the flash-message cookie once the messages are on screen, so they show only once. */
export default function FlashClear() {
  useEffect(() => {
    document.cookie = 'classsched_flash=; Max-Age=0; path=/; SameSite=Lax';
  }, []);
  return null;
}
