import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  Animated, 
  PanResponder, 
  Modal, 
  FlatList, 
  Alert
} from 'react-native';
import { USERS } from '../data/users';
import Card from './Card';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import ChatService, { ConnectionRequest } from '../services/ChatService';

const { width, height } = Dimensions.get('window');

// Mock Current User (should ideally come from Context/Storage)
const CURRENT_USER_HOBBIES = ['Coffee', 'Travel', 'Photography'];

// Mock Viewers Data
const MOCK_VIEWERS = [
  { id: 'v1', name: 'Sophia', age: 23, image: '#FFD700', time: '2m ago' },
  { id: 'v2', name: 'Olivia', age: 25, image: '#FF69B4', time: '1h ago' },
  { id: 'v3', name: 'Isabella', age: 22, image: '#87CEEB', time: '3h ago' },
  { id: 'v4', name: 'Mia', age: 24, image: '#98FB98', time: '5h ago' },
];

export default function DatePortalView() {
  const navigation = useNavigation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewersModalVisible, setViewersModalVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Animation values for Swipe Deck
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profileString = await AsyncStorage.getItem('userProfile');
      if (profileString) {
        setUserProfile(JSON.parse(profileString));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Filter Users
  const dateUsers = USERS.filter(u => u.type === 'date');
  
  // "For You" Recommendations (Hobby Match)
  const recommendedUsers = dateUsers.filter(user => 
    user.hobbies?.some(hobby => CURRENT_USER_HOBBIES.includes(hobby))
  );

  const swipeUsers = dateUsers;
  const currentUser = swipeUsers[currentIndex];
  const nextUser = swipeUsers[currentIndex + 1];

  // PanResponder Logic
  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const rotateAndTranslate = {
    transform: [
      { rotate: rotate },
      ...position.getTranslateTransform(),
    ],
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        position.setValue({ x: gestureState.dx, y: gestureState.dy });
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 120) {
          Animated.spring(position, {
            toValue: { x: width + 100, y: gestureState.dy },
            useNativeDriver: true,
          }).start(() => handleSwipeRight());
        } else if (gestureState.dx < -120) {
          Animated.spring(position, {
            toValue: { x: -width - 100, y: gestureState.dy },
            useNativeDriver: true,
          }).start(() => handleSwipeLeft());
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 4,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleNext = () => {
    setCurrentIndex(prev => prev + 1);
    position.setValue({ x: 0, y: 0 });
  };

  const handleSwipeLeft = () => {
    Animated.timing(position, {
      toValue: { x: -width * 1.5, y: 0 },
      duration: 500,
      useNativeDriver: true,
    }).start(() => handleNext());
  };

  const handleSwipeRight = async () => {
    if (currentUser) {
        // Add to chats as pending
        await ChatService.addChat(currentUser, 'pending');
        Alert.alert('Request Sent', `You liked ${currentUser.name}! Added to your chats.`);
    }

    Animated.timing(position, {
      toValue: { x: width * 1.5, y: 0 },
      duration: 500,
      useNativeDriver: true,
    }).start(() => handleNext());
  };

  return (
    <View style={styles.container}>
      {/* Top Portal Header */}
      <View style={styles.portalHeader}>
        <TouchableOpacity style={styles.profileSummary} onPress={() => navigation.navigate('Profile' as never)}>
            <View style={[styles.miniAvatar, { backgroundColor: userProfile?.image || '#ddd' }]}>
                <Text style={styles.miniAvatarText}>{userProfile?.username?.[0] || 'Me'}</Text>
            </View>
            <View>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>{userProfile?.username || 'User'}</Text>
            </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
            <TouchableOpacity style={styles.statsCard} onPress={() => setViewersModalVisible(true)}>
                <Text style={styles.statsCount}>12</Text>
                <Text style={styles.statsLabel}>Views</Text>
            </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
          {/* "For You" Section (Horizontal) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>❤️ Recommended for You</Text>
            <Text style={styles.sectionSubtitle}>Based on your hobbies</Text>
          </View>
          
          <View style={styles.recommendationsContainer}>
            <FlatList
                horizontal
                data={recommendedUsers}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.recCard} onPress={async () => {
                        await ChatService.addChat(item, 'pending');
                        Alert.alert('Request Sent', `You liked ${item.name}!`);
                    }}>
                        <View style={[styles.recImage, { backgroundColor: item.image }]}>
                            <Text style={styles.recInitial}>{item.name[0]}</Text>
                        </View>
                        <Text style={styles.recName}>{item.name}, {item.age}</Text>
                        <Text style={styles.recMatch}>95% Match</Text>
                    </TouchableOpacity>
                )}
            />
          </View>

          {/* "Global Explore" Section (Swipe Deck) */}
          <View style={styles.deckContainer}>
             <Text style={[styles.sectionTitle, { marginLeft: 20, marginBottom: 10 }]}>🌍 Global Explore</Text>
             
             {currentIndex >= swipeUsers.length ? (
                 <View style={styles.noMoreContainer}>
                     <Text style={styles.noMoreText}>No more profiles!</Text>
                     <TouchableOpacity onPress={() => setCurrentIndex(0)} style={styles.resetButton}>
                        <Text style={styles.resetText}>Start Over</Text>
                     </TouchableOpacity>
                 </View>
             ) : (
                 <View style={styles.cardStack}>
                    {nextUser && (
                        <Animated.View style={[styles.cardWrapper, styles.nextCard]}>
                            <Card user={nextUser} />
                        </Animated.View>
                    )}
                    <Animated.View
                        {...panResponder.panHandlers}
                        style={[styles.cardWrapper, rotateAndTranslate]}
                    >
                        <Card user={currentUser} />
                    </Animated.View>

                    {/* Swipe Buttons (Floating over deck) */}
                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={[styles.circleButton, styles.nopeButton]} onPress={handleSwipeLeft}>
                            <Text style={[styles.buttonIcon, { color: '#E5566D' }]}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.circleButton, styles.likeButton]} onPress={handleSwipeRight}>
                            <Text style={[styles.buttonIcon, { color: '#4CD964' }]}>♥️</Text>
                        </TouchableOpacity>
                    </View>
                 </View>
             )}
          </View>
      </View>

      {/* Viewers Modal */}
      <Modal
        visible={viewersModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Who viewed your profile</Text>
                <TouchableOpacity onPress={() => setViewersModalVisible(false)}>
                    <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                data={MOCK_VIEWERS}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.viewerItem}>
                        <View style={[styles.viewerAvatar, { backgroundColor: item.image }]}>
                            <Text style={styles.viewerInitial}>{item.name[0]}</Text>
                        </View>
                        <View style={styles.viewerInfo}>
                            <Text style={styles.viewerName}>{item.name}, {item.age}</Text>
                            <Text style={styles.viewerTime}>Viewed {item.time}</Text>
                        </View>
                        <TouchableOpacity style={styles.viewButton}>
                            <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
            />
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
  portalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  iconButton: {
      marginRight: 15,
      padding: 5,
      position: 'relative',
  },
  badge: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#E94057',
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  miniAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  welcomeText: {
    fontSize: 12,
    color: '#888',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statsCard: {
    alignItems: 'center',
    backgroundColor: '#FFF0F3',
    padding: 10,
    borderRadius: 12,
    minWidth: 70,
  },
  statsCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E94057',
  },
  statsLabel: {
    fontSize: 10,
    color: '#333',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    paddingTop: 15,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888',
  },
  recommendationsContainer: {
    height: 140,
    marginBottom: 20,
  },
  recCard: {
    marginRight: 15,
    alignItems: 'center',
    width: 100,
  },
  recImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recInitial: {
    fontSize: 30,
    color: '#fff',
    fontWeight: 'bold',
  },
  recName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  recMatch: {
    fontSize: 11,
    color: '#E94057',
    fontWeight: 'bold',
  },
  deckContainer: {
    flex: 1,
    position: 'relative',
  },
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    position: 'absolute',
    width: width * 0.9,
    height: height * 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    top: 0,
  },
  nextCard: {
    transform: [{ scale: 0.95 }, { translateY: 10 }],
    opacity: 0.8,
    zIndex: -1,
  },
  buttonsContainer: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '80%',
  },
  circleButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nopeButton: {
    borderWidth: 1,
    borderColor: '#E5566D',
  },
  likeButton: {
    borderWidth: 1,
    borderColor: '#4CD964',
  },
  buttonIcon: {
    fontSize: 30,
  },
  noMoreContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noMoreText: {
    fontSize: 18,
    color: '#888',
    marginBottom: 20,
  },
  resetButton: {
    padding: 10,
    backgroundColor: '#E94057',
    borderRadius: 20,
  },
  resetText: {
    color: '#fff',
    fontWeight: 'bold',
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeText: {
    color: '#E94057',
    fontSize: 16,
  },
  viewerItem: {
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
  viewButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 15,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  // Request Item Styles
  requestItem: {
      flexDirection: 'row',
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0',
      alignItems: 'center',
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
  emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  emptyText: {
      fontSize: 16,
      color: '#888',
  },
});
