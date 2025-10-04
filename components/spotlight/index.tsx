// Expo RN + TS — spotlight coach marks with dark overlay + cutout + tooltip (tap-through in hole)

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mask, Rect, Svg } from 'react-native-svg';

// ---- Types ----
export type SpotlightStep = {
  id: string;
  targetId?: string | null;
  title?: string;
  text: string;
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  radius?: number;
  padding?: number;
  allowBackdropTapToNext?: boolean;
};

export type SpotlightOptions = {
  persistKey?: string;
  onFinish?: () => void;
};

export type SpotlightRect = { x: number; y: number; width: number; height: number };

// ---- Brand tokens
const BRAND = {
  pink: '#FF4F8B',
  bgCard: '#12131A',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.85)',
  dim: 'rgba(0,0,0,0.68)',
};

type TargetMap = Record<string, SpotlightRect | undefined>;

// Expose steps + stepIndex so screens can react
type Ctx = {
  registerTarget: (id: string, rect: SpotlightRect) => void;
  unregisterTarget: (id: string) => void;
  start: (steps: SpotlightStep[], options?: SpotlightOptions) => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  isActive: boolean;
  steps: SpotlightStep[] | null;
  stepIndex: number;
};

const SpotlightCtx = createContext<Ctx | null>(null);

export const useSpotlight = () => {
  const ctx = useContext(SpotlightCtx);
  if (!ctx) throw new Error('useSpotlight must be used within <SpotlightProvider>');
  return ctx;
};

// ---- Provider ----
export const SpotlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [targets, setTargets] = useState<TargetMap>({});
  const [steps, setSteps] = useState<SpotlightStep[] | null>(null);
  const [options, setOptions] = useState<SpotlightOptions | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  // Stable total for Android (prevents 2/1, 3/1)
  const totalRef = useRef(0);

  const isActive = !!steps && index >= 0 && index < totalRef.current;

  const registerTarget = useCallback((id: string, rect: SpotlightRect) => {
    setTargets(prev => ({ ...prev, [id]: rect }));
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    setTargets(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }, []);

  const stop = useCallback(() => {
    const key = options?.persistKey;
    if (key) AsyncStorage.setItem(`spotlight:${key}:done`, '1').catch(() => {});
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setSteps(null);
      setIndex(0);
      setOptions(undefined);
      totalRef.current = 0;
    });
  }, [opacity, options]);

  const next = useCallback(() => {
    if (!steps) return;
    setIndex(i => {
      const n = i + 1;
      if (n >= totalRef.current) {
        const key = options?.persistKey;
        if (key) AsyncStorage.setItem(`spotlight:${key}:done`, '1').catch(() => {});
        options?.onFinish?.();
        stop();
        return i;
      }
      return n;
    });
  }, [steps, options, stop]);

  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

  const start = useCallback(
    (s: SpotlightStep[], opt?: SpotlightOptions) => {
      totalRef.current = s.length;         // ← lock total once
      setSteps(s);
      setOptions(opt);
      setIndex(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [opacity],
  );

  const value = useMemo(
    () => ({
      registerTarget,
      unregisterTarget,
      start,
      stop,
      next,
      prev,
      isActive,
      steps,
      stepIndex: index,
    }),
    [registerTarget, unregisterTarget, start, stop, next, prev, isActive, steps, index],
  );

  return (
    <SpotlightCtx.Provider value={value}>
      {children}
      <SpotlightOverlay
        isActive={isActive}
        steps={steps || []}
        index={index}
        totalSteps={totalRef.current}
        targets={targets}
        opacity={opacity}
        onNext={next}
        onPrev={prev}
        onSkip={stop}
      />
    </SpotlightCtx.Provider>
  );
};

// ---- Target wrapper ----
type TargetProps = { id: string; children: React.ReactNode; style?: StyleProp<ViewStyle> };

export const SpotlightTarget: React.FC<TargetProps> = ({ id, children, style }) => {
  const { registerTarget, unregisterTarget } = useSpotlight();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    const node = ref.current as any;
    if (!node) return;

    let wrote = false;

    if (typeof node.measure === 'function') {
      node.measure(
        (_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
          if (w && h) {
            registerTarget(id, { x: pageX, y: pageY, width: w, height: h });
            wrote = true;
          }
        }
      );
    }

    if (typeof node.measureInWindow === 'function') {
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        if (w && h && !wrote) registerTarget(id, { x, y, width: w, height: h });
      });
    }
  }, [id, registerTarget]);

  useEffect(() => {
    let raf: number | null = null;
    let tries = 0;
    const loop = () => {
      tries += 1;
      measure();
      if (tries < 24) raf = requestAnimationFrame(loop); // extra chances on Android
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      unregisterTarget(id);
    };
  }, [id, measure, unregisterTarget]);

  return (
    <View ref={ref} onLayout={measure} collapsable={false} style={style}>
      {children}
    </View>
  );
};

