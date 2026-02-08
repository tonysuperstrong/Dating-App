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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { polishMessage } from '../services/AIService';

type RootStackParamList = {
  ChatDetail: { userId: string; name: string; image: string };
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
  const { userId, name, image } = route.params;

  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: 'Hey! How are you?', sender: 'them', timestamp: Date.now() - 100000 },
  ]);
  const [inputText, setInputText] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'me',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // Simulate reply
    setTimeout(() => {
        const reply: Message = {
            id: (Date.now() + 1).toString(),
            text: "That sounds great! Tell me more.",
            sender: 'them',
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, reply]);
    }, 2000);
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

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#E94057" />
        </TouchableOpacity>
        
        <View style={styles.headerProfile}>
            <View style={[styles.avatar, { backgroundColor: image }]}>
                <Text style={styles.avatarText}>{name[0]}</Text>
            </View>
            <Text style={styles.headerName}>{name}</Text>
        </View>
        
        <View style={{ width: 40 }} /> 
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
  messagesList: {
    padding: 20,
    paddingBottom: 20,
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
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
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
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  polishButton: {
      alignSelf: 'flex-start',
      backgroundColor: '#8A2BE2', // Purple for AI
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
  },
  polishButtonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
  },
  inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    padding: 10,
  },
});
