import { Image, View, StyleSheet, TouchableOpacity } from "react-native";
import { type Brand, brands } from "@/assets/classes/maps";

interface brandEmit {
    chosenBrand: (brand: Brand) => void;
}

export default function BrandsList({ chosenBrand }: brandEmit) {
    const brandButtons = [];

    for (const b of brands) {
        brandButtons.push(
            <TouchableOpacity style={styles.brandButton} key={b.brand_id} onPress={() => chosenBrand(b)}>
                <Image source={b.logo} style={styles.logoImage} resizeMode="contain" onError={(e) => console.log(`Failed to load ${b.name}: ${e.nativeEvent.error}`)} />
            </TouchableOpacity>
        )
    }

    return (
        <View style={styles.gridContainer}>
            {brandButtons}
        </View>
    );
}

const styles = StyleSheet.create({
    gridContainer: {
        padding: 20,
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',    
        justifyContent: 'center',
        alignItems: 'center',
        alignContent: 'space-evenly',
    },
    brandButton: {
        width: 100,
        padding: 2,
        margin: 10,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoImage: {
        width: '100%',
        height: '100%'
    }
})