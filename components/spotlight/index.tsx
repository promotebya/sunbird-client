// components/spotlight/index.tsx
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
  Platform,
  Pressable,
  StatusBar,
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
  /** Per-edge clamp margins (defaults to 8 each). Use { bottom: 0 } for tab bar. */
  edgeMargin?: Partial<{ top: number; right: number; bottom: number; left: number }>;
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

// Expose steps + stepIndex so screens can react (e.g., to auto-scroll)
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

// 👇 invisible hair spaces to defeat Android right-edge glyph clipping
const TRAIL = '\u200A\u200A';

// ---- Provider ----
export const SpotlightProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [targets, setTargets] = useState<TargetMap>({});
  const [steps, setSteps] = useState<SpotlightStep[] | null>(null);
  const [options, setOptions] = useState<SpotlightOptions | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0); // stable total for correct "x/N"
  const opacity = useRef(new Animated.Value(0)).current;

  const isActive = !!steps && index >= 0 && index < (steps?.length ?? 0);

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
      setTotalSteps(0);
    });
  }, [opacity, options]);

  const next = useCallback(() => {
    if (!steps) return;
    setIndex(i => {
      const n = i + 1;
      if (n >= totalSteps) {
        const key = options?.persistKey;
        if (key) AsyncStorage.setItem(`spotlight:${key}:done`, '1').catch(() => {});
        options?.onFinish?.();
        stop();
        return i;
      }
      return n;
    });
  }, [steps, totalSteps, options, stop]);

  const prev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1));
  }, []);

  const start = useCallback(
    (s: SpotlightStep[], opt?: SpotlightOptions) => {
      setSteps(s);
      setTotalSteps(s.length); // capture total once
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
        totalSteps={totalSteps}
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

    // Try legacy measure first
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

    // Fallback / also try window measurement
    if (typeof node.measureInWindow === 'function') {
      node.measureInWindow((x: number, y: number, w: number, h: number) => {
        if (w && h && !wrote) {
          const sb = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
          const yWindow = Math.max(0, y - sb);
          registerTarget(id, { x, y: yWindow, width: w, height: h });
        }
      });
    }
  }, [id, registerTarget]);

  useEffect(() => {
    let raf: number | null = null;
    let tries = 0;
    const loop = () => {
      tries += 1;
      measure();
      if (tries < 24) raf = requestAnimationFrame(loop);
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

  const mTop = step.edgeMargin?.top ?? 8;
  const mRight = step.edgeMargin?.right ?? 8;
  const mBottom = step.edgeMargin?.bottom ?? 8;
  const mLeft = step.edgeMargin?.left ?? 8;

  const hole = hasTarget
    ? (() => {
        const wantW = rectRaw!.width + padding * 2;
        const wantH = rectRaw!.height + padding * 2;
        const width = clamp(wantW, 16, W - mLeft - mRight);
        const height = clamp(wantH, 16, H - mTop - mBottom);
        const x = clamp(rectRaw!.x - padding, mLeft, W - mRight - width);
        const y = clamp(rectRaw!.y - padding, mTop, H - mBottom - height);
        return { x, y, width, height };
      })()
    : null;

  const CARD_SIDE_MARGIN = 22;
  const CARD_WIDTH = Math.max(260, Math.floor(Math.min(378, W - CARD_SIDE_MARGIN * 2)) - 2);

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

  const rawY =
    hole && placement === 'bottom'
      ? Math.min(H - insets.bottom - 20, hole.y + hole.height + 12)
      : hole && placement === 'top'
      ? Math.max(insets.top + 20, hole.y - 12 - EST_CARD_H)
      : placement === 'top'
      ? defaultTop
      : defaultBottom;

  const rawX = (hole ? hole.x + hole.width / 2 : W / 2) - CARD_WIDTH / 2;

  const cardY = Math.round(rawY);
  const cardX = Math.round(clamp(rawX, CARD_SIDE_MARGIN, W - CARD_SIDE_MARGIN - CARD_WIDTH));

  const showArrow = !!hole && placement === 'bottom';
  const holeCenterX = hole ? hole.x + hole.width / 2 : W / 2;
  const arrowCenterX = clamp(holeCenterX, cardX + 20, cardX + CARD_WIDTH - 20);
  const arrowTop = cardY - 8;

  const backdropPress = step.allowBackdropTapToNext === false ? undefined : onNext;

  const stepsCount = Array.isArray(steps) ? steps.length : 0;
  const displayTotalRaw = Number.isFinite(totalSteps) && totalSteps > 0 ? totalSteps : stepsCount;
  const displayTotal = displayTotalRaw > 0 ? displayTotalRaw : 1;
  const current = Math.min(index + 1, displayTotal);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
      {/* Dimmer with punched hole */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill as any} pointerEvents="none">
        <Mask id="mask">
          <Rect x={0} y={0} width={W} height={H} fill="#fff" />
        {hole ? (
          <Rect x={hole.x} y={hole.y} width={hole.width} height={hole.height} rx={radius} ry={radius} fill="#000" />
        ) : null}
        </Mask>
        <Rect x={0} y={0} width={W} height={H} fill={BRAND.dim} mask="url(#mask)" />
      </Svg>

      {/* Tap-capture panes outside the hole */}
      <Pressable onPress={backdropPress} style={{ position: 'absolute', left: 0, top: 0, width: W, height: hole ? hole.y : H }} />
      {hole ? (
        <Pressable onPress={backdropPress} style={{ position: 'absolute', left: 0, top: hole.y, width: hole.x, height: hole.height }} />
      ) : null}
      {hole ? (
        <Pressable
          onPress={backdropPress}
          style={{ position: 'absolute', left: hole.x + hole.width, top: hole.y, width: Math.max(0, W - (hole.x + hole.width)), height: hole.height }}
        />
      ) : null}
      {hole ? (
        <Pressable
          onPress={backdropPress}
          style={{ position: 'absolute', left: 0, top: hole.y + hole.height, width: W, height: Math.max(0, H - (hole.y + hole.height)) }}
        />
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
      <View
        needsOffscreenAlphaCompositing
        renderToHardwareTextureAndroid
        style={[
          styles.card,
          { top: cardY, left: cardX, width: CARD_WIDTH, paddingRight: 18, paddingHorizontal: 16, zIndex: 10 },
        ]}
      >
        {step.title ? <Text style={styles.title}>{step.title}</Text> : null}
        <Text style={styles.text}>{step.text}</Text>

        <View style={styles.rowWrap}>
          <Text style={styles.progress}>{`${current}/${displayTotal}`}</Text>

          <View style={styles.actions}>
            {index > 0 && (
              <TouchableOpacity
                onPress={onPrev}
                style={[styles.btnTouchable, styles.btn, styles.btnGhost]}
                hitSlop={{ left: 8, right: 8, top: 4, bottom: 4 }}
              >
                <View style={styles.btnLabelWrap}>
                  <Text style={[styles.btnText, { color: BRAND.textSecondary }]} numberOfLines={1}>
                    Back{TRAIL}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={onSkip}
              style={[styles.btnTouchable, styles.btn, styles.btnGhost, styles.ml8]}
              hitSlop={{ left: 8, right: 8, top: 4, bottom: 4 }}
            >
              <View style={styles.btnLabelWrap}>
                <Text style={[styles.btnText, { color: BRAND.textSecondary }]} numberOfLines={1}>
                  Skip{TRAIL}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onNext}
              style={[styles.btnTouchable, styles.btn, styles.btnPrimary, styles.ml8]}
              hitSlop={{ left: 8, right: 8, top: 4, bottom: 4 }}
            >
              <View style={styles.btnLabelWrap}>
                <Text style={[styles.btnText, { color: '#FFFFFF' }]} numberOfLines={1}>
                  {index + 1 >= displayTotal ? `Got it${TRAIL}` : `Next${TRAIL}`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Arrow when card is under the hole */}
      {showArrow ? (
        <View style={[styles.arrow, { left: arrowCenterX - 8, top: arrowTop, transform: [{ rotate: '225deg' }] }]} />
      ) : null}
    </Animated.View>
  );
};

// ---- Auto starter ----
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
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'visible',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.textPrimary,
    marginBottom: 6,
    paddingRight: 8,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  text: {
    fontSize: 14,
    color: BRAND.textSecondary,
    paddingRight: 10,
    lineHeight: 20,
    ...(Platform.OS === 'android' ? { textBreakStrategy: 'balanced', includeFontPadding: false } : null),
  },
  progress: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    paddingVertical: 10,
    paddingRight: 8,
    minWidth: 44,
    flexShrink: 0,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',     // allow buttons to wrap instead of shrinking (prevents clipping)
    flexShrink: 1,
    paddingRight: 6,
  },
  ml8: { marginLeft: 8 },

  // touchable + label wrappers (fix Android glyph clipping and shrinking)
  btnTouchable: {
    flexShrink: 0,        // don't allow the button to compress its label
    minWidth: 64,         // gives consistent room for “Back/Skip/Next”
  },
  btnLabelWrap: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'visible',
  },

  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  btnGhost: { backgroundColor: 'transparent' },
  btnPrimary: { backgroundColor: BRAND.pink },

  btnText: {
    fontSize: 14,
    fontWeight: '700',
    paddingRight: 2,
    ...(Platform.OS === 'android'
      ? {
          includeFontPadding: true,
          textBreakStrategy: 'simple',
        }
      : null),
  },

  arrow: { position: 'absolute', width: 16, height: 16, backgroundColor: BRAND.bgCard, borderRadius: 2 },
});