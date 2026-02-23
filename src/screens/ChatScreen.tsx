import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatService, { ChatSession } from '../services/ChatService';
import ApiService from '../services/ApiService';
import { Ionicons } from '@expo/vector-icons';

type RootStackParamList = {
  ChatDetail: { userId: string; matchId: string; name: string; image: string };
};

type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ChatScreen() {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
        headerRight: () => (
            <TouchableOpacity onPress={loadChats} style={{ marginRight: 15 }}>
                <Ionicons name="refresh" size={24} color="#000" />
            </TouchableOpacity>
        )
    });
  }, [navigation, currentUserId]);

  const loadChats = useCallback(async () => {
    try {
        const profileString = await AsyncStorage.getItem('userProfile');
        let myId = currentUserId;
        if (profileString) {
            const profile = JSON.parse(profileString);
            myId = profile.id;
            setCurrentUserId(myId);
        }

        if (!myId) {
            setChats([]);
            return;
        }

        const data = await ChatService.getChats(myId);
        setChats(data);
    } catch (error) {
        console.error('Error loading chats:', error);
    }
  }, [currentUserId]);

  useEffect(() => {
    // Initial load
    loadChats();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  const onRefresh = useCallback(async () => {
      setRefreshing(true);
      await loadChats();
      setRefreshing(false);
  }, [loadChats]);

  const handleAccept = useCallback(async (matchId: string) => {
    if (processingReqId) return;
    setProcessingReqId(matchId);
    try {
      const result = await ApiService.acceptMatch(matchId);
      if (result && result.success) {
          Alert.alert('Success', 'Request accepted! You can now chat.');
          loadChats();
      } else {
          Alert.alert('Error', 'Failed to accept request.');
      }
    } catch (error) {
       Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
       setProcessingReqId(null);
    }
  }, [processingReqId, loadChats]);

  const handleDecline = useCallback(async (matchId: string) => {
    if (processingReqId) return;
    setProcessingReqId(matchId);
    try {
      const result = await ApiService.declineMatch(matchId);
      if (result && result.success) {
          loadChats();
      } else {
          Alert.alert('Error', 'Failed to decline request.');
      }
    } catch (error) {
       Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
       setProcessingReqId(null);
    }
  }, [processingReqId, loadChats]);

  // Filter logic
  const incomingRequests = useMemo(() => chats.filter(c => c.status === 'pending' && String(c.initiatorId) !== String(currentUserId)), [chats, currentUserId]);
  const activeChats = useMemo(() => chats.filter(c => c.status === 'active' || (c.status === 'pending' && String(c.initiatorId) === String(currentUserId))), [chats, currentUserId]);

  const renderItem = useCallback(({ item }: { item: ChatSession }) => {
    const isColor = item.user.image && item.user.image.startsWith('#');
    const hasImage = !!item.user.image && !isColor;
    const isPendingOutgoing = item.status === 'pending' && String(item.initiatorId) === String(currentUserId);
    
    return (
      <TouchableOpacity 
        style={[styles.matchItem, isPendingOutgoing && styles.pendingItem]}
        onPress={() => {
            if (isPendingOutgoing) {
                Alert.alert('Request Sent', `You sent a request to ${item.user.name}. Wait for them to accept!`);
            } else {
                navigation.navigate('ChatDetail', { 
                    userId: item.user.id, 
                    matchId: item.id,
                    name: item.user.name, 
                    image: item.user.image 
                });
            }
        }}
      >
        {isColor ? (
            <View style={[styles.avatar, { backgroundColor: item.user.image }]}>
                <Text style={styles.initial}>{item.user.name[0]}</Text>
            </View>
        ) : hasImage ? (
            <Image source={{ uri: item.user.image }} style={styles.avatar} />
        ) : (
            <View style={[styles.avatar, { backgroundColor: '#ddd' }]}>
                <Text style={styles.initial}>{item.user.name[0]}</Text>
            </View>
        )}
        <View style={styles.content}>
            <View style={styles.nameRow}>
                <Text style={styles.name}>{item.user.name}</Text>
                {isPendingOutgoing && <Text style={styles.pendingTag}>Pending</Text>}
            </View>
            <Text style={[styles.message, isPendingOutgoing && styles.pendingMessage]} numberOfLines={1}>
                {isPendingOutgoing ? 'Request sent...' : item.lastMessage}
            </Text>
        </View>
      </TouchableOpacity>
    );
  }, [currentUserId, navigation]);

  const renderRequestItem = useCallback(({ item }: { item: ChatSession }) => {
    const isColor = item.user.image && item.user.image.startsWith('#');
    const hasImage = !!item.user.image && !isColor;
    const isProcessing = processingReqId === item.id;

    return (
        <View style={styles.requestItem}>
             <View style={styles.requestInfo}>
                {isColor ? (
                    <View style={[styles.avatarSmall, { backgroundColor: item.user.image }]}>
                        <Text style={styles.initialSmall}>{item.user.name[0]}</Text>
                    </View>
                ) : hasImage ? (
                    <Image source={{ uri: item.user.image }} style={styles.avatarSmall} />
                ) : (
                    <View style={[styles.avatarSmall, { backgroundColor: '#ddd' }]}>
                        <Text style={styles.initialSmall}>{item.user.name[0]}</Text>
                    </View>
                )}
                <View>
                    <Text style={styles.requestName}>{item.user.name}</Text>
                    <Text style={styles.requestText}>Wants to match with you</Text>
                </View>
             </View>
             <View style={styles.requestActions}>
                 {isProcessing ? (
                     <ActivityIndicator size="small" color="#E94057" />
                 ) : (
                     <>
                        <TouchableOpacity style={styles.declineButton} onPress={() => handleDecline(item.id)}>
                            <Ionicons name="close" size={20} color="#666" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.acceptButton} onPress={() => handleAccept(item.id)}>
                            <Ionicons name="checkmark" size={20} color="#fff" />
                        </TouchableOpacity>
                     </>
                 )}
             </View>
        </View>
    );
  }, [processingReqId, handleDecline, handleAccept]);

  if (!currentUserId) {
    return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#E94057" />
        </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* DEBUG HEADER (Remove in production) */}
      {/* <View style={{padding: 5, backgroundColor: '#eee'}}>
         <Text style={{fontSize: 10}}>MyID: {currentUserId}</Text>
         <Text style={{fontSize: 10}}>Chats: {chats.length} (Active: {activeChats.length}, Req: {incomingRequests.length})</Text>
      </View> */}
      <Text style={styles.header}>Matches</Text>
      
      {/* Incoming Requests Section */}
      {incomingRequests.length > 0 && (
          <View style={styles.requestsSection}>
              <Text style={styles.sectionTitle}>Requests ({incomingRequests.length})</Text>
              <FlatList
                  data={incomingRequests}
                  keyExtractor={item => item.id}
                  renderItem={renderRequestItem}
                  scrollEnabled={false}
              />
          </View>
      )}

      {/* Active Chats Section */}
      {activeChats.length === 0 && incomingRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No matches yet. Go swipe! 💖</Text>
          </View>
      ) : (
          <FlatList
            data={activeChats}
            keyExtractor={item => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={renderItem}
            ListHeaderComponent={activeChats.length > 0 ? <Text style={styles.sectionTitle}>Conversations</Text> : null}
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#E94057',
  },
  sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 10,
      marginTop: 10,
  },
  requestsSection: {
      marginBottom: 20,
  },
  requestItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      backgroundColor: '#f9f9f9',
      borderRadius: 12,
      marginBottom: 10,
  },
  requestInfo: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  requestName: {
      fontWeight: 'bold',
      fontSize: 16,
      color: '#333',
  },
  requestText: {
      fontSize: 12,
      color: '#666',
  },
  requestActions: {
      flexDirection: 'row',
  },
  acceptButton: {
      backgroundColor: '#E94057',
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 10,
  },
  declineButton: {
      backgroundColor: '#e0e0e0',
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
  },
  emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  emptyText: {
      fontSize: 18,
      color: '#888',
  },
  matchItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  pendingItem: {
      opacity: 0.7,
      backgroundColor: '#fdfdfd',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 20,
  },
  initialSmall: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
  },
  content: {
    flex: 1,
  },
  nameRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 5,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  pendingTag: {
      fontSize: 10,
      color: '#E94057',
      fontWeight: 'bold',
      backgroundColor: '#FFF0F3',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
  },
  message: {
    color: '#666',
  },
  pendingMessage: {
      fontStyle: 'italic',
      color: '#999',
  },
});
