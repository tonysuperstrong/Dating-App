import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import ChatService, { ChatSession } from '../services/ChatService';

type RootStackParamList = {
  ChatDetail: { userId: string; name: string; image: string };
};

type ChatScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ChatScreen() {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadChats = async () => {
    const data = await ChatService.getChats();
    setChats(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const onRefresh = async () => {
      setRefreshing(true);
      await loadChats();
      setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Matches</Text>
      {chats.length === 0 ? (
          <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No matches yet. Go swipe! 💖</Text>
          </View>
      ) : (
          <FlatList
            data={chats}
            keyExtractor={item => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[styles.matchItem, item.status === 'pending' && styles.pendingItem]}
                onPress={() => navigation.navigate('ChatDetail', { 
                    userId: item.user.id, 
                    name: item.user.name, 
                    image: item.user.image 
                })}
              >
                <View style={[styles.avatar, { backgroundColor: item.user.image }]}>
                    <Text style={styles.initial}>{item.user.name[0]}</Text>
                </View>
                <View style={styles.content}>
                    <View style={styles.nameRow}>
                        <Text style={styles.name}>{item.user.name}</Text>
                        {item.status === 'pending' && <Text style={styles.pendingTag}>Pending</Text>}
                    </View>
                    <Text style={[styles.message, item.status === 'pending' && styles.pendingMessage]} numberOfLines={1}>
                        {item.lastMessage}
                    </Text>
                </View>
              </TouchableOpacity>
            )}
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
  initial: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 20,
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
