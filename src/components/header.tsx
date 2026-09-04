import { Image, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors, Fonts } from "../constants/theme";
import { useEffect } from 'react';
import { router, usePathname, useSegments } from 'expo-router';
import Animated, { LinearTransition, FadeIn, FadeOut, SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useUser } from "@src/contexts/userContext";

export default function CustomHeader() {
    const insets = useSafeAreaInsets();
    
    const pathname = usePathname();
    const segments = useSegments();

    const title = segments[1] ?? '';
    const isHome = title === "home";
    const hideHeader = title === "scanner" || title === "others"

    const { user } = useUser();

    useEffect(() => {
        console.log('Route changed to:', pathname);
        console.log('Current structure segments:', segments);
    }, [pathname, segments]); 

    if (hideHeader) return null;
            
    return (
        <Animated.View 
            // Apply the top inset offset to slide securely under the status bar
            style={[styles.header, { top: insets.top }]} 
            entering={SlideInUp.springify().damping(500)} 
            exiting={SlideOutUp.duration(250)}
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
                        <Text style={[styles.headerText, styles.uppercased]}>{user?.first_name || 'User'}</Text>
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

            <TouchableOpacity onPress={() => router.replace('/others')}>
                <Image 
                    source={(user) ? { uri: user?.profile_img_url } : require('@/assets/images/fallbackUserProfile.png')} 
                    style={[styles.profileImage, { borderColor: user?.card_background_color }]} 
                />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    zIndex: 10,
    backgroundColor: Colors.outlets.purple,
    width: "100%",
    flexDirection: 'row',
    justifyContent: "space-between",
    alignItems: 'center',
    paddingVertical: 25,
    paddingHorizontal: 20,
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
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderColor: '#ffd9f9',
    borderWidth: 2.5,
  }
});