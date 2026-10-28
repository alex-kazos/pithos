import { useEffect } from 'react';

/**
 * Prevents the page behind a modal from scrolling while it's open. A
 * `fixed inset-0` overlay alone doesn't stop the body underneath it from
 * scrolling - this needs an explicit overflow lock, restored on unmount.
 *
 * `active` defaults to true, for components that only ever render while
 * their modal is shown. Pass it explicitly for a modal that's rendered
 * conditionally inside an always-mounted parent (e.g. `{show && <div .../>}`),
 * since the hook itself can't be called conditionally.
 */
export function useLockBodyScroll(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}
