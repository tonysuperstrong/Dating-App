import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, FlatList, TouchableWithoutFeedback, Keyboard, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import ActivityScreen from './ActivityScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  } as any),
});
import ChatService, { ConnectionRequest } from '../services/ChatService';
import ApiService from '../services/ApiService';
import { User } from '../data/users';
import DatePortalView from '../components/DatePortalView';
import SportEventsView from '../components/SportEventsView';
import ProfileView from '../components/ProfileView';

type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Activity: undefined;
  Account: undefined;
  Chat: undefined;
  ChatDetail: { userId: string; matchId: string; name: string; image: string };
  Profile: { userId: string };
  AiAssistant: undefined;
  Schedule: undefined;
  Map: undefined;
  ProfileSetup: { isEditing?: boolean };
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<'home' | 'activity' | 'account'>('home');
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

  // Search State
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);

  // Notification State
  const activeMatchesRef = React.useRef<Set<string>>(new Set());
  const lastMessageTimesRef = React.useRef<Map<string, number>>(new Map());
  const isFirstPoll = React.useRef(true);
  const currentUserIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    loadLocationData();
    
    // Load User ID
    const loadUserId = async () => {
        try {
            const profileString = await AsyncStorage.getItem('userProfile');
            if (profileString) {
                const profile = JSON.parse(profileString);
                currentUserIdRef.current = profile.id;
            }
        } catch (e) {
            console.error('Failed to load user ID', e);
        }
    };
    loadUserId();

    // Request Notification Permissions
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    })();

    // Start Poller for Match Notifications & Messages
    const poller = setInterval(async () => {
        try {
            let myId = currentUserIdRef.current;
            if (!myId) {
                const profileString = await AsyncStorage.getItem('userProfile');
                if (!profileString) return;
                const profile = JSON.parse(profileString);
                myId = profile.id;
                currentUserIdRef.current = myId;
            }
            
            // Get all chats
            const chats = await ChatService.getChats(myId!);
            
            // 1. Check for New Matches (Active matches where I was initiator)
            const myActiveMatches = chats.filter(c => 
                c.status === 'active' && 
                String(c.initiatorId) === String(myId)
            );
            
            const currentIds = new Set(myActiveMatches.map(m => m.id));

            if (isFirstPoll.current) {
                // First run: just sync state, don't alert
                activeMatchesRef.current = currentIds;
                
                // Init message times
                chats.forEach(c => {
                    lastMessageTimesRef.current.set(c.id, c.timestamp);
                });
                
                isFirstPoll.current = false;
            } else {
                // Check for new matches
                let newMatchFound = false;
                let newMatchName = '';

                for (const m of myActiveMatches) {
                    if (!activeMatchesRef.current.has(m.id)) {
                        newMatchFound = true;
                        newMatchName = m.user.name;
                        break; 
                    }
                }

                if (newMatchFound) {
                    // Use native notification for match too
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: 'Match Accepted! 🎉',
                            body: `${newMatchName} accepted your request!`,
                            data: { type: 'match' },
                        },
                        trigger: null,
                    });
                }
                
                // Check for new messages
                for (const chat of chats) {
                    if (chat.status === 'active') {
                        const lastTime = lastMessageTimesRef.current.get(chat.id) || 0;
                        // If new message (timestamp > lastTime) AND I didn't send it
                        // Note: lastMessageSenderId is optional, if missing we skip to avoid self-notif false positives
                        if (chat.timestamp > lastTime) {
                            if (chat.lastMessageSenderId && String(chat.lastMessageSenderId) !== String(myId)) {
                                await Notifications.scheduleNotificationAsync({
                                    content: {
                                        title: chat.user.name,
                                        body: chat.lastMessage,
                                        data: { matchId: chat.id, type: 'message' },
                                    },
                                    trigger: null,
                                });
                            }
                            // Update time
                            lastMessageTimesRef.current.set(chat.id, chat.timestamp);
                        }
                    }
                }
                
                // Update active matches ref
                activeMatchesRef.current = currentIds;
            }

            // Also refresh incoming requests badge
            const reqs = await ChatService.getIncomingRequests(myId || undefined);
            setIncomingRequests(reqs);

        } catch (e) {
            // Ignore poller errors
        }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(poller);
  }, []);

  const loadRequests = useCallback(async () => {
      const userId = currentUserIdRef.current ? currentUserIdRef.current : undefined;
      const reqs = await ChatService.getIncomingRequests(userId);
      setIncomingRequests(reqs);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const handleAcceptRequest = useCallback(async (req: ConnectionRequest) => {
      await ChatService.acceptRequest(req.id);
      loadRequests(); // Refresh list
      Alert.alert('Matched!', `You can now chat with ${req.fromUser.name}.`);
  }, [loadRequests]);

  const handleRejectRequest = useCallback(async (req: ConnectionRequest) => {
      await ChatService.rejectRequest(req.id);
      loadRequests();
  }, [loadRequests]);

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
      // Failed to load location data
    }
  };

  const handleLocationSelect = useCallback(async (selectedLocation: string) => {
    setLocation(selectedLocation);
    setLocationModalVisible(false);
    await AsyncStorage.setItem('userLocation', selectedLocation);
  }, []);

  const handleAddNewLocation = useCallback(async () => {
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
  }, [newLocation, locationHistory]);

  const handleUseCurrentLocation = useCallback(async () => {
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
  }, [locationHistory]);

  const handleCategoryChange = useCallback((category: 'date' | 'sport') => {
    setSelectedCategory(category);
  }, []);

  const handleSearch = useCallback(async () => {
      if (!searchQuery.trim()) return;
      Keyboard.dismiss();
      
      let currentUserId = currentUserIdRef.current || '';
      if (!currentUserId) {
          const profileString = await AsyncStorage.getItem('userProfile');
          if (profileString) {
              const profile = JSON.parse(profileString);
              currentUserId = profile.id;
              currentUserIdRef.current = currentUserId;
          }
      }

      const results = await ApiService.searchUsers(searchQuery, currentUserId);
      const seenNames = new Set<string>();
      const uniqueResults = results.filter((u: any) => {
        const key = (u.name || u.id || '').toString();
        if (!key) return true;
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });
      setSearchResults(uniqueResults);
  }, [searchQuery]);

  const handleSendRequest = useCallback(async (user: User) => {
      let myId = currentUserIdRef.current;
      if (!myId) {
          const profileString = await AsyncStorage.getItem('userProfile');
          if (!profileString) return;
          const profile = JSON.parse(profileString);
          myId = profile.id;
          currentUserIdRef.current = myId;
      }

      try {
          const response = await ApiService.likeUser(myId!, user.id);
          if (response.match) {
              Alert.alert('It\'s a Match!', `You and ${user.name} are now connected!`);
          } else {
              Alert.alert('Request Sent', `Connection request sent to ${user.name}.`);
          }
          setSearchModalVisible(false);
      } catch (error) {
          Alert.alert('Error', 'Failed to send request.');
      }
  }, []);

  const renderSearchResultItem = useCallback(({ item }: { item: User }) => {
    const isColor = item.image && item.image.startsWith('#');
    const hasImage = !!item.image && !isColor;
    return (
      <View style={styles.friendItem}>
          {isColor ? (
              <View style={[styles.friendAvatar, { backgroundColor: item.image }]}>
                  <Text style={{color:'#fff', fontSize:18}}>{item.name[0]}</Text>
              </View>
          ) : hasImage ? (
              <Image source={{ uri: item.image }} style={styles.friendAvatar} />
          ) : (
              <View style={[styles.friendAvatar, { backgroundColor: '#ddd' }]}>
                  <Text style={{color:'#fff', fontSize:18}}>{item.name[0]}</Text>
              </View>
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
    );
  }, [handleSendRequest]);

  const renderCategoryButton = useCallback((type: 'date' | 'sport', label: string, icon: string) => (
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
  ), [selectedCategory]);

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

                    <TouchableOpacity onPress={() => navigation.navigate('Map')} style={{ marginLeft: 15 }}>
                        <Ionicons name="map-outline" size={28} color="#E5566D" />
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

        {/* Activity Tab Content */}
        {activeTab === 'activity' && (
            <View style={{ flex: 1, width: '100%' }}>
                <ActivityScreen />
            </View>
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

            <TouchableOpacity 
                style={styles.navItem} 
                onPress={() => setActiveTab('activity')}
            >
                <Ionicons 
                    name={activeTab === 'activity' ? "pulse" : "pulse-outline"} 
                    size={28} 
                    color={activeTab === 'activity' ? "#E94057" : "#ADADAD"} 
                />
                <Text style={[styles.navText, activeTab === 'activity' && styles.navTextActive]}>Activity</Text>
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
                        renderItem={renderSearchResultItem}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No users found.</Text>
                            </View>
                        }
                    />
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
