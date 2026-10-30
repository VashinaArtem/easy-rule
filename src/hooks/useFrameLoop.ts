import { useEffect, useRef, type RefObject } from 'react';

/**
 * Runs `frame` on every animation frame while the element is on screen and the
 * tab is visible. `frame` receives elapsed seconds since the previous frame.
 */
export function useFrameLoop(target: RefObject<Element | null>, frame: (dt: number, time: number) => void) {
  const frameRef = useRef(frame);
  useEffect(() => {
    frameRef.current = frame;
  });

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let raf = 0;
    let last = 0;
    let onScreen = true;

    const tick = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      frameRef.current(dt, now / 1000);
      schedule();
    };
    const schedule = () => {
      if (!raf && onScreen && document.visibilityState === 'visible') raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) schedule();
      else stop();
    });
    io.observe(el);
    const onVisibility = () => (document.visibilityState === 'visible' ? schedule() : stop());
    document.addEventListener('visibilitychange', onVisibility);
    schedule();

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [target]);
}
