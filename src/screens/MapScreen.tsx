import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert, Image } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const { width, height } = Dimensions.get('window');

// Mock function to generate random coordinates near a center point
const getRandomCoordinates = (latitude: number, longitude: number, radiusKm: number = 5) => {
    const r = radiusKm / 111.32; // Convert km to degrees roughly
    const u = Math.random();
    const v = Math.random();
    const w = r * Math.sqrt(u);
    const t = 2 * Math.PI * v;
    const x = w * Math.cos(t);
    const y = w * Math.sin(t);
    const newLat = x + latitude;
    const newLon = y / Math.cos(latitude) + longitude;
    return { latitude: newLat, longitude: newLon };
};

export default function MapScreen() {
    const navigation = useNavigation<any>();
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');

    const filteredUsers = React.useMemo(() => {
        // Deduplicate users by ID to prevent key errors
        const uniqueUsers = Array.from(new Map(nearbyUsers.map(u => [u.id, u])).values());
        
        return uniqueUsers.filter(user => {
            if (genderFilter === 'all') return true;
            return (user.gender || '').toLowerCase() === genderFilter;
        });
    }, [nearbyUsers, genderFilter]);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);

            // Fetch users and assign random nearby locations
            try {
                const users = await ApiService.getUsers(); // Fetch all users
                
                // Get current user ID to filter out
                const profileStr = await AsyncStorage.getItem('userProfile');
                let currentUserId: string | null = null;
                if (profileStr) {
                    const profile = JSON.parse(profileStr);
                    setCurrentUser(profile);
                    currentUserId = String(profile.id);
                }

                const mappedUsers = users
                    .filter((u: any) => String(u.id) !== currentUserId)
                    .map((u: any) => {
                        const coords = getRandomCoordinates(
                            location.coords.latitude,
                            location.coords.longitude
                        );
                        return { ...u, coordinate: coords };
                    });
                setNearbyUsers(mappedUsers);
            } catch (error) {
                // Error fetching users for map
            }
        })();
    }, []);

    if (errorMsg) {
        return (
            <View style={styles.container}>
                <Text>{errorMsg}</Text>
            </View>
        );
    }

    if (!location) {
        return (
            <View style={styles.container}>
                <Text>Loading Map...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                initialRegion={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.0922,
                    longitudeDelta: 0.0421,
                }}
                showsUserLocation={true}
            >
                {/* Current User Marker */}
                {location && currentUser && (
                    <Marker
                        coordinate={{
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                        }}
                        title="You"
                        description="This is your current location"
                    >
                        <View style={styles.markerContainer}>
                            <View style={[styles.markerImage, { borderColor: '#E94057', borderWidth: 3 }]}>
                                {currentUser.image && currentUser.image.startsWith('#') ? (
                                    <View style={[styles.markerImage, { backgroundColor: currentUser.image, width: 36, height: 36, borderRadius: 18, borderWidth: 0 }]}>
                                         <Text style={styles.markerText}>{currentUser.name ? currentUser.name[0] : 'Me'}</Text>
                                    </View>
                                ) : (
                                    <Image 
                                        source={{ uri: currentUser.image || 'https://via.placeholder.com/150' }} 
                                        style={[styles.markerImage, { width: 36, height: 36, borderRadius: 18, borderWidth: 0 }]} 
                                    />
                                )}
                            </View>
                             <View style={[styles.markerArrow, { borderBottomColor: '#E94057' }]} />
                        </View>
                    </Marker>
                )}

                {filteredUsers.map((user) => (
                    <Marker
                        key={user.id}
                        coordinate={user.coordinate}
                        title={user.name}
                        description={user.bio}
                        onCalloutPress={() => navigation.navigate('Profile', { userId: user.id })}
                    >
                        <View style={styles.markerContainer}>
                            {user.image && user.image.startsWith('#') ? (
                                <View style={[styles.markerImage, { backgroundColor: user.image }]}>
                                    <Text style={styles.markerText}>{user.name ? user.name[0] : '?'}</Text>
                                </View>
                            ) : (
                                <Image 
                                    source={{ uri: user.image || 'https://via.placeholder.com/150' }} 
                                    style={styles.markerImage} 
                                />
                            )}
                            <View style={styles.markerArrow} />
                        </View>
                    </Marker>
                ))}
            </MapView>
            
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.filterContainer}>
                <TouchableOpacity 
                    style={[styles.filterButton, genderFilter === 'all' && styles.filterButtonActive]} 
                    onPress={() => setGenderFilter('all')}
                >
                    <Text style={[styles.filterText, genderFilter === 'all' && styles.filterTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.filterButton, genderFilter === 'female' && styles.filterButtonActive]} 
                    onPress={() => setGenderFilter('female')}
                >
                    <Text style={[styles.filterText, genderFilter === 'female' && styles.filterTextActive]}>Girls</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.filterButton, genderFilter === 'male' && styles.filterButtonActive]} 
                    onPress={() => setGenderFilter('male')}
                >
                    <Text style={[styles.filterText, genderFilter === 'male' && styles.filterTextActive]}>Guys</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>Found {filteredUsers.length} people nearby</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    map: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: '#E94057',
        padding: 10,
        borderRadius: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    filterContainer: {
        position: 'absolute',
        top: 50,
        right: 20,
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 20,
        padding: 5,
        elevation: 5,
    },
    filterButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    filterButtonActive: {
        backgroundColor: '#E94057',
    },
    filterText: {
        color: '#666',
        fontWeight: '600',
        fontSize: 12,
    },
    filterTextActive: {
        color: '#fff',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        padding: 15,
        borderRadius: 20,
        elevation: 5,
    },
    footerText: {
        fontWeight: 'bold',
        color: '#E94057',
    },
    markerContainer: {
        alignItems: 'center',
    },
    markerImage: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    markerText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    markerArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderBottomWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#fff', 
        transform: [{ rotate: '180deg' }],
        marginTop: -2,
    }
});
