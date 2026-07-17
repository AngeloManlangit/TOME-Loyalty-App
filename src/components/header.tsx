import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../constants/theme";

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
                        <Text style={styles.headerText}>House!</Text>
                    </View>
                ) : 
                (
                    <Text style={styles.headerText}>{ title }</Text>
                )
            }
            
        </View>
    );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.header,
    width: "100%",
    justifyContent: "space-between",
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  headerText: {
    color: "#fff",
    fontSize: 25
  }
});
