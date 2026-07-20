import { View, StyleSheet, Text, DimensionValue } from "react-native";
import type { StampCardDetails } from "@/assets/classes/stamps";
import StampCircle from "./stampCircle";

interface StampCardProps {
    cardDetails: StampCardDetails;
}

export default function StampCard({cardDetails}: StampCardProps) {
    const columns = Math.ceil(cardDetails.stamp_total / 2); 
  
    const itemWidth = `${100 / columns}%` as DimensionValue;
  
    return (
        <View style={[styles.cardLayout, { backgroundColor: cardDetails.stampCard_color }, styles.boxWithShadow]}>

        <View style={styles.gridContainer}>
          
          {/* Generate an array based on stamp_total and map over it */}
          {Array.from({ length: cardDetails.stamp_total }).map((_, index) => {
            const isStamped = index < cardDetails.stamp_number;

            return (
              <View key={index} style={[styles.gridItem, {width: itemWidth, height: '35%'}]}>
                
                <StampCircle stamped={isStamped} />

              </View>
            );
          })}
        </View>
    </View>    
    );
}

const styles = StyleSheet.create({
    cardLayout: {
        padding: 15,
        borderRadius: 15,
        width: '90%',
        aspectRatio: 1.8,
        
        
    },
    boxWithShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.9,
        shadowRadius: 2,  
        elevation: 5
    },
    gridContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',    
        justifyContent: 'flex-start',
        alignItems: 'center',
        alignContent: 'space-evenly'
    },
    gridItem: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});