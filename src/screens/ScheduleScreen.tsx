import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, FlatList, Alert, Image, ScrollView, SafeAreaView, Dimensions } from 'react-native';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';

import DateService, { ScheduledDate } from '../services/DateService';
import ChatService, { ChatSession } from '../services/ChatService';
import ApiService from '../services/ApiService';

interface ScheduleEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  description?: string;
  type: 'personal' | 'date';
  status?: string;
  partnerId?: string;
  partnerName?: string;
  partnerImage?: string;
  isSender?: boolean;
}

export default function ScheduleScreen() {
  const [selectedDate, setSelectedDate] = useState('');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [eventType, setEventType] = useState<'personal' | 'date'>('personal');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  const [matches, setMatches] = useState<ChatSession[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Map State
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const isTypingLocation = useRef(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const navigation = useNavigation();

  const loadMatches = useCallback(async () => {
    try {
      const chats = await ChatService.getChats();
      // Only active matches
      setMatches(chats.filter(c => c.status === 'active'));
    } catch (error) {
      console.error('Failed to load matches', error);
    }
  }, []);

  const loadUserData = useCallback(async () => {
    const profileString = await AsyncStorage.getItem('userProfile');
    if (profileString) {
      const profile = JSON.parse(profileString);
      setCurrentUserId(profile.id);
      loadMatches();
    }
  }, [loadMatches]);

  const loadEvents = useCallback(async () => {
    try {
      // 1. Load Personal Events
      let personalEvents: ScheduleEvent[] = [];
      const storedEvents = await AsyncStorage.getItem('scheduleEvents');
      if (storedEvents) {
        const parsed = JSON.parse(storedEvents);
        // Ensure type is set
        personalEvents = parsed.map((e: any) => ({ ...e, type: e.type || 'personal' }));
      }

      // 2. Load Date Requests (if logged in)
      let dateEvents: ScheduleEvent[] = [];
      if (currentUserId) {
        const dates = await DateService.getDates(currentUserId);
        dateEvents = dates.map(d => {
          const isSender = d.sender_id === currentUserId;
          const partnerName = isSender ? d.receiver_name : d.sender_name;
          const partnerImage = isSender ? d.receiver_image : d.sender_image;
          
          return {
            id: d.id,
            date: d.date,
            title: `Date with ${partnerName}`,
            time: d.time,
            description: d.description || d.location, // Show location in desc if no desc
            type: 'date',
            status: d.status,
            partnerId: isSender ? d.receiver_id : d.sender_id,
            partnerName,
            partnerImage,
            isSender
          };
        });
      }

      // Merge and Sort
      const allEvents = [...personalEvents, ...dateEvents].sort((a, b) => {
        // Sort by time
        return a.time.localeCompare(b.time);
      });

      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load events', error);
    }
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  useEffect(() => {
    if (currentUserId) {
      loadEvents();
    }
  }, [currentUserId, loadEvents]);

  const savePersonalEvents = useCallback(async (newEvents: ScheduleEvent[]) => {
    try {
      const personalOnly = newEvents.filter(e => e.type === 'personal');
      await AsyncStorage.setItem('scheduleEvents', JSON.stringify(personalOnly));
      // Update state is handled by reload or caller
    } catch (error) {
      // Failed to save events
    }
  }, []);

  const handleDayPress = useCallback((day: any) => {
    setSelectedDate(day.dateString);
    setEditingEventId(null);
    resetForm();
    setModalVisible(true);
  }, []);

  const resetForm = () => {
    setEventType('personal');
    setNewEventTitle('');
    setNewEventTime('');
    setNewEventDescription('');
    setNewEventLocation('');
    setSelectedMatchId(null);
  };

  const handleSaveEvent = useCallback(async () => {
    if (!newEventTime) {
      Alert.alert('Error', 'Please enter a time');
      return;
    }

    if (eventType === 'personal') {
        if (!newEventTitle) {
            Alert.alert('Error', 'Please enter a title');
            return;
        }

        const newEvent: ScheduleEvent = {
            id: Date.now().toString(),
            date: selectedDate,
            title: newEventTitle,
            time: newEventTime,
            description: newEventDescription,
            type: 'personal'
        };

        const updatedEvents = [...events, newEvent];
        await savePersonalEvents(updatedEvents); // Save only personal
        loadEvents(); // Reload all
        setModalVisible(false);

    } else {
        // Date Request
        if (!selectedMatchId) {
            Alert.alert('Error', 'Please select a match for the date');
            return;
        }
        if (!currentUserId) {
            Alert.alert('Error', 'You must be logged in');
            return;
        }

        try {
            await DateService.requestDate({
                sender_id: currentUserId,
                receiver_id: selectedMatchId,
                date: selectedDate,
                time: newEventTime,
                location: newEventLocation || 'TBD',
                description: newEventDescription
            });

            // Send automatic chat message
            const match = matches.find(m => m.user.id === selectedMatchId);
            if (match) {
                const msgText = `📅 I sent you a date request for ${selectedDate} at ${newEventTime}!`;
                await ApiService.sendMessage(match.id, currentUserId, msgText);
            }

            Alert.alert('Success', 'Date request sent!');
            loadEvents();
            setModalVisible(false);
        } catch (error) {
            Alert.alert('Error', 'Failed to send date request');
        }
    }
  }, [newEventTime, eventType, newEventTitle, selectedDate, newEventDescription, events, selectedMatchId, currentUserId, newEventLocation, matches, savePersonalEvents, loadEvents]);

  const handleDeleteEvent = useCallback(async (event: ScheduleEvent) => {
    if (event.type === 'personal') {
        const updatedEvents = events.filter(e => e.id !== event.id);
        await savePersonalEvents(updatedEvents);
        loadEvents();
    } else {
        // Cancel Date
        Alert.alert('Cancel Date', 'Are you sure you want to cancel this date?', [
            { text: 'No', style: 'cancel' },
            { 
                text: 'Yes', 
                style: 'destructive',
                onPress: async () => {
                    try {
                        await DateService.updateDateStatus(event.id, 'cancelled');
                        loadEvents();
                    } catch (error) {
                        Alert.alert('Error', 'Failed to cancel date');
                    }
                }
            }
        ]);
    }
  }, [events, savePersonalEvents, loadEvents]);

  const handleResponse = useCallback(async (event: ScheduleEvent, status: 'accepted' | 'rejected') => {
      try {
          await DateService.updateDateStatus(event.id, status);
          loadEvents();
      } catch (error) {
          Alert.alert('Error', `Failed to ${status} date`);
      }
  }, [loadEvents]);

  useEffect(() => {
      if (modalVisible && eventType === 'date') {
          (async () => {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') return;

              const location = await Location.getCurrentPositionAsync({});
              setMapRegion({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
              });
          })();
      }
  }, [modalVisible, eventType]);

  const handleLocationTextChange = useCallback((text: string) => {
      setNewEventLocation(text);
      isTypingLocation.current = true;
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      
      typingTimeout.current = setTimeout(async () => {
          isTypingLocation.current = false;
          try {
              const result = await Location.geocodeAsync(text);
              if (result.length > 0) {
                  setMapRegion({
                      latitude: result[0].latitude,
                      longitude: result[0].longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                  });
              }
          } catch (e) {}
      }, 1000);
  }, []);

  const handleRegionChangeComplete = useCallback((region: Region) => {
      if (!isTypingLocation.current) {
          setMapRegion(region);
      }
  }, []);

  const getMarkedDates = React.useMemo(() => {
    const marked: any = {};
    events.forEach(event => {
      let color = '#E94057'; // Default personal
      if (event.type === 'date') {
          if (event.status === 'pending') color = '#FFA500';
          else if (event.status === 'accepted') color = '#4CAF50';
          else if (event.status === 'cancelled' || event.status === 'rejected') color = '#999';
      }
      
      marked[event.date] = { marked: true, dotColor: color };
    });
    
    if (selectedDate) {
      marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: '#E94057' };
    }
    return marked;
  }, [events, selectedDate]);

  const selectedDateEvents = events.filter(event => event.date === selectedDate);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={{width: 24}} /> 
      </View>

      <Calendar
        onDayPress={handleDayPress}
        markedDates={getMarkedDates}
        theme={{
          selectedDayBackgroundColor: '#E94057',
          todayTextColor: '#E94057',
          arrowColor: '#E94057',
        }}
      />

      <View style={styles.eventsContainer}>
        <Text style={styles.sectionTitle}>
          {selectedDate ? `Events for ${selectedDate}` : 'Select a date'}
        </Text>
        
        <FlatList
          data={selectedDateEvents}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={[styles.eventItem, item.type === 'date' && styles.dateEventItem]}>
              <View style={styles.eventInfo}>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
                    {item.type === 'date' && (
                        <Text style={{fontSize: 12, marginRight: 5}}>
                             {item.status === 'accepted' ? '✅' : item.status === 'pending' ? '⏳' : '❌'}
                        </Text>
                    )}
                    <Text style={styles.eventTime}>{item.time}</Text>
                </View>
                
                <Text style={styles.eventTitle}>{item.title}</Text>
                
                {item.description ? <Text numberOfLines={2} style={styles.eventDesc}>{item.description}</Text> : null}
                
                {/* Actions for Date Requests */}
                {item.type === 'date' && item.status === 'pending' && !item.isSender && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity onPress={() => handleResponse(item, 'accepted')} style={[styles.miniButton, {backgroundColor: '#4CAF50'}]}>
                            <Text style={styles.miniButtonText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleResponse(item, 'rejected')} style={[styles.miniButton, {backgroundColor: '#F44336'}]}>
                            <Text style={styles.miniButtonText}>Decline</Text>
                        </TouchableOpacity>
                    </View>
                )}
              </View>
              
              <TouchableOpacity onPress={() => handleDeleteEvent(item)} style={{padding: 5}}>
                <Ionicons name="trash-outline" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            selectedDate ? <Text style={styles.emptyText}>No events for this day</Text> : null
          }
        />
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Event</Text>
            
            {/* Type Selector */}
            <View style={styles.typeSelector}>
                <TouchableOpacity 
                    style={[styles.typeButton, eventType === 'personal' && styles.typeButtonActive]}
                    onPress={() => setEventType('personal')}
                >
                    <Text style={[styles.typeButtonText, eventType === 'personal' && styles.typeButtonTextActive]}>Personal</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.typeButton, eventType === 'date' && styles.typeButtonActive]}
                    onPress={() => setEventType('date')}
                >
                    <Text style={[styles.typeButtonText, eventType === 'date' && styles.typeButtonTextActive]}>Date Request</Text>
                </TouchableOpacity>
            </View>
            
            {eventType === 'personal' ? (
                <TextInput
                    style={styles.input}
                    placeholder="Event Title"
                    value={newEventTitle}
                    onChangeText={setNewEventTitle}
                />
            ) : (
                <View style={{maxHeight: 150, marginBottom: 15}}>
                    <Text style={styles.label}>Select Match:</Text>
                    {matches.length === 0 ? (
                        <Text style={{fontStyle:'italic', color:'#999'}}>No active matches found.</Text>
                    ) : (
                        <FlatList 
                            data={matches}
                            keyExtractor={item => item.id}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            renderItem={({item}) => (
                                <TouchableOpacity 
                                    style={[styles.matchItem, selectedMatchId === item.user.id && styles.matchItemActive]}
                                    onPress={() => setSelectedMatchId(item.user.id)}
                                >
                                    <Image source={{uri: item.user.image}} style={styles.matchAvatar} />
                                    <Text style={styles.matchName} numberOfLines={1}>{item.user.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            )}
            
            <TextInput
              style={styles.input}
              placeholder="Time (e.g. 7:00 PM)"
              value={newEventTime}
              onChangeText={setNewEventTime}
            />

            {eventType === 'date' && (
                <View style={{marginBottom: 15}}>
                    <TextInput
                        style={[styles.input, {marginBottom: 5}]}
                        placeholder="Location"
                        value={newEventLocation}
                        onChangeText={handleLocationTextChange}
                    />
                    {mapRegion && (
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                region={mapRegion}
                                onRegionChangeComplete={handleRegionChangeComplete}
                                showsUserLocation={true}
                            >
                                <View style={styles.fixedMarker}>
                                    <Ionicons name="location" size={30} color="#E94057" />
                                </View>
                            </MapView>
                            {/* Overlay Marker for Visual Center */}
                            <View style={styles.centerMarkerContainer} pointerEvents="none">
                                <Ionicons name="location" size={30} color="#E94057" />
                            </View>
                        </View>
                    )}
                </View>
            )}

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description / Details"
              value={newEventDescription}
              onChangeText={setNewEventDescription}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]} 
                onPress={handleSaveEvent}
              >
                <Text style={[styles.buttonText, styles.saveButtonText]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333'
  },
  backButton: {
      padding: 5
  },
  eventsContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#E94057',
  },
  dateEventItem: {
      borderLeftColor: '#8E2DE2', // Purple for dates
      backgroundColor: '#fdfbff',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  eventTime: {
    fontSize: 14,
    color: '#E94057',
    fontWeight: '600',
  },
  eventInfo: {
    flex: 1,
  },
  eventDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#E94057',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#E94057',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButtonText: {
    color: 'white',
  },
  typeSelector: {
      flexDirection: 'row',
      marginBottom: 20,
      backgroundColor: '#f0f0f0',
      borderRadius: 10,
      padding: 5,
  },
  typeButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
  },
  typeButtonActive: {
      backgroundColor: 'white',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
  },
  typeButtonText: {
      color: '#666',
      fontWeight: '600',
  },
  typeButtonTextActive: {
      color: '#E94057',
  },
  label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 10,
      color: '#333',
  },
  matchItem: {
      alignItems: 'center',
      marginRight: 15,
      opacity: 0.6,
      width: 70,
  },
  matchItemActive: {
      opacity: 1,
  },
  matchAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      marginBottom: 5,
      borderWidth: 2,
      borderColor: 'transparent',
  },
  matchName: {
      fontSize: 12,
      color: '#333',
      textAlign: 'center',
  },
  actionButtons: {
      flexDirection: 'row',
      marginTop: 10,
  },
  miniButton: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 5,
      marginRight: 10,
  },
  miniButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
  },
  mapContainer: {
      height: 200,
      width: '100%',
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: '#ddd',
      position: 'relative',
  },
  map: {
      width: '100%',
      height: '100%',
  },
  fixedMarker: {
      // This is not needed if we use the overlay approach
      opacity: 0, 
  },
  centerMarkerContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: -15, // Offset for pin point
  }
});
