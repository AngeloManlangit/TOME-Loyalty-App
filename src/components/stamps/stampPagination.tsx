import { StampCardDetails } from "@/assets/classes/stamps";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";

interface PaginationProps {
    items: StampCardDetails[];
    paginationIndex: number;
    scrollX: SharedValue<number>;
}

interface DotProps {
    index: number;
    active: boolean;
    scrollX: SharedValue<number>;
    width: number;
}

// One component per dot: useAnimatedStyle has to run at the top level of a component, not inside the
// map below. items grows from [] to N once the stamps load, so calling it in a loop changes the hook
// count between renders.
function PaginationDot({ index, active, scrollX, width }: DotProps) {
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

    return (
        <Animated.View
            style={[
                styles.dot,
                pgAnimationStyle,
                { backgroundColor: active ? '#4f4f4f' : '#aaa' },
            ]}
        />
    );
}

export default function StampPagination({items, paginationIndex, scrollX}: PaginationProps) {
    const { width } = useWindowDimensions();

    return (
        <View style={styles.container}>
            {
                items.map((_, index) => (
                    <PaginationDot
                        key={index}
                        index={index}
                        active={paginationIndex === index}
                        scrollX={scrollX}
                        width={width}
                    />
                ))
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
