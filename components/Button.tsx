import { Ionicons } from '@expo/vector-icons';
import { Text, TextStyle, ViewStyle } from 'react-native';
import PressableScale from './PressableScale';
import { colors, r, s } from './tokens';

type Variant = 'primary' | 'ghost' | 'danger' | 'link';
type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  small?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
};

export default function Button({
  title, onPress, disabled, variant = 'primary', small, leftIcon, rightIcon, style, textStyle,
}: Props) {
  const height = small ? 36 : 48;
  const base: ViewStyle = {
    height, borderRadius: r.md, paddingHorizontal: s.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  };
  const bg = variant === 'primary' ? colors.primary
    : variant === 'danger' ? colors.danger
    : variant === 'ghost' ? colors.ghost
    : 'transparent';

  const labelColor = variant === 'link' ? '#2563EB'
    : variant === 'ghost' ? colors.text
    : '#fff';

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={[base, { backgroundColor: bg }, style as any]}
    >
      {leftIcon ? <Ionicons name={leftIcon} size={18} color={labelColor} style={{ marginRight: 8 }} /> : null}
      <Text style={[{ color: labelColor, fontWeight: '700' }, textStyle]}>{title}</Text>
      {rightIcon ? <Ionicons name={rightIcon} size={18} color={labelColor} style={{ marginLeft: 8 }} /> : null}
    </PressableScale>
  );
}
