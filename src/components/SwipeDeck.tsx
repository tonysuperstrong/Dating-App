import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.6;

interface SwipeDeckProps {
  currentUserId: string;
}

interface User {
  id: string;
  name: string;
  age: number;
  image: string;
  bio: string;
  location: string;
  hobbies: string[];
}

export default function SwipeDeck({ currentUserId }: SwipeDeckProps) {
  const navigation = useNavigation();
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;
  const [noMoreUsers, setNoMoreUsers] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!currentUserId) {
        console.error('SwipeDeck: currentUserId is missing!');
        Alert.alert('Error', 'User ID missing. Please restart the app.');
    }
    loadInitialUsers();
  }, [currentUserId]);

  const loadInitialUsers = useCallback(async () => {
    try {
      setPage(1);
      setHasMore(true);
      setNoMoreUsers(false);
      const fetchedUsers = await ApiService.getUsers(currentUserId, 1, 10);
      const filteredUsers = fetchedUsers.filter((u: any) => u.id !== currentUserId);
      const seenNames = new Set<string>();
      const uniqueUsers = filteredUsers.filter((u: any) => {
        const key = (u.name || u.id || '').toString();
        if (!key) return true;
        if (seenNames.has(key)) return false;
        seenNames.add(key);
        return true;
      });
      setUsers(uniqueUsers);
      if (uniqueUsers.length === 0) setNoMoreUsers(true);
      if (fetchedUsers.length < 10) setHasMore(false);
      setPage(2);
    } catch (error) {
      // console.error('Error loading users for deck:', error);
    }
  }, [currentUserId]);

  const loadMoreUsers = useCallback(async () => {
      if (loadingMore || !hasMore) return;
      
      setLoadingMore(true);
      try {
          const fetchedUsers = await ApiService.getUsers(currentUserId, page, 10);
          
          if (fetchedUsers.length > 0) {
              const filteredUsers = fetchedUsers.filter((u: any) => u.id !== currentUserId);
              const seenNames = new Set<string>(
                users.map(u => (u.name || u.id || '').toString())
              );
              const deduped = filteredUsers.filter((u: any) => {
                const key = (u.name || u.id || '').toString();
                if (!key) return true;
                if (seenNames.has(key)) return false;
                seenNames.add(key);
                return true;
              });
              
              if (deduped.length > 0) {
                  setUsers(prev => [...prev, ...deduped]);
                  setPage(prev => prev + 1);
              }
          }
          
          if (fetchedUsers.length < 10) {
              setHasMore(false);
          }
      } catch (error) {
          // console.error('Error loading more users:', error);
      } finally {
          setLoadingMore(false);
      }
  }, [currentUserId, loadingMore, hasMore, page, users]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 120) {
          forceSwipe('right');
        } else if (gesture.dx < -120) {
          forceSwipe('left');
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const forceSwipe = (direction: 'right' | 'left') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const x = direction === 'right' ? width + 100 : -width - 100;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => onSwipeComplete(direction));
  };

  const onSwipeComplete = async (direction: 'right' | 'left') => {
    const item = users[currentIndex];
    
    // Safety check: if no item, stop
    if (!item) return;

    const nextIndex = currentIndex + 1;

    // Preload more users if we are running low (e.g., 3 cards left)
    if (users.length - nextIndex < 3 && hasMore && !loadingMore) {
        loadMoreUsers();
    }

    if (direction === 'right') {
      await handleLike(item);
    }

    position.setValue({ x: 0, y: 0 });
    setCurrentIndex(nextIndex);
    
    if (nextIndex >= users.length && !loadingMore && !hasMore) {
      setNoMoreUsers(true);
    }
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 4,
      useNativeDriver: false,
    }).start();
  };

  const handleLike = useCallback(async (user: User) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    if (!currentUserId) {
        Alert.alert('Error', 'Cannot like user: Your ID is missing.');
        return;
    }

    try {
      const response = await ApiService.likeUser(currentUserId, user.id);
      
      if (response) {
          if (response.status === 'active') {
            // It's a match!
            Alert.alert(
                'It\'s a Match! 🎉', 
                `You and ${user.name} like each other!`,
                [
                    { text: 'Keep Swiping', style: 'cancel' },
                    { 
                        text: 'Send a Message', 
                        onPress: () => {
                            (navigation as any).navigate('ChatDetail', {
                                userId: user.id,
                                matchId: response.id,
                                name: user.name,
                                image: user.image
                            });
                        }
                    }
                ]
            );
          } else if (response.status === 'pending') {
              // Request sent
              Alert.alert(
                  'Request Sent! 📨',
                  `You sent a match request to ${user.name}.`,
                  [{ text: 'OK', style: 'default' }]
              );
          }
      }
    } catch (error) {
      // console.error('Error liking user:', error);
    }
  }, [currentUserId, navigation]);

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-width * 1.5, 0, width * 1.5],
      outputRange: ['-30deg', '0deg', '30deg'],
    });

    return {
      ...position.getLayout(),
      transform: [{ rotate }],
    };
  };

  const renderCard = useCallback((user: User, isFront: boolean) => {
    const isColor = user.image && user.image.startsWith('#');
    const hasImage = !!user.image && !isColor;
    
    return (
      <View style={styles.card}>
        {isColor ? (
            <View style={[styles.cardImage, { backgroundColor: user.image, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{fontSize: 80}}>{user.name[0]}</Text>
            </View>
        ) : hasImage ? (
            <Image source={{ uri: user.image }} style={styles.cardImage} resizeMode="cover" />
        ) : (
            <View style={[styles.cardImage, { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{fontSize: 80}}>{user.name[0]}</Text>
            </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{user.name}, {user.age}</Text>
          <Text style={styles.cardLocation}>📍 {user.location || 'Unknown Location'}</Text>
          <Text style={styles.cardBio} numberOfLines={3}>{user.bio}</Text>
          {user.hobbies && user.hobbies.length > 0 && (
            <View style={styles.hobbiesContainer}>
              {user.hobbies.slice(0, 3).map((hobby, index) => (
                <View key={index} style={styles.hobbyTag}>
                  <Text style={styles.hobbyText}>{hobby}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        
        {/* Overlay Labels */}
        {isFront && (
            <>
                <Animated.View style={[styles.likeLabel, { 
                    opacity: position.x.interpolate({
                        inputRange: [0, 100],
                        outputRange: [0, 1],
                        extrapolate: 'clamp'
                    }) 
                }]}>
                    <Text style={styles.labelText}>LIKE</Text>
                </Animated.View>
                <Animated.View style={[styles.nopeLabel, { 
                    opacity: position.x.interpolate({
                        inputRange: [-100, 0],
                        outputRange: [1, 0],
                        extrapolate: 'clamp'
                    }) 
                }]}>
                    <Text style={[styles.labelText, { color: 'red', borderColor: 'red' }]}>NOPE</Text>
                </Animated.View>
            </>
        )}
      </View>
    );
  }, [position]);

  if (noMoreUsers) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.noMoreText}>No more profiles to show.</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => {
            setCurrentIndex(0);
            loadInitialUsers();
        }}>
            <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {users.slice(currentIndex, currentIndex + 2).reverse().map((user, index, array) => {
        const isFront = index === array.length - 1;
        const panHandlers = isFront ? panResponder.panHandlers : {};
        const cardStyle = isFront ? getCardStyle() : undefined;

        return (
          <Animated.View
            key={user.id}
            style={[styles.cardWrapper, isFront && cardStyle]}
            {...panHandlers}
          >
            {renderCard(user, isFront)}
          </Animated.View>
        );
      })}
      
      <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[styles.roundButton, styles.passButton, (!users.length) && styles.disabledButton]} 
            onPress={() => users.length > 0 && forceSwipe('left')}
            disabled={!users.length}
          >
              <Ionicons name="close" size={30} color={users.length ? "#F27121" : "#ccc"} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roundButton, styles.likeButton, (!users.length) && styles.disabledButton]} 
            onPress={() => users.length > 0 && forceSwipe('right')}
            disabled={!users.length}
          >
              <Ionicons name="heart" size={30} color={users.length ? "#00C853" : "#ccc"} />
          </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.36,
    shadowRadius: 6.68,
    elevation: 11,
    backgroundColor: 'white',
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  cardImage: {
    width: '100%',
    height: '70%',
  },
  cardInfo: {
    padding: 20,
    flex: 1,
  },
  cardName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  cardLocation: {
    fontSize: 14,
    color: '#777',
    marginBottom: 10,
  },
  cardBio: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  hobbiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  hobbyTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  hobbyText: {
    fontSize: 12,
    color: '#555',
  },
  buttonsContainer: {
      position: 'absolute',
      bottom: -80,
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      width: '100%',
  },
  roundButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'white',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
  },
  passButton: {
      borderWidth: 1,
      borderColor: '#F27121',
  },
  likeButton: {
      borderWidth: 1,
      borderColor: '#00C853',
  },
  disabledButton: {
      borderColor: '#ccc',
      backgroundColor: '#f5f5f5',
  },
  noMoreText: {
      fontSize: 18,
      color: '#666',
      marginBottom: 20,
  },
  refreshButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: '#E94057',
      borderRadius: 20,
  },
  refreshText: {
      color: 'white',
      fontWeight: 'bold',
  },
  likeLabel: {
      position: 'absolute',
      top: 50,
      left: 40,
      transform: [{ rotate: '-30deg' }],
      borderWidth: 3,
      borderColor: '#00C853',
      padding: 5,
      borderRadius: 5,
  },
  nopeLabel: {
      position: 'absolute',
      top: 50,
      right: 40,
      transform: [{ rotate: '30deg' }],
      borderWidth: 3,
      borderColor: 'red',
      padding: 5,
      borderRadius: 5,
  },
  labelText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#00C853',
      letterSpacing: 2,
  },
});
