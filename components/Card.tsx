import { PropsWithChildren } from "react";
import { View, ViewProps } from "react-native";
import { shared } from "./sharedStyles";

export default function Card({ children, style, ...rest }: PropsWithChildren<ViewProps>) {
  return (
    <View {...rest} style={[shared.card, style]}>{children}</View>
  );
}
