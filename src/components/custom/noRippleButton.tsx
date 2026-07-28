import { Pressable } from "react-native";
import Animated from "react-native-reanimated";
import { useState } from "react";
import { useShutterPressStyle } from "../scannerPage/scannerButton";

interface NoRippleTabBarButtonInterface {
  children?: any;
  onPress?: any;
  style?: any;
  accessibilityLabel?: string;
  /** React Navigation spreads a large prop bag onto tab buttons; the rest is passed through. */
  [key: string]: any;
}

export const NoRippleTabBarButton = ({ children, onPress, style }: NoRippleTabBarButtonInterface) => (
  <Pressable
    onPress={onPress}
    android_ripple={null} // Crucial line to completely remove the Android tap animation
    style={style}         // Keeps the layout formatting provided by React Navigation
  >
    {children}
  </Pressable>
);

/**
 * The scanner tab's button. Same no-ripple behaviour, plus a spring press-in so the FAB responds
 * like a shutter release rather than a navigation tab.
 *
 * `onPress` is supplied by the layout and decides what a press means — navigate here, or take the
 * photo — depending on whether the scanner is already open.
 */
export const ShutterTabBarButton = ({
  children,
  onPress,
  style,
  accessibilityLabel,
}: NoRippleTabBarButtonInterface) => {
  const [pressed, setPressed] = useState(false);
  const pressStyle = useShutterPressStyle(pressed);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      android_ripple={null}
      style={style}
    >
      <Animated.View style={[{ flex: 1 }, pressStyle]}>{children}</Animated.View>
    </Pressable>
  );
};
