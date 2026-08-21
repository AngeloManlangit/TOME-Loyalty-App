import { View, StyleSheet, DimensionValue, ImageBackground } from "react-native";
import type { StampCardDetails } from "@/assets/classes/stamps";
import StampCircle from "./stampCircle";
import { getSeededRand } from "@/src/utils/rng";

interface StampCardProps {
    cardDetails: StampCardDetails;
}

export default function StampCard({cardDetails}: StampCardProps) {
    const columns = Math.ceil(cardDetails.stamp_total / 2); 
  
    const itemWidth = `${100 / columns}%` as DimensionValue;

    const hasBGImage = (cardDetails.stampCard_configs.bgImage != null)

    let rand = getSeededRand(cardDetails.stampCard_configs.seed);

    const innerContent = (
        <View style={styles.gridContainer}>
          
          {/* Generate an array based on stamp_total and map over it */}
          {Array.from({ length: cardDetails.stamp_total }).map((_, index) => {
            const isStamped = index < cardDetails.stamp_count;
            const isReward = cardDetails.stamp_reward_index.includes(index);

            return (
              <View key={index} style={[styles.gridItem, {width: itemWidth, height: '35%'}]}>
                
                <StampCircle stamped={isStamped} reward={isReward} randomizer={rand()} />

              </View>
            );
          })}
        </View>
    )

    return (
        <View style={[
            styles.cardLayout, 
            styles.boxWithShadow, 
            { backgroundColor: cardDetails.stampCard_configs.bgColor }
        ]}>
            {hasBGImage ? (
                <ImageBackground
                    source={{ uri: cardDetails.stampCard_configs.bgImage as string}}
                    style={styles.imageBackgroundWrapper}
                    imageStyle={{ borderRadius: 15 }}
                    resizeMode="cover"
                >
                    {innerContent}
                </ImageBackground>
            ) : (
                innerContent
            )}
        </View>    
    );
}

const styles = StyleSheet.create({
    cardLayout: {
        borderRadius: 15,
        width: '90%',
        aspectRatio: 1.8,
    },
    boxWithShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.8,
        shadowRadius: 2,  
        elevation: 5,
    },
    imageBackgroundWrapper: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 15,
    },
    gridContainer: {
        padding: 15,
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',    
        justifyContent: 'flex-start',
        alignItems: 'center',
        alignContent: 'space-evenly',
        rowGap: 10,
    },
    gridItem: {
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
});