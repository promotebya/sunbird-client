// components/ClampText.tsx
import { useCallback, useRef, useState } from 'react';
import {
    NativeSyntheticEvent,
    Pressable,
    StyleSheet,
    TextLayoutEventData,
    TextStyle,
    View,
} from 'react-native';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type ClampTextProps = {
  children: string;
  initialLines?: number;  // default 4
  style?: TextStyle | TextStyle[];
  moreLabel?: string;     // default "Read more"
  lessLabel?: string;     // default "Show less"
  color?: string;         // optional text color
};

export default function ClampText({
  children,
  initialLines = 4,
  style,
  moreLabel = 'Read more',
  lessLabel = 'Show less',
  color = tokens.colors.textDim,
}: ClampTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const measuredOnce = useRef(false);

  const onTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (measuredOnce.current) return; // avoid loops on Android
      measuredOnce.current = true;
      const lines = e?.nativeEvent?.lines?.length ?? 0;
      if (lines > initialLines) setShowToggle(true);
    },
    [initialLines]
  );

  return (
    <View>
      <ThemedText
        variant="body"
        color={color}
        style={style}
        numberOfLines={expanded ? undefined : initialLines}
        onTextLayout={onTextLayout}
      >
        {children}
      </ThemedText>

      {showToggle && (
        <Pressable
          onPress={() => setExpanded(v => !v)}
          accessibilityRole="button"
          // remove accessibilityLabel type error — we can place it on the Text instead
          style={styles.toggleBtn}
        >
          <ThemedText
            variant="label"
            color={tokens.colors.primaryDark}
            accessibilityLabel={expanded ? 'Show less' : 'Read more'}
          >
            {expanded ? lessLabel : moreLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggleBtn: { marginTop: 6, alignSelf: 'flex-start' },
});