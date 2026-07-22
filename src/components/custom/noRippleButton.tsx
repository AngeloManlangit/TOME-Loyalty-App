import { Pressable } from "react-native";

interface NoRippleTabBarButtonInterface {
  children?: any;
  onPress?: any;
  style?: any;
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