import { Image, Text, StyleSheet } from "react-native";
import { Colors, Fonts } from "../constants/theme";
import { useEffect, useState } from 'react';
import { usePathname, useSegments } from 'expo-router';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { userService } from "../services/userService";
import { UserDetails } from "@/assets/classes/users";

export default function CustomHeader() {
    const pathname = usePathname();
    const segments = useSegments();

    const title = segments[1] ?? '';
    const isHome = title === "home";
    const isScanner = title === "scanner"

    const [user, setUser] = useState<UserDetails>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        console.log('Route changed to:', pathname);
        console.log('Current structure segments:', segments);

        const loadStamps = async () => {
            setLoading(true);
            const u = await userService.fetchUserDetails();
            if (u) {
                setUser(u);
            }
    
            setLoading(false);
        };
    
        loadStamps();
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

            <Image source={(user) ? { uri: user?.profile_img_url } : require('@/assets/images/fallbackUserProfile.png')} style={styles.profileImage} />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.outlets.purple,
    width: "100%",
    height: 'auto',
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