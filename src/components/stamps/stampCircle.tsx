import { Text, View, StyleSheet } from "react-native";

interface StampCircleInterface {
    stamped: boolean
}

export default function StampCircle({stamped = false}: StampCircleInterface) {
    return (
        <View style={[styles.circle, (stamped) ? {backgroundColor: '#000'} : {backgroundColor: '#fff'}]}>
            <Text style={{ color: '#fff' }}>:)</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: '100%',
        aspectRatio: 1,
    }
})