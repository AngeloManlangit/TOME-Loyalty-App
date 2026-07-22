import { View, Text, StyleSheet } from "react-native";
import { Colors, Fonts } from "../constants/theme";
import { useEffect } from 'react';
import { usePathname, useSegments } from 'expo-router';

interface CustomHeaderProps {
    options?: {
        title?: string;
    };
    route?: {
        name: string;
    };
}

export default function CustomHeader() {
    

    const pathname = usePathname();
    const segments = useSegments();

    const title = segments[1] ?? '';
    const isHome = title === "home";

    useEffect(() => {
    console.log('Route changed to:', pathname);
    console.log('Current structure segments:', segments);
    }, [pathname, segments]); 

    return (
        <View style={styles.header}>
            {
                isHome ? (
                    <View>
                        <Text style={styles.headerText}>Good Morning, </Text>
                        <Text style={[styles.headerText, styles.capitalized]}>House!</Text>
                    </View>
                ) : 
                (
                    <Text style={[styles.headerText, styles.capitalized]}>{ title }</Text>
                )
            }
            
        </View>
    );
};

const styles = StyleSheet.create({
  header: {
    position: 'fixed',
    backgroundColor: Colors.outlets.purple,
    width: "100%",
    height: 'auto',
    justifyContent: "space-between",
    paddingVertical: 25,
    paddingHorizontal: 10,
  },
  headerText: {
    color: "#fff",
    fontSize: 28,
    fontFamily: Fonts.Lato_Bold,
    paddingBottom: 3
  },
  capitalized: {
    textTransform: "uppercase"
  }
});
