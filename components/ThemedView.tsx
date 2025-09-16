// components/ThemedView.tsx
import React from 'react';
import { View, type ViewProps } from 'react-native';
import Colors from '../constants/Colors';
import useColorScheme from '../hooks/useColorScheme';

const ThemedView: React.FC<ViewProps> = ({ style, ...rest }) => {
  const theme = useColorScheme();
  const bg = theme === 'dark' ? Colors.dark.background : Colors.light.background;
  return <View {...rest} style={[{ backgroundColor: bg }, style]} />;
};

export default ThemedView;
