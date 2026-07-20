import { Image, View, StyleSheet, TouchableOpacity } from "react-native";
import type { Brand } from "@/assets/classes/maps";

const brands: Brand[] = [
    {
        brand_id: 0,
        name: 'Crocs',
        logo: require('@/assets/images/brandLogos/crocs-logo.png')
    },
    {
        brand_id: 1,
        name: 'New Era',
        logo: require('@/assets/images/brandLogos/new-era-logo.png')
    },
    {
        brand_id: 2,
        name: 'Nike',
        logo: require('@/assets/images/brandLogos/nike-logo.png')
    },
    {
        brand_id: 3,
        name: 'Adidas',
        logo: require('@/assets/images/brandLogos/adidas-logo.png')
    },
    {
        brand_id: 4,
        name: 'Levi\'s',
        logo: require('@/assets/images/brandLogos/levis-logo.webp')
    },
    {
        brand_id: 5,
        name: 'Casio',
        logo: require('@/assets/images/brandLogos/casio-logo.webp')
    }
]

export default function BrandsList() {
    const brandButtons = [];

    for (const b of brands) {
        brandButtons.push(
            <TouchableOpacity style={styles.brandButton} key={b.brand_id}>
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