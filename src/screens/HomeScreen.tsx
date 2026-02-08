import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Modal, TextInput, FlatList, TouchableWithoutFeedback, Keyboard, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import SportEventsView from '../components/SportEventsView';
import DatePortalView from '../components/DatePortalView';
import ChatService, { ConnectionRequest } from '../services/ChatService';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  Chat: undefined;
  Profile: undefined;
  AiAssistant: undefined;
  Schedule: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<'date' | 'sport'>('date');
  const navigation = useNavigation<HomeScreenNavigationProp>();

  // Location State
  const [location, setLocation] = useState('New York, USA');
  const [isLocationModalVisible, setLocationModalVisible] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [locationHistory, setLocationHistory] = useState<string[]>(['New York, USA', 'London, UK', 'Paris, France', 'Tokyo, Japan']);
  
  // Requests State
  const [requestsModalVisible, setRequestsModalVisible] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);

  useEffect(() => {
    loadLocationData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [])
  );

  const loadRequests = async () => {
      const reqs = await ChatService.getIncomingRequests();
      setIncomingRequests(reqs);
  };

  const handleAcceptRequest = async (req: ConnectionRequest) => {
      await ChatService.acceptRequest(req.id);
      loadRequests(); // Refresh list
      Alert.alert('Matched!', `You can now chat with ${req.fromUser.name}.`);
  };

  const handleRejectRequest = async (req: ConnectionRequest) => {
      await ChatService.rejectRequest(req.id);
      loadRequests();
  };

  const loadLocationData = async () => {
    try {
      const storedLocation = await AsyncStorage.getItem('userLocation');
      const storedHistory = await AsyncStorage.getItem('locationHistory');
      
      if (storedLocation) {
        setLocation(storedLocation);
      }
      if (storedHistory) {
        setLocationHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error('Failed to load location data', error);
    }
  };

  const handleLocationSelect = async (selectedLocation: string) => {
    setLocation(selectedLocation);
    setLocationModalVisible(false);
    await AsyncStorage.setItem('userLocation', selectedLocation);
  };

  const handleAddNewLocation = async () => {
    if (!newLocation.trim()) return;
    
    const updatedHistory = [newLocation, ...locationHistory.filter(l => l !== newLocation)].slice(0, 5); // Keep last 5
    setLocationHistory(updatedHistory);
    setLocation(newLocation);
    setNewLocation('');
    setLocationModalVisible(false);
    
    try {
      await AsyncStorage.setItem('userLocation', newLocation);
      await AsyncStorage.setItem('locationHistory', JSON.stringify(updatedHistory));
    } catch (error) {
      Alert.alert('Error', 'Failed to save location');
    }
  };

  const handleUseCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Permission to access location was denied');
      return;
    }

    try {
      let location = await Location.getCurrentPositionAsync({});
      let reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      if (reverseGeocode.length > 0) {
        const address = reverseGeocode[0];
        const city = address.city || address.subregion || address.region;
        const country = address.country;
        
        // Handle cases where city might be null
        const locationString = city ? `${city}, ${country}` : country || 'Unknown Location';
        
        setLocation(locationString);
        setLocationModalVisible(false);
        await AsyncStorage.setItem('userLocation', locationString);
        
        // Add to history
        const updatedHistory = [locationString, ...locationHistory.filter(l => l !== locationString)].slice(0, 5);
        setLocationHistory(updatedHistory);
        await AsyncStorage.setItem('locationHistory', JSON.stringify(updatedHistory));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location');
    }
  };

  const handleCategoryChange = (category: 'date' | 'sport') => {
    setSelectedCategory(category);
  };

  const renderCategoryButton = (type: 'date' | 'sport', label: string, icon: string) => (
    <TouchableOpacity 
      style={[
        styles.categoryButton, 
        selectedCategory === type && styles.categoryButtonActive
      ]}
      onPress={() => handleCategoryChange(type)}
    >
      <Text style={[
        styles.categoryText,
        selectedCategory === type && styles.categoryTextActive
      ]}>{icon} {label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate('Schedule')}>
                <Ionicons name="calendar-outline" size={28} color="#E5566D" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => setLocationModalVisible(true)} style={styles.locationSelector}>
              <View style={styles.locationIconContainer}>
                <Text style={styles.locationIcon}>📍</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.locationTitle}>Location</Text>
                <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">{location} ▼</Text>
              </View>
            </TouchableOpacity>

            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <TouchableOpacity onPress={() => setRequestsModalVisible(true)} style={{marginRight: 15, position: 'relative'}}>
                    <Ionicons name="notifications-outline" size={28} color="#E5566D" />
                    {incomingRequests.length > 0 && (
                        <View style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: '#E94057',
                            borderWidth: 1,
                            borderColor: '#fff'
                        }} />
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('Chat')}>
                    <Ionicons name="chatbubbles-outline" size={28} color="#E5566D" />
                </TouchableOpacity>
            </View>
        </View>

        <Modal
          animationType="slide"
          transparent={true}
          visible={isLocationModalVisible}
          onRequestClose={() => setLocationModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={() => setLocationModalVisible(false)}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Location</Text>
                  
                  <TouchableOpacity style={styles.currentLocationButton} onPress={handleUseCurrentLocation}>
                    <Text style={styles.currentLocationText}>📍 Use Current Location</Text>
                  </TouchableOpacity>

                  <View style={styles.separatorContainer}>
                    <View style={styles.separatorLine} />
                    <Text style={styles.separatorText}>OR</Text>
                    <View style={styles.separatorLine} />
                  </View>

                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="City, Country (e.g. Paris, France)"
                      value={newLocation}
                      onChangeText={setNewLocation}
                    />
                    <TouchableOpacity style={styles.addButton} onPress={handleAddNewLocation}>
                      <Text style={styles.addButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.historyTitle}>Previous Locations</Text>
                  <FlatList
                    data={locationHistory}
                    keyExtractor={(item, index) => index.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.locationItem} 
                        onPress={() => handleLocationSelect(item)}
                      >
                        <Text style={[
                          styles.locationItemText, 
                          item === location && styles.activeLocationText
                        ]}>
                          {item === location ? '📍 ' : '   '} {item}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                  
                  <TouchableOpacity 
                    style={styles.closeButton} 
                    onPress={() => setLocationModalVisible(false)}
                  >
                    <Text style={styles.closeButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <View style={styles.categoryContainer}>
          {renderCategoryButton('date', 'Date', '🌹')}
          {renderCategoryButton('sport', 'Sport', '⚽️')}
        </View>

        <View style={{ flex: 1, width: '100%' }}>
            {selectedCategory === 'sport' ? (
                 <SportEventsView />
            ) : (
                 <DatePortalView />
            )}
        </View>

        <TouchableOpacity 
          style={styles.aiButton} 
          onPress={() => navigation.navigate('AiAssistant')}
        >
          <Text style={styles.aiButtonText}>✨ AI</Text>
        </TouchableOpacity>

        {/* Notifications / Requests Modal */}
        <Modal
            visible={requestsModalVisible}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Connection Requests</Text>
                    <TouchableOpacity onPress={() => setRequestsModalVisible(false)}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
                {incomingRequests.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No new requests.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={incomingRequests}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.requestItem}>
                                <View style={[styles.viewerAvatar, { backgroundColor: item.fromUser.image }]}>
                                    <Text style={styles.viewerInitial}>{item.fromUser.name[0]}</Text>
                                </View>
                                <View style={styles.viewerInfo}>
                                    <Text style={styles.viewerName}>{item.fromUser.name} wants to chat</Text>
                                    <Text style={styles.viewerTime}>{item.fromUser.age} • {item.fromUser.location}</Text>
                                </View>
                                <View style={styles.actionButtons}>
                                    <TouchableOpacity style={[styles.actionButton, styles.rejectButton]} onPress={() => handleRejectRequest(item)}>
                                        <Ionicons name="close" size={20} color="#E94057" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={() => handleAcceptRequest(item)}>
                                        <Ionicons name="heart" size={20} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    />
                )}
            </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f3f3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: 1,
    maxWidth: '50%',
    marginHorizontal: 10,
  },
  locationIconContainer: {
    marginRight: 6,
    backgroundColor: '#fff',
    padding: 3,
    borderRadius: 10,
  },
  locationIcon: {
    fontSize: 14,
  },
  locationTitle: {
    fontSize: 8,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5566D',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  currentLocationText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  separatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#eee',
  },
  separatorText: {
    marginHorizontal: 10,
    color: '#999',
    fontWeight: '600',
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    backgroundColor: '#f9f9f9',
  },
  addButton: {
    backgroundColor: '#E5566D',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#666',
  },
  locationItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  locationItemText: {
    fontSize: 16,
    color: '#333',
  },
  activeLocationText: {
    color: '#E5566D',
    fontWeight: 'bold',
  },
  closeButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryButtonActive: {
    backgroundColor: '#E94057',
  },
  categoryText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#fff',
  },
  aiButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E94057',
    zIndex: 100,
  },
  aiButtonText: {
    color: '#E94057',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  emptyText: {
      fontSize: 16,
      color: '#888',
  },
  requestItem: {
      flexDirection: 'row',
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
      alignItems: 'center',
  },
  viewerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  viewerInitial: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  viewerInfo: {
    flex: 1,
  },
  viewerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  viewerTime: {
    fontSize: 12,
    color: '#888',
  },
  actionButtons: {
      flexDirection: 'row',
  },
  actionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
  },
  acceptButton: {
      backgroundColor: '#E94057',
  },
  rejectButton: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#eee',
  },
});
