import { View, StyleSheet, Text } from "react-native";
import type { StampCardDetails } from "@/assets/classes/stamps";

export default function StampCard(cardDetails: StampCardDetails) {
  return (
    <View style={styles.cardLayout}>
        <Text>{cardDetails.stampCard_title}</Text>
    </View>    
  );
}

const styles = StyleSheet.create({
    cardLayout: {
        backgroundColor: 'blue',
        borderRadius: 15,
        width: '90%',
        aspectRatio: 2
    }
});