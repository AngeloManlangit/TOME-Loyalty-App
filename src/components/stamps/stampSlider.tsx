import { StampCardDetails } from "@/assets/classes/stamps";
import { StyleSheet, useWindowDimensions, Text, View, ViewToken } from "react-native";
import StampSliderItem from "./stampSliderItem";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import StampPagination from "./stampPagination";
import { useRef, useState } from "react";
import { Fonts } from "@/src/constants/theme";

interface StampSliderInterface {
    stampList: StampCardDetails[];
    chosenStamp: (stamp: StampCardDetails) => void;
}


export default function StampSlider({stampList, chosenStamp}: StampSliderInterface) {
    const { width } = useWindowDimensions();
    
    // Subtract the 40px of total padding (20px left + 20px right) applied in StampSection
    const itemWidth = width - 40;

    const scrollX = useSharedValue(0);
    const [paginationIndex, setPaginationIndex] = useState(0);

    const onScrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollX.value = e.contentOffset.x;
        },
    });

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 50
    }

    const onViewableItemsChanged = ({viewableItems} : {viewableItems: ViewToken[]}) => {
        if (viewableItems.length > 0 && viewableItems[0].index != null) {
            setPaginationIndex(viewableItems[0].index);
        }
    };

    const viewabilityConfigCallbackPairs = useRef([
        {viewabilityConfig, onViewableItemsChanged}
    ]);
    
    return(
        <View style={styles.container}>
            <Animated.FlatList 
                data={stampList} 
                renderItem={({item, index}) => 
                    // Use the adjusted itemWidth instead of the full screen width
                    <View style={[{ width: itemWidth }, styles.itemContainer]}>
                        <StampSliderItem item={item} chosenStamp={chosenStamp} />
                    </View>
                } 
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                // Ensure snapping matches the newly adjusted width
                snapToInterval={itemWidth}
                onScroll={onScrollHandler}
                snapToAlignment="center"
                decelerationRate="fast"
                viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
            />

            <Text style={styles.collectedCaption}>{`${stampList[paginationIndex].stamp_count}/${stampList[paginationIndex].stamp_total} Collected`}</Text>
            <StampPagination items={stampList} paginationIndex={paginationIndex} scrollX={scrollX} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center'
    },
    itemContainer: {
        paddingBottom: 20, // for the shadow
        justifyContent: 'center',
        alignItems: 'center',
    },
    collectedCaption: {
    marginVertical: 6,
    fontFamily: Fonts.Lato,
    fontSize: 14,
    letterSpacing: 1.2
  }
});