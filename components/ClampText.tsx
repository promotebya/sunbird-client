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
  initialLines?: number;      // default 4
  style?: TextStyle | TextStyle[];
  moreLabel?: string;         // default "Read more"
  lessLabel?: string;         // default "Show less"
};

export default function ClampText({
  children,
  initialLines = 4,
  style,
  moreLabel = 'Read more',
  lessLabel = 'Show less',
}: ClampTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const measuredOnce = useRef(false);

  const onTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      // Measure only once to avoid layout loops on Android
      if (measuredOnce.current) return;
      measuredOnce.current = true;
      const lines = e.nativeEvent.lines?.length ?? 0;
      if (lines > initialLines) setShowToggle(true);
    },
    [initialLines]
  );

  return (
    <View>
      <ThemedText
        variant="body"
        color={tokens.colors.textDim}
        style={style}
        numberOfLines={expanded ? undefined : initialLines}
        onTextLayout={onTextLayout}
      >
        {children}
      </ThemedText>

      {showToggle && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less' : 'Read more'}
          style={styles.toggleBtn}
        >
          <ThemedText variant="label" color={tokens.colors.primaryDark}>
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