// ---- Overlay renderer ----
type OverlayProps = {
  isActive: boolean;
  steps: SpotlightStep[];
  index: number;
  totalSteps: number;
  targets: TargetMap;
  opacity: Animated.Value;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const SpotlightOverlay: React.FC<OverlayProps> = ({
  isActive,
  steps,
  index,
  totalSteps,
  targets,
  opacity,
  onNext,
  onPrev,
  onSkip,
}) => {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get('window');

  if (!isActive) return null;
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;

  const wantsTarget = !!step.targetId;
  const rectRaw = wantsTarget ? targets[step.targetId!] : undefined;
  const hasTarget = !!(rectRaw && rectRaw.width > 0 && rectRaw.height > 0);

  const padding = step.padding ?? 8;
  const radius = step.radius ?? 16;

  const hole = hasTarget
    ? (() => {
        const wantW = rectRaw!.width + padding * 2;
        const wantH = rectRaw!.height + padding * 2;
        const width = clamp(wantW, 16, W - 16);
        const height = clamp(wantH, 16, H - 16);
        const x = clamp(rectRaw!.x - padding, 8, W - 8 - width);
        const y = clamp(rectRaw!.y - padding, 8, H - 8 - height);
        return { x, y, width, height };
      })()
    : null;

  const cardMaxWidth = Math.min(380, W - 24);
  const roomTop = hole ? hole.y : H / 2;
  const roomBottom = hole ? H - (hole.y + hole.height) : H / 2;
  const placement: NonNullable<SpotlightStep['placement']> =
    step.placement === 'auto' || !step.placement
      ? roomBottom > roomTop
        ? 'bottom'
        : 'top'
      : step.placement;

  const EST_CARD_H = 168;
  const defaultTop = insets.top + 64;
  const defaultBottom = Math.max(8, H - insets.bottom - 20 - EST_CARD_H);

  const cardY =
    hole && placement === 'bottom'
      ? Math.min(H - insets.bottom - 20, hole.y + hole.height + 12)
      : hole && placement === 'top'
      ? Math.max(insets.top + 20, hole.y - 12 - EST_CARD_H)
      : placement === 'top'
      ? defaultTop
      : defaultBottom;

  const cardX = clamp((hole ? hole.x + hole.width / 2 : W / 2) - cardMaxWidth / 2, 12, W - 12 - cardMaxWidth);

  const showArrow = !!hole && placement === 'bottom';
  const holeCenterX = hole ? hole.x + hole.width / 2 : W / 2;
  const arrowCenterX = clamp(holeCenterX, cardX + 20, cardX + cardMaxWidth - 20);
  const arrowTop = cardY - 8;

  const backdropPress = step.allowBackdropTapToNext === false ? undefined : onNext;
  const displayTotal = Math.max(totalSteps, steps.length);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      {/* Dimmer with punched hole (doesn't intercept touches) */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill as any} pointerEvents="none">
        <Mask id="mask">
          <Rect x={0} y={0} width={W} height={H} fill="#fff" />
          {hole ? (
            <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={radius} ry={radius} fill="#000" />
          ) : null}
        </Mask>
        <Rect x={0} y={0} width={W} height={H} fill={BRAND.dim} mask="url(#mask)" />
      </Svg>

      {/* Tap-capture panes outside the hole — hole passes touches through */}
      <Pressable onPress={backdropPress} style={{ position: 'absolute', left: 0, top: 0, width: W, height: hole ? hole.y : H }} />
      {hole ? (
        <>
          <Pressable onPress={backdropPress} style={{ position: 'absolute', left: 0, top: hole.y, width: hole.x, height: hole.height }} />
          <Pressable
            onPress={backdropPress}
            style={{
              position: 'absolute',
              left: hole.x + hole.width,
              top: hole.y,
              width: Math.max(0, W - (hole.x + hole.width)),
              height: hole.height,
            }}
          />
          <Pressable
            onPress={backdropPress}
            style={{
              position: 'absolute',
              left: 0,
              top: hole.y + hole.height,
              width: W,
              height: Math.max(0, H - (hole.y + hole.height)),
            }}
          />
        </>
      ) : null}

      {/* subtle light ring */}
      {hole ? (
        <Svg width={W} height={H} style={StyleSheet.absoluteFill as any} pointerEvents="none">
          <Rect
            x={hole.x - 3}
            y={hole.y - 3}
            width={hole.width + 6}
            height={hole.height + 6}
            rx={radius + 4}
            ry={radius + 4}
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1.5}
          />
        </Svg>
      ) : null}

      {/* Tooltip card */}
      <View style={[styles.card, { top: cardY, left: cardX, maxWidth: cardMaxWidth, paddingBottom: 12 + insets.bottom * 0.1 }]}>
        {step.title ? <Text style={styles.title}>{step.title}</Text> : null}
        <Text style={styles.text}>{step.text}</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.progress}>{Math.min(index + 1, displayTotal)}/{displayTotal}</Text>
          <View style={styles.actions}>
            {index > 0 && (
              <TouchableOpacity onPress={onPrev} style={[styles.btn, styles.btnGhost, styles.mr8]}>
                <Text style={[styles.btnText, { color: BRAND.textSecondary }]}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onSkip} style={[styles.btn, styles.btnGhost, styles.mr8]}>
              <Text style={[styles.btnText, { color: BRAND.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} style={[styles.btn, styles.btnPrimary]}>
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                {index + 1 >= displayTotal ? 'Got it' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Arrow (only when card is under the hole) */}
      {showArrow ? (
        <View style={[styles.arrow, { left: arrowCenterX - 8, top: arrowTop, transform: [{ rotate: '225deg' }] }]} />
      ) : null}
    </Animated.View>
  );
};

// ---- Auto starter (per-UID) ----
export const SpotlightAutoStarter: React.FC<{
  uid?: string | null;
  steps: SpotlightStep[];
  persistKey?: string;
  delayMs?: number;
}> = ({ uid, steps, persistKey = 'first-run', delayMs = 350 }) => {
  const { start, isActive } = useSpotlight();

  useEffect(() => {
    let cancelled = false;
    const keySuffix = uid ? `:uid:${uid}` : '';
    const doneKey = `spotlight:${persistKey}${keySuffix}:done`;

    (async () => {
      try {
        const seen = await AsyncStorage.getItem(doneKey);
        if (!seen && !cancelled && !isActive) {
          setTimeout(() => !cancelled && start(steps, { persistKey: `${persistKey}${keySuffix}` }), delayMs);
        }
      } catch {
        if (!cancelled && !isActive) {
          setTimeout(() => !cancelled && start(steps, { persistKey: `${persistKey}${keySuffix}` }), delayMs);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, steps, persistKey, delayMs, start, isActive]);

  return null;
};

// ---- Styles ----
const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    backgroundColor: BRAND.bgCard,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: BRAND.textPrimary, marginBottom: 6 },
  text: { fontSize: 14, color: BRAND.textSecondary },
  progress: { fontSize: 13, color: 'rgba(255,255,255,0.55)', paddingVertical: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center' }, // no 'gap' on Android
  mr8: { marginRight: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  btnGhost: { backgroundColor: 'transparent' },
  btnPrimary: { backgroundColor: BRAND.pink },
  btnText: { fontSize: 14, fontWeight: '700' },
  arrow: { position: 'absolute', width: 16, height: 16, backgroundColor: BRAND.bgCard, borderRadius: 2 },
});