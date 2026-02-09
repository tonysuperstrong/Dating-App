import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform, 
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { polishMessage } from '../services/AIService';
import ApiService from '../services/ApiService';

type RootStackParamList = {
  ChatDetail: { userId: string; matchId: string; name: string; image: string };
};

type ChatDetailRouteProp = RouteProp<RootStackParamList, 'ChatDetail'>;

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: number;
}

export default function ChatDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<ChatDetailRouteProp>();
  const { userId, matchId, name, image } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matchUser, setMatchUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load current user ID and Match User
  useEffect(() => {
    const loadData = async () => {
        try {
            const profileString = await AsyncStorage.getItem('userProfile');
            if (profileString) {
                const profile = JSON.parse(profileString);
                setCurrentUserId(profile.id);
            }
            
            // Fetch match user details (for phone number)
            const user = await ApiService.getUserById(userId);
            if (user) {
                setMatchUser(user);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };
    loadData();
  }, [userId]);

  // Fetch messages
  const fetchMessages = async () => {
    if (!matchId || !currentUserId) return;
    
    try {
        const data = await ApiService.getMessages(matchId);
        // Map backend messages to UI model
        const mapped: Message[] = data.map((m: any) => ({
            id: m.id.toString(),
            text: m.text,
            sender: m.sender_id === currentUserId ? 'me' : 'them',
            timestamp: m.timestamp
        }));
        setMessages(mapped);
    } catch (error) {
        console.error('Error fetching messages:', error);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
      if (currentUserId) {
          fetchMessages();
          const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
          return () => clearInterval(interval);
      }
  }, [matchId, currentUserId]);

  const handleSend = async () => {
    if (!inputText.trim() || !currentUserId) return;

    const textToSend = inputText;
    setInputText(''); // Clear immediately for better UX

    try {
        await ApiService.sendMessage(matchId, currentUserId, textToSend);
        await fetchMessages(); // Refresh immediately
    } catch (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message');
        setInputText(textToSend); // Restore text on error
    }
  };

  const handlePolish = async () => {
    if (!inputText.trim()) return;
    
    setIsPolishing(true);
    const polished = await polishMessage(inputText);
    setIsPolishing(false);

    if (polished) {
        setInputText(polished);
    }
  };

  const handleCall = async () => {
      // 1. Check if I have a phone number
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
                          { text: 'Go to Profile', onPress: () => navigation.navigate('ProfileSetup' as never, { isEditing: true } as never) }
                      ]
                  );
                  return;
              }
          }
      } catch (error) {
          console.error('Error checking profile:', error);
          return;
      }

      // 2. Check if they have a phone number
      if (matchUser && matchUser.phone_number) {
          Linking.openURL(`tel:${matchUser.phone_number}`);
      } else {
          Alert.alert('No Phone Number', `${name} hasn't added a phone number yet.`);
      }
  };

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const isColor = image && image.startsWith('#');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#E94057" />
        </TouchableOpacity>
        
        <TouchableOpacity 
            style={styles.headerProfile}
            onPress={() => navigation.navigate('Profile' as never, { userId: userId } as never)}
        >
            {isColor ? (
                <View style={[styles.avatar, { backgroundColor: image }]}>
                    <Text style={styles.avatarText}>{name[0]}</Text>
                </View>
            ) : (
                <Image source={{ uri: image }} style={styles.avatar} />
            )}
            <Text style={styles.headerName}>{name}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={handleCall} style={styles.headerButton}>
            <Ionicons name="call" size={24} color="#E94057" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        renderItem={({ item }) => (
          <View style={[
            styles.messageBubble, 
            item.sender === 'me' ? styles.myMessage : styles.theirMessage
          ]}>
            <Text style={[
                styles.messageText,
                item.sender === 'me' ? styles.myMessageText : styles.theirMessageText
            ]}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No messages yet. Say hi! 👋</Text>
            </View>
        }
      />

      {/* Input Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={styles.inputContainer}>
            {inputText.length > 3 && (
              <TouchableOpacity 
                  style={styles.polishButton} 
                  onPress={handlePolish}
                  disabled={isPolishing}
              >
                  {isPolishing ? (
                      <ActivityIndicator size="small" color="#fff" />
                  ) : (
                      <Text style={styles.polishButtonText}>✨ AI Polish</Text>
                  )}
              </TouchableOpacity>
            )}
            
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    placeholder="Type a message..."
                    multiline
                />
                <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                    <Ionicons name="send" size={24} color="#E94057" />
                </TouchableOpacity>
            </View>
        </View>
      </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 5,
  },
  headerProfile: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
  },
  avatarText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 18,
  },
  headerName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
  },
  headerButton: {
    padding: 8,
  },
  messagesList: {
    padding: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E94057',
    borderBottomRightRadius: 5,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F3F3',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  inputContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F3F3',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    padding: 10,
  },
  polishButton: {
      backgroundColor: '#8A2BE2',
      padding: 8,
      borderRadius: 15,
      alignSelf: 'flex-start',
      marginBottom: 5,
      marginLeft: 5,
  },
  polishButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
  },
  emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 50,
  },
  emptyText: {
      color: '#999',
      fontSize: 16,
  }
});
