import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Content is readable in server HTML; motion is an optional enhancement. */
export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined' || !el.animate) return;
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let animation: Animation | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (prefersReducedMotion()) { observer.disconnect(); return; }
      animation = el.animate(
        [{ opacity: 0.9, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 300, easing: 'ease-out' },
      );
      observer.disconnect();
    }, { threshold: 0.08 });
    const stopOnReducedMotion = () => {
      if (motionQuery?.matches) { observer.disconnect(); animation?.cancel(); }
    };
    motionQuery?.addEventListener?.('change', stopOnReducedMotion);
    observer.observe(el);
    return () => {
      observer.disconnect();
      animation?.cancel();
      motionQuery?.removeEventListener?.('change', stopOnReducedMotion);
    };
  }, []);

  return { ref, visible: true };
}

export function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setCount(target);
      return;
    }
    let startTime: number;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);

  return count;
}
