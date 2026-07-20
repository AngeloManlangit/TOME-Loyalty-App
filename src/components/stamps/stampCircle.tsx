import { View, StyleSheet } from "react-native";

interface StampCircleInterface {
    stamped: boolean
}

export default function StampCircle({stamped = false}: StampCircleInterface) {
    return (
        <View style={[styles.circle, (stamped) ? {backgroundColor: '#000'} : {backgroundColor: '#fff'}]}>
            
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        flex: 1,
        borderRadius: '100%',
        aspectRatio: 1,
    }
})