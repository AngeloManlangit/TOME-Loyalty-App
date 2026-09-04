import { Colors, Fonts } from "@/src/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { View, StyleSheet, Text, Image, ImageBackground } from "react-native";
import { UserDetails } from "@/assets/classes/users";
import { Mail, Phone } from "lucide-react-native";

export default function ProfileCard(userProfile: UserDetails) {
    return (
        <View style={[styles.cardLayout, styles.boxWithShadow, { backgroundColor: userProfile.cardBackgroundColor }]}>
            <LinearGradient colors={['#ffffff75', '#ffffff30']} 
                style={styles.gradientOverlay} 
                start={{ x: 0.2, y: 0.2 }}
                end={{ x: 0.8, y: 0.8 }}    
            >
                <ImageBackground
                    source={require('@/assets/images/TOME Opaque Bg.png')}
                    style={styles.imageBackgroundWrapper}
                    resizeMode="center"
                >
                    <View style={styles.mainContent}>
                        {/* Left Column: Image and Username */}
                        <View style={styles.leftColumn}>
                            <View style={[styles.imageContainer, {borderColor: userProfile.cardBackgroundColor}]}>
                                {userProfile.profile_img_url ? (
                                    <Image source={{ uri: userProfile.profile_img_url }} style={styles.profileImg} />
                                ) : (
                                    <Image source={require('@/assets/images/fallbackUserProfile.png')} style={styles.profileImg} />
                                )}
                            </View>
                            <Text style={styles.usernameText}>@{userProfile.username}</Text>
                        </View>

                        {/* Right Column: Name and Contact Details */}
                        <View style={styles.rightColumn}>
                            <View style={styles.row}>
                                <View style={styles.flexItem}>
                                    <Text style={styles.labelText}>First Name</Text>
                                    <Text style={styles.valueText}>{userProfile.first_name}</Text>
                                </View>
                                <View style={styles.miContainer}>
                                    <Text style={styles.labelText}>M.I.</Text>
                                    <Text style={styles.valueText}>
                                        {userProfile.middle_name ? `${userProfile.middle_name.charAt(0)}.` : ''}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.fieldContainer}>
                                <Text style={styles.labelText}>Last Name</Text>
                                <Text style={styles.valueText}>{userProfile.last_name}</Text>
                            </View>

                            <View style={styles.fieldContainer}>
                                <View style={styles.valueRow}>
                                    <Mail size={16} />
                                    <Text style={[styles.valueText, {textTransform: 'none'}]}>{userProfile.email}</Text>
                                </View>
                                <View style={styles.valueRow}>
                                    <Phone size={16} />
                                    <Text style={[styles.valueText, { textTransform: 'none' }]}>{userProfile.contact_no}</Text>
                                </View>
                            </View>

                            <View>
                                <Text style={styles.labelText}>Date of Birth: {userProfile.birth_date}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Footer: User ID and DOB */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>User ID: {userProfile.id || 'Shown after creating account'}</Text>
                    </View>
                </ImageBackground>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    cardLayout: {
        borderRadius: 20,
        width: '100%',
        aspectRatio: 1.55,
        backgroundColor: Colors.outlets.green,
        borderColor: '#000',
        borderWidth: 1,
        overflow: 'hidden'
    },
    boxWithShadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.8,
        shadowRadius: 2,
        elevation: 5,
    },
    gradientOverlay: {
        flex: 1, 
        padding: 12,
        paddingTop: 18,
    },
    imageBackgroundWrapper: {
        width: '100%',
        height: '100%',
    },
    mainContent: {
        flexDirection: 'row',
        flex: 1,
    },
    leftColumn: {
        flex: 0.45,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    rightColumn: {
        flex: 0.55,
        paddingLeft: 10,
        justifyContent: 'flex-start',
    },
    imageContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: Colors.outlets.green,
        backgroundColor: '#fff',
        overflow: 'hidden',
        marginBottom: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    profileImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    placeholderImg: {
        width: '100%',
        height: '100%',
        backgroundColor: '#fff'
    },
    usernameText: {
        fontFamily: Fonts.Lato_Bold,
        fontSize: 16,
        color: '#000',
        textAlign: 'center'
    },
    row: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    flexItem: {
        flex: 1,
    },
    miContainer: {
        marginLeft: 15,
        marginRight: 10,
    },
    fieldContainer: {
        marginBottom: 10,
    },
    labelText: {
        fontSize: 12,
        fontFamily: Fonts.Lato,
        color: '#000',
    },
    valueText: {
        fontSize: 14,
        fontFamily: Fonts.Lato_Bold,
        color: '#000',
        textTransform: 'uppercase'
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 10,
    },
    footerText: {
        fontSize: 12,
        fontFamily: Fonts.Lato,
        color: '#000',
    }
});