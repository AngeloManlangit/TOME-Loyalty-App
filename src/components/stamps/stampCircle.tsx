import { Text, View, StyleSheet } from "react-native";

interface StampCircleInterface {
    stamped: boolean;
    reward: boolean;
}

export default function StampCircle({stamped = false, reward = false}: StampCircleInterface) {
    return (
        <View style={[styles.circle, (stamped) ? {backgroundColor: '#000'} : {backgroundColor: '#fff'}]}>
            <Text style={{ color: '#fff' }}>{`:\)`}</Text>
            
            {reward ? (
                <Text style={styles.reward}>YAY</Text>
            ) : ''}
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
    },
    reward: {
        fontSize: 20,
        color: '#f32525'
    }
})