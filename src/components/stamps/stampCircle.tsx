import { Text, View, StyleSheet } from "react-native";
import { StarIcon } from "lucide-react-native";

interface StampCircleInterface {
    stamped: boolean;
    reward: boolean;
    randomizer: number;
}

export default function StampCircle({stamped = false, reward = false, randomizer}: StampCircleInterface) {
    // randomized circle position [-2, 3]
    const randomMarginTop = ((randomizer * 100) % 15) - 3;
    const randomMarginLeft = ((randomizer * 300) % 15) - 3;
    
    // random star positions
    const randomRotation = Math.round((randomizer * 500) % 360) // by degress
    const randomStarMarginTop = ((randomizer * 10) % 20) - 3;
    const randomStarMarginLeft = ((randomizer * 20) % 10) - 3;

    return (
        <View style={[
            styles.circle, 
            (stamped) ? {backgroundColor: '#000'} : {backgroundColor: '#FFFCF3'},
            { marginTop: randomMarginTop, marginLeft: randomMarginLeft }  
        ]}>
            {reward ? (
                <View style={[
                    styles.rewardContainer, 
                    { transform: [{ rotate: `${randomRotation}deg` }]},
                    { marginTop: randomStarMarginTop, marginLeft: randomStarMarginLeft }]}>
                    <StarIcon color={'#ddcf927d'} size={'80%'} />
                </View>
            ) : ''}             
        </View>
    );
}

const styles = StyleSheet.create({
    circle: {
        position: 'absolute',
        width: '75%',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 100,
        aspectRatio: 1,
    },
    rewardContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center'
    }
})