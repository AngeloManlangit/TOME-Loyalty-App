import { View, Text, StyleSheet } from "react-native";
import { Colors, Fonts } from "../constants/theme";

interface CustomHeaderProps {
    options?: {
        title?: string;
    };
    route?: {
        name: string;
    };
}

export default function CustomHeader({ options, route }: CustomHeaderProps) {
    const title = options?.title ?? route?.name ?? '';
    const isHome = route?.name === "index";

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
    backgroundColor: Colors.outlets.purple,
    width: "100%",
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
