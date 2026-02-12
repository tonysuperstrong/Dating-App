import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { polishMessage, generateIcebreaker } from '../services/AIService';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';
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

const MessageBubble = React.memo(({ item }: { item: Message }) => (
  <View style={[
    styles.messageBubble, 
    item.sender === 'me' ? styles.myMessage : styles.theirMessage
  ]}>
    <Text style={[
        styles.messageText,
        item.sender === 'me' ? styles.myMessageText : styles.theirMessageText
    ]}>{item.text}</Text>
  </View>
));

export default function ChatDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ChatDetailRouteProp>();
  const { userId, matchId, name, image } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isPolishing, setIsPolishing] = useState(false);
  const [isGeneratingIcebreaker, setIsGeneratingIcebreaker] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserHobbies, setCurrentUserHobbies] = useState<string | string[]>([]);
  const [matchUser, setMatchUser] = useState<any>(null);
  const [reportMenuVisible, setReportMenuVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Load current user ID and Match User
  useEffect(() => {
    const loadData = async () => {
        try {
            const profileString = await AsyncStorage.getItem('userProfile');
            if (profileString) {
                const profile = JSON.parse(profileString);
                setCurrentUserId(profile.id);
                setCurrentUserHobbies(profile.hobbies || []);
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

  const mapMessage = React.useCallback((m: any, myId: string): Message => ({
      id: m.id.toString(),
      text: m.text,
      sender: m.sender_id === myId ? 'me' : 'them',
      timestamp: m.timestamp
  }), []);

  // Fetch initial messages
  const loadInitialMessages = React.useCallback(async () => {
    if (!matchId || !currentUserId) return;
    
    try {
        // Fetch page 1
        const data = await ApiService.getMessages(matchId, 1, 20);
        
        // Data is [Oldest ... Newest]
        // For inverted list, we want [Newest ... Oldest]
        const mapped: Message[] = data.map((m: any) => mapMessage(m, currentUserId)).reverse();
        
        setMessages(mapped);
        setPage(2);
        setHasMore(data.length === 20);
    } catch (error) {
        // console.error('Error fetching messages:', error);
    }
  }, [matchId, currentUserId, mapMessage]);

  const loadMoreMessages = React.useCallback(async () => {
      if (loadingMore || !hasMore || !matchId || !currentUserId) return;
      
      setLoadingMore(true);
      try {
          const data = await ApiService.getMessages(matchId, page, 20);
          
          if (data.length > 0) {
              // Data is [Oldest ... Newest] of the older page
              // Reverse to [Newest ... Oldest] and append to end of list (which is top of chat history)
              const mapped: Message[] = data.map((m: any) => mapMessage(m, currentUserId)).reverse();
              setMessages(prev => {
                  const existingIds = new Set(prev.map(p => p.id));
                  const newUniqueMessages = mapped.filter(m => !existingIds.has(m.id));
                  return [...prev, ...newUniqueMessages];
              });
              setPage(prev => prev + 1);
          }
          
          if (data.length < 20) {
              setHasMore(false);
          }
      } catch (error) {
          // console.error('Error loading more messages:', error);
      } finally {
          setLoadingMore(false);
      }
  }, [loadingMore, hasMore, matchId, currentUserId, page, mapMessage]);

  // Initial fetch and Socket.io setup
  useEffect(() => {
      if (currentUserId && matchId) {
          loadInitialMessages();
          
          // Connect Socket
          socketRef.current = io(API_BASE_URL);
          socketRef.current.emit('join_room', matchId);

          // Listen for new messages
          socketRef.current.on('receive_message', (message: any) => {
              setMessages(prev => {
                  // Avoid duplicates
                  if (prev.some(m => m.id === message.id.toString())) return prev;

                  const newMessage = mapMessage(message, currentUserId);
                  // Prepend for inverted list
                  return [newMessage, ...prev];
              });
          });

          return () => {
              socketRef.current?.disconnect();
          };
      }
  }, [matchId, currentUserId, loadInitialMessages, mapMessage]);

  const [polishedText, setPolishedText] = useState<string | null>(null);

  const [polishStyle, setPolishStyle] = useState<'funny' | 'charming'>('funny');

  const handleSend = React.useCallback(async () => {
    const textToSend = polishedText || inputText;
    
    if (!textToSend.trim() || !currentUserId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setInputText(''); 
    setPolishedText(null); // Clear polished state

    try {
        await ApiService.sendMessage(matchId, currentUserId, textToSend);
        // Message will be received via socket
    } catch (error) {
        // console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message');
        setInputText(textToSend); 
    }
  }, [polishedText, inputText, currentUserId, matchId]);

  const handlePolish = React.useCallback(async (style: 'funny' | 'charming') => {
    if (!inputText.trim()) return;
    
    setPolishStyle(style);
    setIsPolishing(true);
    
    const textToPolish = inputText; 
    const polished = await polishMessage(textToPolish, style);
    setIsPolishing(false);

    if (polished) {
        setPolishedText(polished);
    }
  }, [inputText]);

  const handleAcceptPolish = React.useCallback(() => {
    if (polishedText) {
        setInputText(polishedText);
        setPolishedText(null);
    }
  }, [polishedText]);

  const handleRejectPolish = React.useCallback(() => {
    setPolishedText(null);
  }, []);
  
  const handleRefreshPolish = React.useCallback(() => {
      handlePolish(polishStyle);
  }, [handlePolish, polishStyle]);

  const handleIcebreaker = React.useCallback(async () => {
    setIsGeneratingIcebreaker(true);
    const icebreaker = await generateIcebreaker(
        name,
        matchUser?.hobbies || [],
        currentUserHobbies
    );
    setIsGeneratingIcebreaker(false);
    
    if (icebreaker) {
        setInputText(icebreaker);
    }
  }, [name, matchUser, currentUserHobbies]);

  const handleCall = React.useCallback(async () => {
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
                { text: 'Go to Profile', onPress: () => navigation.navigate('ProfileSetup', { isEditing: true }) }
              ]
                  );
                  return;
              }
          }
      } catch (error) {
          // console.error('Error checking profile:', error);
          return;
      }

      // 2. Check if they have a phone number
      if (matchUser && matchUser.phone_number) {
          Linking.openURL(`tel:${matchUser.phone_number}`);
      } else {
          Alert.alert('No Phone Number', `${name} hasn't added a phone number yet.`);
      }
  }, [matchUser, name, navigation]);

  const handleReportUser = () => {
    Alert.alert('Report User', 'Are you sure you want to report this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: async () => {
        if (currentUserId && userId) {
            await ApiService.reportUser(currentUserId, userId, 'User reported via chat');
            Alert.alert('Reported', 'User has been reported.');
        }
        setReportMenuVisible(false);
      } }
    ]);
  };

  const handleBlockUser = () => {
    Alert.alert('Block User', 'Are you sure you want to block this user?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        if (currentUserId && userId) {
            await ApiService.blockUser(currentUserId, userId);
            Alert.alert('Blocked', 'User has been blocked.');
            navigation.goBack();
        }
        setReportMenuVisible(false);
      } }
    ]);
  };

  // Removed scrollToEnd effect because we are using inverted list
  
  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble item={item} />
  ), []);

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
        onPress={() => navigation.navigate('Profile', { userId: userId })}
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
        
        <View style={{flexDirection: 'row'}}>
            <TouchableOpacity onPress={handleCall} style={styles.headerButton}>
                <Ionicons name="call" size={24} color="#E94057" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReportMenuVisible(!reportMenuVisible)} style={styles.headerButton}>
                <Ionicons name="ellipsis-vertical" size={24} color="#E94057" />
            </TouchableOpacity>
        </View>
      </View>

      {/* Report Menu */}
      {reportMenuVisible && (
        <View style={styles.reportMenu}>
          <TouchableOpacity style={styles.reportMenuItem} onPress={handleReportUser}>
            <Text style={styles.reportMenuItemText}>Report User</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.reportMenuItem} onPress={handleBlockUser}>
            <Text style={styles.reportMenuItemText}>Block User</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList} 
        inverted
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.2}
        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#E94057" /> : null}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { transform: [{ scaleY: -1 }] }]}> 
              <Text style={styles.emptyText}>No messages yet. Say hi! 👋</Text>
          </View>
        }
      />

      {/* Polished Message Preview */}
      {polishedText && (
        <View style={styles.polishPreviewContainer}>
            <Text style={styles.polishLabel}>✨ AI Suggestion:</Text>
            <Text style={styles.polishText}>{polishedText}</Text>
            <View style={styles.polishActions}>
                <TouchableOpacity onPress={handleRejectPolish} style={[styles.polishActionBtn, styles.polishRejectBtn]}>
                    <Ionicons name="close" size={20} color="#FF4444" />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={handleRefreshPolish} 
                    style={[styles.polishActionBtn, styles.polishRefreshBtn]}
                    disabled={isPolishing}
                >
                    {isPolishing ? (
                        <ActivityIndicator size="small" color="#8A2BE2" />
                    ) : (
                        <Ionicons name="refresh" size={20} color="#8A2BE2" />
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAcceptPolish} style={[styles.polishActionBtn, styles.polishAcceptBtn]}>
                    <Ionicons name="checkmark" size={20} color="#4CAF50" />
                </TouchableOpacity>
            </View>
        </View>
      )}

      {/* Input Area */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          {/* Action Buttons Row */}
          {!polishedText && (
            <View style={{flexDirection: 'row', marginBottom: 5}}>
                 {/* Standard Polish Button */}
                 <TouchableOpacity 
                    style={[styles.polishButton, { backgroundColor: '#4CAF50' }]} 
                    onPress={() => handlePolish('charming')}
                    disabled={isPolishing || !inputText.trim()}
                 >
                     {isPolishing && polishStyle === 'charming' ? (
                         <ActivityIndicator color="#fff" size="small" />
                     ) : (
                         <Text style={styles.polishButtonText}>✨ Polish</Text>
                     )}
                 </TouchableOpacity>

                 {/* Funny Button */}
                 <TouchableOpacity 
                    style={styles.polishButton} 
                    onPress={() => handlePolish('funny')}
                    disabled={isPolishing || !inputText.trim()}
                 >
                     {isPolishing && polishStyle === 'funny' ? (
                         <ActivityIndicator color="#fff" size="small" />
                     ) : (
                         <Text style={styles.polishButtonText}>🤪 Funny</Text>
                     )}
                 </TouchableOpacity>

                 {/* Icebreaker Button */}
                 <TouchableOpacity 
                    style={[styles.polishButton, { backgroundColor: '#E94057' }]} 
                    onPress={handleIcebreaker}
                    disabled={isGeneratingIcebreaker}
                 >
                     {isGeneratingIcebreaker ? (
                         <ActivityIndicator color="#fff" size="small" />
                     ) : (
                         <Text style={styles.polishButtonText}>❄️ Icebreaker</Text>
                     )}
                 </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.iconButton} onPress={handleCall}>
              <Ionicons name="call-outline" size={24} color="#E94057" />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
            />

            <TouchableOpacity 
                style={styles.sendButton} 
                onPress={handleSend}
                disabled={!inputText.trim() && !polishedText}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={(!inputText.trim() && !polishedText) ? "#ccc" : "#E94057"} 
              />
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
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'android' ? 30 : 0,
  },
  backButton: {
    marginRight: 15,
  },
  headerProfile: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
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
  iconButton: {
    padding: 10,
    marginRight: 5,
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
  polishPreviewContainer: {
      backgroundColor: '#F3E5F5',
      padding: 15,
      margin: 10,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#E1BEE7',
  },
  polishLabel: {
      color: '#8A2BE2',
      fontWeight: 'bold',
      marginBottom: 5,
  },
  polishText: {
      color: '#333',
      fontSize: 16,
      marginBottom: 10,
      fontStyle: 'italic',
  },
  polishActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
  },
  polishActionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
      backgroundColor: '#fff',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
  },
  polishRejectBtn: {
      borderWidth: 1,
      borderColor: '#FFCDD2',
  },
  polishRefreshBtn: {
      borderWidth: 1,
      borderColor: '#E1BEE7',
  },
  polishAcceptBtn: {
      backgroundColor: '#E8F5E9',
      borderWidth: 1,
      borderColor: '#C8E6C9',
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
  },
  reportMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1000,
    minWidth: 150,
  },
  reportMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reportMenuItemText: {
    fontSize: 16,
    color: '#333',
  },
});
