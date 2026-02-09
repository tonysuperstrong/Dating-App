import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions, Modal, TextInput, FlatList, TouchableWithoutFeedback, Keyboard, Alert, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import ProfileView from '../components/ProfileView';
import SportEventsView from '../components/SportEventsView';
import DatePortalView from '../components/DatePortalView';
import ChatService, { ConnectionRequest, ChatSession } from '../services/ChatService';
import ApiService from '../services/ApiService';
import { User } from '../data/users';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  Chat: undefined;
  Profile: undefined;
  AiAssistant: undefined;
  Schedule: undefined;
  ProfileSetup: { isEditing?: boolean };
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<'home' | 'account'>('home');
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

  // Call Feature State
  const [isCallModalVisible, setCallModalVisible] = useState(false);
  const [callType, setCallType] = useState<'phone' | 'facetime' | null>(null);
  const [callFriends, setCallFriends] = useState<ChatSession[]>([]); // Matches to call
  const [callStep, setCallStep] = useState<'type_selection' | 'user_selection'>('type_selection');

  // Search State
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  // Notification State
  const activeMatchesRef = React.useRef<Set<string>>(new Set());
  const isFirstPoll = React.useRef(true);

  useEffect(() => {
    loadLocationData();
    
    // Start Poller for Match Notifications
    const poller = setInterval(async () => {
        try {
            const profileString = await AsyncStorage.getItem('userProfile');
            if (!profileString) return;
            const profile = JSON.parse(profileString);
            
            // Get all chats
            const chats = await ChatService.getChats();
            
            // Filter: Active matches where I was the initiator
            const myActiveMatches = chats.filter(c => 
                c.status === 'active' && 
                String(c.initiatorId) === String(profile.id)
            );
            
            const currentIds = new Set(myActiveMatches.map(m => m.id));

            if (isFirstPoll.current) {
                // First run: just sync state, don't alert
                activeMatchesRef.current = currentIds;
                isFirstPoll.current = false;
            } else {
                // Subsequent runs: check for new matches
                let newMatchFound = false;
                let newMatchName = '';

                for (const m of myActiveMatches) {
                    if (!activeMatchesRef.current.has(m.id)) {
                        newMatchFound = true;
                        newMatchName = m.user.name;
                        break; // Notify for at least one
                    }
                }

                if (newMatchFound) {
                    Alert.alert('Match Accepted!', `${newMatchName} accepted your request! Start chatting now.`);
                }
                
                // Update ref
                activeMatchesRef.current = currentIds;
            }

            // Also refresh incoming requests badge
            const reqs = await ChatService.getIncomingRequests();
            setIncomingRequests(reqs);

        } catch (e) {
            console.error("Poller error:", e);
        }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(poller);
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

  // Call Feature Handlers
  const openCallModal = async () => {
    // Check if user has phone number verified
    try {
        const profileString = await AsyncStorage.getItem('userProfile');
        if (profileString) {
            const profile = JSON.parse(profileString);
            if (!profile.phone_number) {
                Alert.alert(
                    'Phone Number Required',
                    'Please add your phone number in your profile to use the call feature.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Go to Profile', onPress: () => navigation.navigate('ProfileSetup', { isEditing: true }) }
                    ]
                );
                return;
            }
        }
    } catch (error) {
        console.error('Error checking profile for call:', error);
    }

    setCallStep('type_selection');
    setCallType(null);
    setCallModalVisible(true);
    
    // Fetch friends (active chats)
    try {
        const chats = await ChatService.getChats();
        // Filter only active chats or people you can call
        const friends = chats.filter(c => c.status === 'active' || c.status === 'pending'); // Maybe allow pending too?
        setCallFriends(friends);
    } catch (error) {
        console.error('Error fetching friends for call:', error);
    }
  };

  const handleSelectCallType = (type: 'phone' | 'facetime') => {
    setCallType(type);
    setCallStep('user_selection');
  };

  const handleMakeCall = (user: ChatSession['user']) => {
    setCallModalVisible(false);
    const name = user.name || 'User';
    
    if (callType === 'phone') {
        if (user.phone_number) {
            Linking.openURL(`tel:${user.phone_number}`);
        } else {
            Alert.alert('No Phone Number', `${name} hasn't added a phone number yet.`);
        }
    } else {
        // Fallback or keep mock for FaceTime as we don't store emails yet
        Alert.alert('FaceTime', `Starting FaceTime with ${name}...`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Start', onPress: () => Linking.openURL(`facetime:${user.phone_number || 'user@example.com'}`) } 
        ]);
    }
  };

  // Search Handlers
  const handleSearch = async () => {
      if (!searchQuery.trim()) return;
      Keyboard.dismiss();
      
      const profileString = await AsyncStorage.getItem('userProfile');
      let currentUserId = '';
      if (profileString) {
          const profile = JSON.parse(profileString);
          currentUserId = profile.id;
      }

      const results = await ApiService.searchUsers(searchQuery, currentUserId);
      setSearchResults(results);
  };

  const handleSendRequest = async (user: User) => {
      const profileString = await AsyncStorage.getItem('userProfile');
      if (!profileString) return;
      const profile = JSON.parse(profileString);

      try {
          const response = await ApiService.likeUser(profile.id, user.id);
          if (response.match) {
              Alert.alert('It\'s a Match!', `You and ${user.name} are now connected!`);
          } else {
              Alert.alert('Request Sent', `Connection request sent to ${user.name}.`);
          }
          setSearchModalVisible(false);
      } catch (error) {
          Alert.alert('Error', 'Failed to send request.');
      }
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
        
        {/* Home Tab Content */}
        {activeTab === 'home' && (
            <>
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
                        <TouchableOpacity onPress={() => setSearchModalVisible(true)} style={{marginRight: 15}}>
                            <Ionicons name="search" size={28} color="#E5566D" />
                        </TouchableOpacity>

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
            </>
        )}

        {/* Account Tab Content */}
        {activeTab === 'account' && (
            <View style={{ flex: 1, width: '100%' }}>
                <ProfileView />
            </View>
        )}

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNav}>
            <TouchableOpacity 
                style={styles.navItem} 
                onPress={() => setActiveTab('home')}
            >
                <Ionicons 
                    name={activeTab === 'home' ? "home" : "home-outline"} 
                    size={28} 
                    color={activeTab === 'home' ? "#E94057" : "#ADADAD"} 
                />
                <Text style={[styles.navText, activeTab === 'home' && styles.navTextActive]}>Home</Text>
            </TouchableOpacity>
            
            {/* Call Button (Center) */}
            <TouchableOpacity 
                style={styles.callButtonWrapper} 
                onPress={openCallModal}
            >
                <View style={styles.callButtonCircle}>
                    <Ionicons name="call" size={28} color="#fff" />
                </View>
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.navItem} 
                onPress={() => setActiveTab('account')}
            >
                <Ionicons 
                    name={activeTab === 'account' ? "person" : "person-outline"} 
                    size={28} 
                    color={activeTab === 'account' ? "#E94057" : "#ADADAD"} 
                />
                <Text style={[styles.navText, activeTab === 'account' && styles.navTextActive]}>Account</Text>
            </TouchableOpacity>
        </View>

        {/* Search Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={isSearchModalVisible}
            onRequestClose={() => setSearchModalVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { height: '80%' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Find People</Text>
                        <TouchableOpacity onPress={() => setSearchModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Search by username or name..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                            onSubmitEditing={handleSearch}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={handleSearch}>
                            <Ionicons name="search" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={searchResults}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.friendItem}>
                                {item.image && item.image.startsWith('#') ? (
                                    <View style={[styles.friendAvatar, { backgroundColor: item.image }]}>
                                        <Text style={{color:'#fff', fontSize:18}}>{item.name[0]}</Text>
                                    </View>
                                ) : (
                                    <Image source={{ uri: item.image }} style={styles.friendAvatar} />
                                )}
                                <View style={{flex: 1}}>
                                    <Text style={styles.friendName}>{item.name}</Text>
                                    <Text style={styles.friendStatus}>@{item.username}</Text>
                                </View>
                                <TouchableOpacity 
                                    style={styles.actionButton} 
                                    onPress={() => handleSendRequest(item)}
                                >
                                    <Ionicons name="person-add" size={20} color="#E5566D" />
                                </TouchableOpacity>
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No users found.</Text>
                            </View>
                        }
                    />
                </View>
            </View>
        </Modal>

        {/* Call Selection Modal */}
        <Modal
            animationType="slide"
            transparent={true}
            visible={isCallModalVisible}
            onRequestClose={() => setCallModalVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { height: callStep === 'user_selection' ? '60%' : 'auto' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {callStep === 'type_selection' ? 'Start a Call' : `Select Contact (${callType === 'phone' ? 'Phone' : 'FaceTime'})`}
                        </Text>
                        <TouchableOpacity onPress={() => setCallModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {callStep === 'type_selection' ? (
                        <View style={styles.callTypeContainer}>
                            <TouchableOpacity style={styles.callTypeButton} onPress={() => handleSelectCallType('phone')}>
                                <View style={[styles.callIconCircle, { backgroundColor: '#4CD964' }]}>
                                    <Ionicons name="call" size={32} color="#fff" />
                                </View>
                                <Text style={styles.callTypeText}>Phone Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.callTypeButton} onPress={() => handleSelectCallType('facetime')}>
                                <View style={[styles.callIconCircle, { backgroundColor: '#34C759' }]}>
                                    <Ionicons name="videocam" size={32} color="#fff" />
                                </View>
                                <Text style={styles.callTypeText}>FaceTime</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flex: 1, width: '100%' }}>
                            {callFriends.length > 0 ? (
                                <FlatList
                                    data={callFriends}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity style={styles.friendItem} onPress={() => handleMakeCall(item.user)}>
                                            {item.user.image && item.user.image.startsWith('#') ? (
                                                <View style={[styles.friendAvatar, { backgroundColor: item.user.image }]}>
                                                    <Text style={{color:'#fff', fontSize:18}}>{item.user.name[0]}</Text>
                                                </View>
                                            ) : (
                                                <Image source={{ uri: item.user.image }} style={styles.friendAvatar} />
                                            )}
                                            <View style={{flex: 1}}>
                                                <Text style={styles.friendName}>{item.user.name}</Text>
                                                <Text style={styles.friendStatus}>{item.status === 'active' ? 'Match' : 'Pending'}</Text>
                                            </View>
                                            <Ionicons name={callType === 'phone' ? "call-outline" : "videocam-outline"} size={24} color="#E5566D" />
                                        </TouchableOpacity>
                                    )}
                                />
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No matches found to call.</Text>
                                </View>
                            )}
                            <TouchableOpacity style={styles.backButton} onPress={() => setCallStep('type_selection')}>
                                <Text style={styles.backButtonText}>Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>

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
    paddingBottom: 80, // Add padding for bottom nav
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    height: 70,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    position: 'absolute',
    bottom: 0,
    paddingBottom: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navText: {
    fontSize: 10,
    color: '#ADADAD',
    marginTop: 4,
  },
  navTextActive: {
    color: '#E94057',
    fontWeight: 'bold',
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
  callButtonWrapper: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E94057',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E94057',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  callTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 30,
  },
  callTypeButton: {
    alignItems: 'center',
  },
  callIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  callTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  friendStatus: {
    fontSize: 12,
    color: '#888',
  },
  backButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#333',
    fontWeight: '600',
  },
});
