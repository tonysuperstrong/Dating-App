import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Alert, 
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';

import { SportsService, Game } from '../services/SportsService';
import ApiService from '../services/ApiService';

const { width } = Dimensions.get('window');

// Types
interface SportEvent {
  id: string;
  hostId: string; // 'me' or other
  sport: string;
  matchup?: string; // e.g. "Arsenal vs Chelsea"
  location: string; // Place Name
  address: string; // Exact details (Street, City, Country)
  date: string;
  time: string;
  maxPeople: number;
  currentPeople: number;
  description: string;
  joined: boolean;
}

// Mock Pubs
const MOCK_PUBS: Record<string, string[]> = {
  'United Kingdom': ['The Red Lion', 'The Crown', 'Wetherspoons', 'O\'Neills', 'The Kings Head'],
  'United States of America': ['Buffalo Wild Wings', 'Yard House', 'The Irish Pub', 'Sports Bar & Grill', 'Miller\'s Ale House'],
  'Spain': ['Cervecería 100 Montaditos', 'The Irish Rover', 'Sports Bar Madrid', 'Belushi\'s', 'Cheers'],
  'default': ['Local Sports Bar', 'The City Pub', 'Downtown Brewery', 'Corner Tavern', 'The Stadium Club']
};

const GamesCarousel = React.memo(({ games }: { games: Game[] }) => {
  if (games.length === 0) return (
      <View style={styles.noGamesContainer}>
          <Text style={styles.noGamesText}>No games scheduled today</Text>
      </View>
  );

  return (
      <View style={styles.gamesSection}>
          <Text style={styles.sectionTitle}>Today's Fixtures ({new Date().toLocaleDateString()})</Text>
          <FlatList
              horizontal
              data={games}
              keyExtractor={item => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gamesScrollContent}
              renderItem={({ item: game }) => (
                  <View style={styles.gameCard}>
                      <Text style={styles.gameTime}>
                          {new Date(game.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                      <Text style={styles.gameMatchup}>{game.name.replace(' at ', ' vs ')}</Text>
                      <Text style={styles.gameLeague}>{game.league}</Text>
                      <Text style={styles.gameStatus}>{game.status}</Text>
                  </View>
              )}
          />
      </View>
  );
});

const EventItem = React.memo(({ item, onJoin }: { item: SportEvent, onJoin: (id: string) => void }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.sportBadge}>
            <Text style={styles.sportText}>
              {item.sport} {item.sport === 'Soccer' ? '⚽️' : item.sport === 'Basketball' ? '🏀' : '🎾'}
            </Text>
        </View>
        <Text style={styles.teamText}>{item.matchup}</Text>
      </View>
      
      <Text style={styles.locationText}>📍 {item.location}</Text>
      {item.address && <Text style={styles.addressText}>{item.address}</Text>}
      <Text style={styles.timeText}>🕒 {item.time} • 👥 {item.currentPeople}/{item.maxPeople} joined</Text>
      
      <Text style={styles.description}>{item.description}</Text>

      <TouchableOpacity 
        style={[styles.joinButton, item.joined ? styles.joinedButton : {}]}
        onPress={() => onJoin(item.id)}
      >
        <Text style={[styles.joinButtonText, item.joined ? styles.joinedButtonText : {}]}>
            {item.joined ? 'Joined ✅' : 'Accept Invitation'}
        </Text>
      </TouchableOpacity>
    </View>
));

export default function SportEventsView() {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [userCountry, setUserCountry] = useState<string>('default');
  const [userId, setUserId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Category State
  const [selectedCategory, setSelectedCategory] = useState('Soccer'); // Default category
  const [realGames, setRealGames] = useState<Game[]>([]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalCategory, setModalCategory] = useState('Soccer');
  const [modalGames, setModalGames] = useState<Game[]>([]);
  const [selectedMatchup, setSelectedMatchup] = useState('');
  
  // Location State
  const [placeName, setPlaceName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [time, setTime] = useState('');
  const [maxPeople, setMaxPeople] = useState('');
  const [description, setDescription] = useState('');

  // Picker Modal State
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerData, setPickerData] = useState<{label: string, value: string}[]>([]);
  const [pickerAction, setPickerAction] = useState<(value: string) => void>(() => {});

  // Map State
  const [mapRegion, setMapRegion] = useState<Region | null>(null);

  // Initialize Map
  useEffect(() => {
    if (modalVisible) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission',
            'Permission to access location was denied. The map will default to London.',
            [{ text: 'OK' }]
          );
          // Default to London
          setMapRegion({
            latitude: 51.5074,
            longitude: -0.1278,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
          return;
        }

        let location = await Location.getCurrentPositionAsync({});
        setMapRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      })();
    }
  }, [modalVisible]);

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });
    
    // Reverse Geocode
    try {
        const address = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address.length > 0) {
            const addr = address[0];
            setStreet(addr.street || addr.name || '');
            setCity(addr.city || addr.subregion || '');
            setCountry(addr.country || '');
            if (addr.name && addr.name !== addr.street) {
                setPlaceName(addr.name);
            }
        }
    } catch (error) {
        console.log('Reverse geocode failed', error);
    }
  };

  // Clock Effect
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Reload events when userId is set to ensure joined status is correct
  useEffect(() => {
    if (userId) {
        loadEvents();
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
      loadEvents();
    }, [])
  );

  // Update matches when category changes
  useEffect(() => {
    loadRealMatches();
  }, [selectedCategory]);

  // Update modal matches when modal category changes
  useEffect(() => {
    loadModalMatches();
  }, [modalCategory]);

  // Sync modal category when opening
  useEffect(() => {
    if (modalVisible) {
        setModalCategory(selectedCategory);
    }
  }, [modalVisible]);

  const loadRealMatches = async () => {
    setRealGames([]); // Clear while loading
    try {
        const games = await fetchGamesForCategory(selectedCategory);
        setRealGames(games);
    } catch (error) {
        console.error('Failed to load matches', error);
    }
  };

  const loadModalMatches = async () => {
    setModalGames([]);
    try {
        const games = await fetchGamesForCategory(modalCategory);
        setModalGames(games);
    } catch (error) {
        console.error('Failed to load modal matches', error);
    }
  };

  const fetchGamesForCategory = async (category: string) => {
    if (category === 'Basketball') return await SportsService.getNBAGames();
    else if (category === 'Soccer') return await SportsService.getSoccerGames();
    else if (category === 'Tennis') return await SportsService.getTennisGames();
    return [];
  };

  const loadUserProfile = async () => {
    try {
      const profileString = await AsyncStorage.getItem('userProfile');
      if (profileString) {
        const profile = JSON.parse(profileString);
        if (profile.id) setUserId(profile.id);

        if (profile.country && MOCK_PUBS[profile.country]) {
          setUserCountry(profile.country);
        } else {
          setUserCountry('default');
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const apiEvents = await ApiService.getSportEvents(userId);
      if (!Array.isArray(apiEvents)) {
        console.error('loadEvents: apiEvents is not an array', apiEvents);
        return;
      }
      const mappedEvents = apiEvents.map((e: any) => ({
        id: e.id,
        hostId: e.host_id,
        sport: e.sport,
        matchup: e.matchup,
        location: e.location,
        address: e.address,
        date: e.date,
        time: e.time,
        maxPeople: e.max_people,
        currentPeople: e.currentPeople,
        description: e.description,
        joined: e.joined
      }));
      setEvents(mappedEvents);
    } catch (error) {
      console.error('Error loading events', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    // Simulate network delay
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleCreateEvent = async () => {
    if (!selectedMatchup || !placeName || !street || !city || !country || !time || !maxPeople || !description) {
      Alert.alert('Missing Info', 'Please fill in all fields.');
      return;
    }

    const addressString = `${street}, ${city}, ${country}`;

    const eventData = {
      host_id: userId,
      sport: modalCategory,
      matchup: selectedMatchup,
      location: placeName,
      address: addressString,
      date: new Date().toISOString().split('T')[0],
      time: time,
      max_people: parseInt(maxPeople) || 10,
      description: description
    };

    try {
      await ApiService.createSportEvent(eventData);
      await loadEvents();
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Event created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create event');
    }
  };

  const resetForm = () => {
    setSelectedMatchup('');
    setPlaceName('');
    setStreet('');
    setCity('');
    setCountry('');
    setTime('');
    setMaxPeople('');
    setDescription('');
  };

  const handleJoinEvent = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    try {
      if (event.joined) {
        // Leave
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await ApiService.leaveSportEvent(eventId, userId);
        removeFromSchedule(event);
      } else {
        // Join
        if (event.currentPeople >= event.maxPeople) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Full', 'This event is already full!');
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await ApiService.joinSportEvent(eventId, userId);
        addToSchedule(event);
      }
      // Refresh to get updated count and status
      await loadEvents();
    } catch (error) {
      console.error('Error joining/leaving event', error);
      Alert.alert('Error', 'Failed to update event status');
    }
  };

  const addToSchedule = async (event: SportEvent) => {
    try {
      const storedSchedule = await AsyncStorage.getItem('scheduleEvents');
      const scheduleEvents = storedSchedule ? JSON.parse(storedSchedule) : [];
      
      const newScheduleEvent = {
        id: `sport-${event.id}`, // Unique prefix
        date: event.date,
        title: `${event.sport}: ${event.matchup || 'Sport Event'}`,
        time: event.time,
        description: `Location: ${event.location}\n${event.description}`
      };
      
      const updatedSchedule = [...scheduleEvents, newScheduleEvent];
      await AsyncStorage.setItem('scheduleEvents', JSON.stringify(updatedSchedule));
      Alert.alert('Added to Calendar', 'This event has been added to your schedule!');
    } catch (error) {
      console.error('Error adding to schedule', error);
    }
  };

  const removeFromSchedule = async (event: SportEvent) => {
    try {
      const storedSchedule = await AsyncStorage.getItem('scheduleEvents');
      if (!storedSchedule) return;
      
      const scheduleEvents = JSON.parse(storedSchedule);
      const updatedSchedule = scheduleEvents.filter((e: any) => e.id !== `sport-${event.id}`);
      
      await AsyncStorage.setItem('scheduleEvents', JSON.stringify(updatedSchedule));
    } catch (error) {
      console.error('Error removing from schedule', error);
    }
  };

  const getPubsForCountry = () => {
    return MOCK_PUBS[userCountry] || MOCK_PUBS['default'];
  };

  const openMatchupPicker = () => {
    if (modalGames.length === 0) {
        Alert.alert('No Games', `No games available for ${modalCategory} today.`);
        return;
    }
    const data = modalGames.map(game => ({
        label: game.name.replace(' at ', ' vs '),
        value: game.name.replace(' at ', ' vs ')
    }));
    setPickerTitle(`Select ${modalCategory} Match`);
    setPickerData(data);
    setPickerAction(() => (val: string) => setSelectedMatchup(val));
    setPickerVisible(true);
  };

  const openLocationPicker = () => {
    const pubs = getPubsForCountry();
    const data = pubs.map(pub => ({
        label: pub,
        value: pub
    }));
    setPickerTitle('Select Location');
    setPickerData(data);
    setPickerAction(() => (val: string) => setStreet(val));
    setPickerVisible(true);
  };

  const getFilteredEvents = useMemo(() => {
    return events.filter(event => event.sport === selectedCategory);
  }, [events, selectedCategory]);

  const renderEventItem = useCallback(({ item }: { item: SportEvent }) => (
    <EventItem item={item} onJoin={handleJoinEvent} />
  ), [handleJoinEvent]);

  const categories = ['Soccer', 'Basketball', 'Tennis'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Sport Portal</Text>
            <Text style={styles.clockText}>{currentTime.toLocaleTimeString()}</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryContainer}>
        {categories.map(category => (
          <TouchableOpacity 
            key={category} 
            style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[styles.categoryButtonText, selectedCategory === category && styles.categoryButtonTextActive]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={getFilteredEvents}
        renderItem={renderEventItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<GamesCarousel games={realGames} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No {selectedCategory} events found. Be the first to create one!
          </Text>
        }
      />

      {/* Create Event Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Event</Text>
            <TouchableOpacity onPress={() => {
                resetForm();
                setModalVisible(false);
            }}>
              <Text style={styles.closeText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.form}>
            {/* Sport Selection - Interactive */}
            <Text style={styles.label}>Select Sport</Text>
            <View style={styles.sportSelectionRow}>
                {categories.map(cat => (
                    <TouchableOpacity 
                        key={cat} 
                        style={[
                            styles.modalSportButton, 
                            modalCategory === cat && styles.modalSportButtonActive
                        ]}
                        onPress={() => {
                            setModalCategory(cat);
                            setSelectedMatchup(''); // Reset matchup selection
                        }}
                    >
                        <Text style={[
                            styles.modalSportButtonText, 
                            modalCategory === cat && styles.modalSportButtonTextActive
                        ]}>
                            {cat} {cat === 'Soccer' ? '⚽️' : cat === 'Basketball' ? '🏀' : '🎾'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Matchup Selection */}
            <Text style={styles.label}>Select Matchup (Today's Fixtures)</Text>
            <TouchableOpacity 
                style={styles.dropdownButton}
                onPress={openMatchupPicker}
            >
                <Text style={styles.inputText}>{selectedMatchup || 'Select a match...'}</Text>
            </TouchableOpacity>
            
            {/* Location with Map */}
            <Text style={styles.label}>Location</Text>
            {mapRegion && (
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        region={mapRegion}
                        onPress={handleMapPress}
                    >
                        <Marker coordinate={mapRegion} />
                    </MapView>
                    <View style={styles.mapHintContainer}>
                        <Text style={styles.mapHint}>Tap to select location</Text>
                    </View>
                </View>
            )}
            <View style={{ zIndex: 10 }}>
                <TextInput
                    style={[styles.input, { marginBottom: 10 }]}
                    value={placeName}
                    onChangeText={setPlaceName}
                    placeholder="Place Name (e.g. The Red Lion)"
                />
                <TextInput
                    style={[styles.input, { marginBottom: 10 }]}
                    value={street}
                    onChangeText={setStreet}
                    placeholder="Street / Address"
                />
                <TextInput
                    style={[styles.input, { marginBottom: 10 }]}
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                />
                <TextInput
                    style={styles.input}
                    value={country}
                    onChangeText={setCountry}
                    placeholder="Country"
                />
            </View>
            
            {/* Time */}
            <Text style={styles.label}>Time (e.g. 19:00)</Text>
            <TextInput
                style={styles.input}
                value={time}
                onChangeText={setTime}
                placeholder="HH:MM"
                keyboardType="numbers-and-punctuation"
            />

            {/* Max People */}
            <Text style={styles.label}>Max People</Text>
            <TextInput
                style={styles.input}
                value={maxPeople}
                onChangeText={setMaxPeople}
                placeholder="e.g. 10"
                keyboardType="numeric"
            />

            {/* Description */}
            <Text style={styles.label}>Short Description</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the plan..."
                multiline
                numberOfLines={3}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleCreateEvent}>
                <Text style={styles.submitButtonText}>Post Event</Text>
            </TouchableOpacity>

          </ScrollView>

          {pickerVisible && (
            <View style={styles.pickerOverlay}>
                <View style={styles.pickerContent}>
                    <View style={styles.pickerHeader}>
                        <Text style={styles.pickerTitle}>{pickerTitle}</Text>
                        <TouchableOpacity onPress={() => setPickerVisible(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        data={pickerData}
                        keyExtractor={(item) => item.value}
                        renderItem={({item}) => (
                            <TouchableOpacity 
                                style={styles.pickerItem} 
                                onPress={() => {
                                    pickerAction(item.value);
                                    setPickerVisible(false);
                                }}
                            >
                                <Text style={styles.pickerItemText}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>
          )}
        </View>
      </Modal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapContainer: {
    height: 200,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapHintContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  mapHint: {
    color: 'white',
    fontSize: 12,
  },
  headerLeft: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  clockText: {
    fontSize: 14,
    color: '#E94057',
    fontWeight: '600',
    marginTop: 4,
  },
  createButton: {
    backgroundColor: '#E94057',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  categoryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryButtonActive: {
    backgroundColor: '#E94057',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100, // Space for bottom nav
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sportBadge: {
    backgroundColor: '#e6f7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  sportText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  teamText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  locationText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  addressText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
    marginLeft: 18, // Align with text after emoji
  },
  timeText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 20,
    marginBottom: 15,
  },
  joinButton: {
    backgroundColor: '#E94057',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  joinedButton: {
    backgroundColor: '#e1f5e6',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  joinedButtonText: {
    color: '#4caf50',
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 50,
  },
  
  // Games Section
  gamesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  gamesScrollContent: {
    paddingRight: 20,
  },
  gameCard: {
    backgroundColor: '#333',
    padding: 15,
    borderRadius: 12,
    marginRight: 15,
    width: 180,
  },
  gameTime: {
    color: '#E94057',
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 5,
  },
  gameMatchup: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 5,
  },
  gameLeague: {
    color: '#aaa',
    fontSize: 12,
  },
  gameStatus: {
    color: '#4CD964',
    fontSize: 10,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  noGamesContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 20,
  },
  noGamesText: {
    color: '#888',
    fontStyle: 'italic',
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    padding: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeText: {
    color: '#E94057',
    fontSize: 16,
  },
  form: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#E94057',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 50,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  dropdownButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownList: {
    backgroundColor: '#fff',
    marginTop: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  noDataText: {
    padding: 12,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  
  // Interactive Sport Buttons
  sportSelectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalSportButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalSportButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#E94057',
  },
  modalSportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  modalSportButtonTextActive: {
    color: '#E94057',
    fontWeight: 'bold',
  },
  
  // Picker Modal Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  pickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '60%',
    paddingBottom: 40,
  },
  pickerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pickerItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#333',
  },
});
