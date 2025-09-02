import { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";
import { colors, radius, spacing } from "./tokens";

type Props = { visible: boolean; message: string; variant?: "success" | "danger"; onHide?: () => void; };

export default function Toast({ visible, message, variant, onHide }: Props) {
  const y = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        const t = setTimeout(() => {
          Animated.parallel([
            Animated.timing(y, { toValue: 80, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(onHide);
        }, 1600);
        return () => clearTimeout(t);
      });
    }
  }, [visible]);

  if (!visible) return null;
  const bg =
    variant === "success" ? colors.success : variant === "danger" ? colors.danger : colors.primary;

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: spacing.lg,
        right: spacing.lg,
        bottom: spacing.xxl,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: bg,
        transform: [{ translateY: y }],
        opacity,
      }}
    >
      <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>{message}</Text>
    </Animated.View>
  );
}
