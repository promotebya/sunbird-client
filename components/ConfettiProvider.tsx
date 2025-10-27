// components/ConfettiProvider.tsx
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { DeviceEventEmitter, StyleSheet, View } from 'react-native';
import ConfettiTiny from './ConfettiTiny';

type CtxValue = { shoot: (durationMs?: number) => void };
const Ctx = createContext<CtxValue>({ shoot: () => {} });

export function ConfettiProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const keyRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  // Fire immediately (in the next frame the overlay paints), then hide after duration
  const shoot = useCallback((durationMs = 900) => {
    clearHideTimer();
    keyRef.current += 1;       // remount ConfettiTiny → guaranteed replay
    setVisible(true);
    // Ensure we render a frame with it visible before scheduling hide
    requestAnimationFrame(() => {
      hideTimer.current = setTimeout(() => setVisible(false), durationMs);
    });
  }, []);

  // Global optimistic events (so any screen can celebrate without wiring)
  useEffect(() => {
    const a = DeviceEventEmitter.addListener('lp.task.completed', () => shoot());
    const b = DeviceEventEmitter.addListener('lp.challenge.completed', () => shoot());
    return () => {
      a.remove();
      b.remove();
      clearHideTimer();
    };
  }, [shoot]);

  return (
    <Ctx.Provider value={{ shoot }}>
      {/* Always-mounted overlay; the tiny component only mounts when visible */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {visible && (
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
          >
            <ConfettiTiny key={keyRef.current} />
          </View>
        )}
      </View>
      {children}
    </Ctx.Provider>
  );
}

export function useConfetti(): (durationMs?: number) => void {
  return useContext(Ctx).shoot;
}