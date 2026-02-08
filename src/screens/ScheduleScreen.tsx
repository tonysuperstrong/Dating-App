import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, FlatList, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

interface ScheduleEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  description?: string;
}

export default function ScheduleScreen() {
  const [selectedDate, setSelectedDate] = useState('');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const storedEvents = await AsyncStorage.getItem('scheduleEvents');
      if (storedEvents) {
        setEvents(JSON.parse(storedEvents));
      }
    } catch (error) {
      console.error('Failed to load events', error);
    }
  };

  const saveEvents = async (newEvents: ScheduleEvent[]) => {
    try {
      await AsyncStorage.setItem('scheduleEvents', JSON.stringify(newEvents));
      setEvents(newEvents);
    } catch (error) {
      console.error('Failed to save events', error);
    }
  };

  const handleDayPress = (day: any) => {
    setSelectedDate(day.dateString);
    setEditingEventId(null);
    setNewEventTitle('');
    setNewEventTime('');
    setNewEventDescription('');
    setModalVisible(true);
  };

  const handleEditEvent = (event: ScheduleEvent) => {
    setEditingEventId(event.id);
    setNewEventTitle(event.title);
    setNewEventTime(event.time);
    setNewEventDescription(event.description || '');
    setModalVisible(true);
  };

  const handleSaveEvent = () => {
    if (!newEventTitle || !newEventTime) {
      Alert.alert('Error', 'Please enter both title and time');
      return;
    }

    let updatedEvents;
    if (editingEventId) {
        // Update existing
        updatedEvents = events.map(e => 
            e.id === editingEventId 
            ? { ...e, title: newEventTitle, time: newEventTime, description: newEventDescription }
            : e
        );
    } else {
        // Create new
        const newEvent: ScheduleEvent = {
          id: Date.now().toString(),
          date: selectedDate,
          title: newEventTitle,
          time: newEventTime,
          description: newEventDescription,
        };
        updatedEvents = [...events, newEvent];
    }

    saveEvents(updatedEvents);
    setModalVisible(false);
    setEditingEventId(null);
    setNewEventTitle('');
    setNewEventTime('');
    setNewEventDescription('');
  };

  const handleDeleteEvent = (id: string) => {
    const updatedEvents = events.filter(event => event.id !== id);
    saveEvents(updatedEvents);
  };

  const getMarkedDates = () => {
    const marked: any = {};
    events.forEach(event => {
      marked[event.date] = { marked: true, dotColor: '#E94057' };
    });
    if (selectedDate) {
      marked[selectedDate] = { ...marked[selectedDate], selected: true, selectedColor: '#E94057' };
    }
    return marked;
  };

  const selectedDateEvents = events.filter(event => event.date === selectedDate);

  return (
    <View style={styles.container}>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={getMarkedDates()}
        theme={{
          selectedDayBackgroundColor: '#E94057',
          todayTextColor: '#E94057',
          arrowColor: '#E94057',
        }}
      />

      <View style={styles.eventsContainer}>
        <Text style={styles.sectionTitle}>
          {selectedDate ? `Events for ${selectedDate}` : 'Select a date to view events'}
        </Text>
        
        <FlatList
          data={selectedDateEvents}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.eventItem}>
              <TouchableOpacity style={styles.eventInfo} onPress={() => handleEditEvent(item)}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventTime}>{item.time}</Text>
                {item.description ? <Text numberOfLines={3} style={styles.eventDesc}>{item.description}</Text> : null}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteEvent(item.id)}>
                <Text style={styles.deleteText}>✕</Text>
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
            <Text style={styles.modalTitle}>{editingEventId ? 'Edit Event' : `Add Event for ${selectedDate}`}</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Event Title (e.g. Date with Sarah)"
              value={newEventTitle}
              onChangeText={setNewEventTitle}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Time (e.g. 7:00 PM)"
              value={newEventTime}
              onChangeText={setNewEventTime}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (Optional)"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  eventTime: {
    fontSize: 14,
    color: '#E94057',
    marginTop: 2,
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
    height: 150,
    textAlignVertical: 'top',
  },
  deleteText: {
    fontSize: 18,
    color: '#999',
    padding: 5,
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
});
