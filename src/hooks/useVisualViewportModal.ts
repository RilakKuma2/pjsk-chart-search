import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

interface VisualViewportModalOptions {
  enabled?: boolean;
  zIndex?: number;
  backgroundColor?: string;
  preserve3d?: boolean;
}

interface ViewportGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

interface VisualViewportModalStyles {
  viewportStyle: CSSProperties;
  antiZoomStyle: CSSProperties;
}

const SETTLE_DELAYS_MS = [0, 80, 240, 600, 1200];

function hasSameGeometry(left: ViewportGeometry | null, right: ViewportGeometry): boolean {
  return left !== null
    && left.left === right.left
    && left.top === right.top
    && left.width === right.width
    && left.height === right.height
    && left.scale === right.scale;
}

function readViewportGeometry(): ViewportGeometry | null {
  if (typeof window === 'undefined') return null;

  const viewport = window.visualViewport;
  const scale = viewport?.scale && viewport.scale > 0 ? viewport.scale : 1;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;

  if (!(width > 0) || !(height > 0)) return null;

  return {
    left: viewport?.offsetLeft || 0,
    top: viewport?.offsetTop || 0,
    width,
    height,
    scale,
  };
}

function createStyles(
  geometry: ViewportGeometry | null,
  { zIndex = 3000, backgroundColor = 'rgba(0, 0, 0, 0.7)', preserve3d = false }: VisualViewportModalOptions,
): VisualViewportModalStyles {
  const frameWidth = geometry ? `${geometry.width}px` : '100%';
  const frameHeight = geometry ? `${geometry.height}px` : '100%';
  const scale = geometry?.scale || 1;

  const viewportStyle: CSSProperties = {
    position: 'fixed',
    left: geometry ? `${geometry.left}px` : 0,
    top: geometry ? `${geometry.top}px` : 0,
    width: frameWidth,
    height: frameHeight,
    zIndex,
    pointerEvents: 'none',
  };

  const antiZoomStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: geometry ? `${geometry.width * scale}px` : '100%',
    height: geometry ? `${geometry.height * scale}px` : '100%',
    transform: `scale(${1 / scale})`,
    transformOrigin: 'top left',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor,
    pointerEvents: 'auto',
  };

  if (preserve3d) {
    antiZoomStyle.WebkitBackfaceVisibility = 'hidden';
    antiZoomStyle.WebkitTransformStyle = 'preserve-3d';
  }

  return { viewportStyle, antiZoomStyle };
}

/**
 * Keeps zoom-independent modal frames aligned with the mobile visual viewport.
 *
 * Mobile browsers can publish the keyboard-sized viewport for a short time after
 * focus changes, returning from the background, or reopening a modal. Re-reading
 * during the settling window prevents that stale half-height value from becoming
 * permanent until the user scrolls.
 */
export default function useVisualViewportModal({
  enabled = true,
  zIndex = 3000,
  backgroundColor = 'rgba(0, 0, 0, 0.7)',
  preserve3d = false,
}: VisualViewportModalOptions = {}): VisualViewportModalStyles {
  const [styles, setStyles] = useState<VisualViewportModalStyles>(() => (
    createStyles(readViewportGeometry(), { zIndex, backgroundColor, preserve3d })
  ));

  useEffect(() => {
    if (!enabled) return;

    let animationFrame = 0;
    let lastGeometry: ViewportGeometry | null = null;
    const settleTimers = new Set<number>();

    const syncViewport = () => {
      animationFrame = 0;
      const geometry = readViewportGeometry();
      if (!geometry) return;
      if (hasSameGeometry(lastGeometry, geometry)) return;
      lastGeometry = geometry;
      setStyles(createStyles(geometry, { zIndex, backgroundColor, preserve3d }));
    };

    const scheduleSync = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(syncViewport);
    };

    const scheduleSettledSync = () => {
      for (const timer of settleTimers) window.clearTimeout(timer);
      settleTimers.clear();

      for (const delay of SETTLE_DELAYS_MS) {
        const timer = window.setTimeout(() => {
          settleTimers.delete(timer);
          scheduleSync();
        }, delay);
        settleTimers.add(timer);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleSettledSync();
    };

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', scheduleSync);
    viewport?.addEventListener('scroll', scheduleSync);
    window.addEventListener('resize', scheduleSettledSync);
    window.addEventListener('orientationchange', scheduleSettledSync);
    window.addEventListener('pageshow', scheduleSettledSync);
    window.addEventListener('focus', scheduleSettledSync);
    document.addEventListener('focusin', scheduleSettledSync);
    document.addEventListener('focusout', scheduleSettledSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    scheduleSettledSync();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      for (const timer of settleTimers) window.clearTimeout(timer);
      viewport?.removeEventListener('resize', scheduleSync);
      viewport?.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSettledSync);
      window.removeEventListener('orientationchange', scheduleSettledSync);
      window.removeEventListener('pageshow', scheduleSettledSync);
      window.removeEventListener('focus', scheduleSettledSync);
      document.removeEventListener('focusin', scheduleSettledSync);
      document.removeEventListener('focusout', scheduleSettledSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [backgroundColor, enabled, preserve3d, zIndex]);

  return styles;
}
