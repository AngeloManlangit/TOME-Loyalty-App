import { StampCardDetails } from "@/assets/classes/stamps";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";

interface PaginationProps {
    items: StampCardDetails[];
    paginationIndex: number;
    scrollX: SharedValue<number>;
}

export default function StampPagination({items, paginationIndex, scrollX}: PaginationProps) {
    const { width } = useWindowDimensions();
    
    return (
        <View style={styles.container}>
            {
                items.map((_, index) => {
                    const pgAnimationStyle = useAnimatedStyle(() => {
                        const dotWidth = interpolate(
                            scrollX.value,
                            [(index - 1) * width, index * width, (index + 1) * width],
                            [8, 20, 8],
                            Extrapolation.CLAMP
                        );

                        return {
                            width: dotWidth,
                        };
                    });
                    return(
                        <Animated.View 
                            key={index} 
                            style={[
                                styles.dot,
                                pgAnimationStyle,
                                {backgroundColor: paginationIndex === index ? '#4f4f4f': '#aaa'},

                            ]} 
                        />
                    )
                })
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        height: 30,
        justifyContent: 'center',
        alignItems: 'center'
    },
    dot: {
        backgroundColor: '#aaa',
        height: 8,
        width: 8,
        marginHorizontal: 2,
        borderRadius: 8
    }
})