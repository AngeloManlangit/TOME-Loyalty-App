import { View, Text, StyleSheet } from "react-native";
import { Colors, Fonts } from "../constants/theme";
import { useEffect } from 'react';
import { usePathname, useSegments } from 'expo-router';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';

export default function CustomHeader() {
    const pathname = usePathname();
    const segments = useSegments();

    const title = segments[1] ?? '';
    const isHome = title === "home";
    const isScanner = title === "scanner"

    useEffect(() => {
        console.log('Route changed to:', pathname);
        console.log('Current structure segments:', segments);
    }, [pathname, segments]); 

    if (isScanner) {
        return ('');
    }

    return (
        <Animated.View 
            style={styles.header}
            layout={LinearTransition.springify().damping(14)} 
        >
            {
                isHome ? (
                    <Animated.View 
                        key="home-title" 
                        entering={FadeIn.duration(300)} 
                        exiting={FadeOut.duration(200)}
                    >
                        <Text style={styles.headerText}>Good Morning, </Text>
                        <Text style={[styles.headerText, styles.uppercased]}>House!</Text>
                    </Animated.View>
                ) : 
                (
                    <Animated.View 
                        key="other-title"
                        entering={FadeIn.duration(300)} 
                        exiting={FadeOut.duration(200)}
                    >
                        <Text style={[styles.headerText, styles.uppercased]}>{ title }</Text>
                    </Animated.View>
                )
            }
        </Animated.View>
    );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.outlets.purple,
    width: "100%",
    height: 'auto',
    justifyContent: "space-between",
    paddingVertical: 25,
    paddingHorizontal: 10,
    overflow: 'hidden', 
  },
  headerText: {
    color: "#fff",
    fontSize: 28,
    fontFamily: Fonts.Lato_Bold,
    paddingBottom: 3
  },
  uppercased: {
    textTransform: "uppercase"
  }
});