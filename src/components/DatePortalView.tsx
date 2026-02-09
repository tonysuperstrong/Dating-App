import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Dimensions, 
  FlatList, 
  Alert,
  Image,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Share,
  Animated,
  Vibration,
  ViewToken
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import ApiService from '../services/ApiService';
import SwipeDeck from './SwipeDeck';

const { width } = Dimensions.get('window');

interface Post {
  id: string;
  user_id: string;
  username: string;
  name: string;
  user_image: string;
  images: string[];
  description: string;
  song: string;
  song_preview?: string;
  timestamp: number;
  likes: number;
  isLiked?: boolean;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  name: string;
  user_image: string;
  text: string;
  timestamp: number;
}

interface ScheduleEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  description?: string;
}

interface UserRecommendation {
  id: string;
  name: string;
  image: string;
  age?: number;
  location?: string;
}

export default function DatePortalView() {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'feed' | 'swipe'>('feed');
  
  // New Sections State
  const [todayEvents, setTodayEvents] = useState<ScheduleEvent[]>([]);
  const [recommendations, setRecommendations] = useState<UserRecommendation[]>([]);

  // Create Post State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPostDescription, setNewPostDescription] = useState('');
  const [newPostSong, setNewPostSong] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  // Comments State
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Audio State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const [viewablePostId, setViewablePostId] = useState<string | null>(null);

  // Animation State
  const [animatingPostId, setAnimatingPostId] = useState<string | null>(null);
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
    return () => {
      // Cleanup sound on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    // Auto-play logic
    const checkAndPlay = async () => {
        if (!viewablePostId) return;
        
        const post = posts.find(p => p.id === viewablePostId);
        if (!post) return;

        // If the visible post has music and it's not currently playing
        if (post.song_preview) {
            if (playingPostId !== post.id) {
                await playMusic(post.song_preview, post.id);
            }
        } else {
            // If visible post has no music, stop playing
            await stopMusic();
        }
    };
    checkAndPlay();
  }, [viewablePostId, posts]); // Depend on viewablePostId and posts to ensure we have latest data

  useFocusEffect(
    useCallback(() => {
      loadScheduleAndRecommendations();
    }, [])
  );

  const loadScheduleAndRecommendations = async () => {
    try {
        // Load Schedule
        const storedEvents = await AsyncStorage.getItem('scheduleEvents');
        if (storedEvents) {
            const allEvents: ScheduleEvent[] = JSON.parse(storedEvents);
            // Get today's date in YYYY-MM-DD format (local time)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayString = `${year}-${month}-${day}`;
            
            const todays = allEvents.filter(e => e.date === todayString);
            setTodayEvents(todays);
        }

        // Load Recommendations (Mock fetch from API for now, or real if endpoint ready)
        // Using existing getUsers from ApiService which fetches potential matches
        const users = await ApiService.getUsers(userProfile?.id);
        if (users && users.length > 0) {
            // Filter out current user and map to recommendation format
            const recs = users
                .filter((u: any) => u.id !== userProfile?.id)
                .slice(0, 10) // Limit to 10
                .map((u: any) => ({
                    id: u.id,
                    name: u.name,
                    image: u.image,
                    age: u.age,
                    location: u.location
                }));
            setRecommendations(recs);
        }
    } catch (error) {
        console.error('Error loading extra data:', error);
    }
  };

  const loadData = async () => {
    try {
      const profileString = await AsyncStorage.getItem('userProfile');
      let profileId = undefined;
      if (profileString) {
        const profile = JSON.parse(profileString);
        setUserProfile(profile);
        profileId = profile.id;
      }
      loadPosts(profileId);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const loadPosts = async (userId?: string) => {
    try {
      // Use passed userId or fallback to state (for pull-to-refresh)
      const currentUserId = userId || userProfile?.id;
      const fetchedPosts = await ApiService.getPosts(currentUserId);
      setPosts(fetchedPosts);
    } catch (error) {
      console.error('Failed to load posts', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handlePickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });

    if (!result.canceled) {
      setNewPostImages([...newPostImages, ...result.assets.map(asset => asset.uri)]);
    }
  };

  const handleCreatePost = async () => {
    if (newPostImages.length === 0) {
      Alert.alert('Missing Image', 'Please select at least one photo for your post.');
      return;
    }

    if (!newPostDescription) {
      Alert.alert('Missing Description', 'Please write a caption for your post.');
      return;
    }

    setIsPosting(true);
    try {
      let songPreview = '';
      let finalSongName = newPostSong;

      // Search for music if provided
      if (newPostSong.trim()) {
        const musicResult = await ApiService.searchMusic(newPostSong);
        if (musicResult) {
            finalSongName = musicResult.name;
            songPreview = musicResult.previewUrl;
        }
      }

      const postData = {
        user_id: userProfile?.id,
        description: newPostDescription,
        song: finalSongName,
        song_preview: songPreview,
        images: newPostImages,
      };

      await ApiService.createPost(postData);
      
      setNewPostDescription('');
      setNewPostSong('');
      setNewPostImages([]);
      setCreateModalVisible(false);
      loadPosts();
    } catch (error) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!userProfile?.id) return;

    // Haptic Feedback
    if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
        Vibration.vibrate(50);
    }

    // Animation
    setAnimatingPostId(postId);
    scaleValue.setValue(1); // Reset
    Animated.sequence([
      Animated.spring(scaleValue, { toValue: 1.2, useNativeDriver: true }),
      Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true }),
    ]).start(() => setAnimatingPostId(null));

    try {
      await ApiService.likePost(postId, userProfile.id);
      setPosts(currentPosts => 
        currentPosts.map(p => {
            if (p.id === postId) {
                const isNowLiked = !p.isLiked;
                return { 
                    ...p, 
                    likes: isNowLiked ? p.likes + 1 : p.likes - 1,
                    isLiked: isNowLiked
                };
            }
            return p;
        })
      );
    } catch (error) {
      console.error('Failed to like post', error);
    }
  };

  const stopMusic = async () => {
    if (soundRef.current) {
        try {
            await soundRef.current.unloadAsync();
        } catch (error) {
            console.log('Error unloading sound', error);
        }
        soundRef.current = null;
        setSound(null);
        setPlayingPostId(null);
    }
  };

  const playMusic = async (previewUrl: string, postId: string) => {
    try {
      await stopMusic();

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true }
      );
      soundRef.current = newSound;
      setSound(newSound);
      setPlayingPostId(postId);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
            setPlayingPostId(null);
            newSound.unloadAsync();
            soundRef.current = null;
            setSound(null);
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const handlePlayMusic = async (previewUrl: string, postId: string) => {
    if (playingPostId === postId) {
        await stopMusic();
    } else {
        await playMusic(previewUrl, postId);
    }
  };

  const handleShare = async (post: Post) => {
    try {
        const result = await Share.share({
            message: `Check out ${post.name}'s post: "${post.description}" ${post.song ? `🎵 Listening to ${post.song}` : ''}`,
            title: 'Share Post',
            url: post.images[0] // iOS only
        });
    } catch (error) {
        console.error(error);
    }
  };

  const openComments = async (postId: string) => {
    setActivePostId(postId);
    setCommentsModalVisible(true);
    setLoadingComments(true);
    try {
        const fetchedComments = await ApiService.getComments(postId);
        setComments(fetchedComments);
    } catch (error) {
        console.error('Error fetching comments:', error);
    } finally {
        setLoadingComments(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newCommentText.trim() || !activePostId || !userProfile) return;

    try {
        const comment = await ApiService.addComment(activePostId, userProfile.id, newCommentText);
        // Optimistic update
        const newCommentObj: Comment = {
            id: comment.id || Date.now().toString(),
            post_id: activePostId,
            user_id: userProfile.id,
            username: userProfile.username || 'You',
            name: userProfile.name || 'You',
            user_image: userProfile.image,
            text: newCommentText,
            timestamp: Date.now()
        };
        setComments([...comments, newCommentObj]);
        setNewCommentText('');
    } catch (error) {
        Alert.alert('Error', 'Failed to post comment');
    }
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isUserColor = item.user_image && item.user_image.startsWith('#');
    const isPlaying = playingPostId === item.id;
    const isAnimating = animatingPostId === item.id;
    
    return (
      <View style={styles.postContainer}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <TouchableOpacity onPress={() => {
                if (item.user_id) {
                    (navigation as any).navigate('Profile', { userId: item.user_id });
                }
            }}>
                {isUserColor ? (
                <View style={[styles.avatar, { backgroundColor: item.user_image }]}>
                    <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase() || '?'}</Text>
                </View>
                ) : (
                <Image source={{ uri: item.user_image }} style={styles.avatar} />
                )}
            </TouchableOpacity>
            <View>
                <Text style={styles.username}>{item.name}</Text>
                {item.song ? (
                    <TouchableOpacity 
                        style={styles.songContainer} 
                        onPress={() => item.song_preview ? handlePlayMusic(item.song_preview, item.id) : null}
                        disabled={!item.song_preview}
                    >
                        <Text style={[styles.songTag, isPlaying && styles.playingSong]}>
                            {isPlaying ? '🔊 Playing: ' : '🎵 '}{item.song}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
          </View>
          <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleDateString()}</Text>
        </View>

        {/* Post Images (Horizontal Scroll) */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {item.images.map((img, index) => (
            <Image key={index} source={{ uri: img }} style={styles.postImage} resizeMode="cover" />
          ))}
        </ScrollView>
        {item.images.length > 1 && (
            <View style={styles.paginationDots}>
                {item.images.map((_, i) => (
                    <View key={i} style={[styles.dot, i === 0 ? styles.activeDot : null]} />
                ))}
            </View>
        )}

        {/* Post Actions & Content */}
        <View style={styles.postFooter}>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => handleLikePost(item.id)} style={styles.actionButton}>
              <Animated.Text style={[
                styles.actionIcon, 
                { transform: [{ scale: isAnimating ? scaleValue : 1 }] }
              ]}>
                {item.isLiked ? '❤️' : '🤍'}
              </Animated.Text>
              <Text style={styles.likesCount}>{item.likes} likes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={() => openComments(item.id)}>
              <Text style={styles.actionIcon}>💬</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
              <Text style={styles.actionIcon}>🚀</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.description}>
            <Text style={styles.boldUsername}>{item.username}</Text> {item.description}
          </Text>
          
          <TouchableOpacity onPress={() => openComments(item.id)}>
             <Text style={styles.viewComments}>View all comments</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isUserColor = item.user_image && item.user_image.startsWith('#');
    return (
        <View style={styles.commentItem}>
            <TouchableOpacity onPress={() => {
                if (item.user_id) {
                    (navigation as any).navigate('Profile', { userId: item.user_id });
                    setCommentsModalVisible(false); // Close modal
                }
            }}>
                {isUserColor ? (
                <View style={[styles.commentAvatar, { backgroundColor: item.user_image }]}>
                    <Text style={styles.commentAvatarText}>{item.username?.[0]?.toUpperCase()}</Text>
                </View>
                ) : (
                <Image source={{ uri: item.user_image }} style={styles.commentAvatar} />
                )}
            </TouchableOpacity>
            <View style={styles.commentContent}>
                <Text style={styles.commentUsername}>{item.username} <Text style={styles.commentText}>{item.text}</Text></Text>
                <Text style={styles.commentTime}>{new Date(item.timestamp).toLocaleDateString()}</Text>
            </View>
        </View>
    );
  };

  // Viewability Config
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80 // Item is considered visible if 80% is on screen
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
        setViewablePostId(viewableItems[0].item.id);
    }
  }).current;

  const renderHeader = () => (
    <View>
        {/* Recommendations Section */}
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            <FlatList
                horizontal
                data={recommendations}
                showsHorizontalScrollIndicator={false}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.recommendationList}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.recommendationItem}
                        onPress={() => {
                            if (item.id) {
                                (navigation as any).navigate('Profile', { userId: item.id });
                            }
                        }}
                    >
                        <Image source={{ uri: item.image }} style={styles.recommendationImage} />
                        <Text style={styles.recommendationName} numberOfLines={1}>{item.name}</Text>
                        {item.age && <Text style={styles.recommendationInfo}>{item.age}</Text>}
                    </TouchableOpacity>
                )}
            />
        </View>

        {/* Today's Schedule Section */}
        <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Today's Plan</Text>
            {todayEvents.length > 0 ? (
                todayEvents.map(event => (
                    <View key={event.id} style={styles.eventCard}>
                        <View style={styles.eventTimeContainer}>
                            <Text style={styles.eventTimeText}>{event.time}</Text>
                        </View>
                        <View style={styles.eventDetails}>
                            <Text style={styles.eventTitle}>{event.title}</Text>
                            {event.description ? (
                                <Text style={styles.eventDescription} numberOfLines={1}>{event.description}</Text>
                            ) : null}
                        </View>
                    </View>
                ))
            ) : (
                <TouchableOpacity 
                    style={styles.emptyEventCard}
                    onPress={() => navigation.navigate('Schedule' as never)}
                >
                    <Text style={styles.emptyEventText}>No plans for today.</Text>
                    <Text style={styles.addEventText}>+ Add Event</Text>
                </TouchableOpacity>
            )}
        </View>

        <Text style={[styles.sectionTitle, { marginHorizontal: 15, marginTop: 10 }]}>Latest Posts</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerToggle}>
            <TouchableOpacity onPress={() => setViewMode('feed')}>
                <Text style={[styles.headerTitle, viewMode === 'swipe' && styles.headerTitleInactive]}>Discover</Text>
            </TouchableOpacity>
            <Text style={styles.headerDivider}>|</Text>
            <TouchableOpacity onPress={() => setViewMode('swipe')}>
                <Text style={[styles.headerTitle, viewMode === 'feed' && styles.headerTitleInactive]}>Match</Text>
            </TouchableOpacity>
        </View>
        {viewMode === 'feed' && (
            <TouchableOpacity style={styles.addButton} onPress={() => setCreateModalVisible(true)}>
                <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
        )}
      </View>

      {/* Feed or Swipe Deck */}
      {viewMode === 'feed' ? (
        <FlatList
            data={posts}
            ListHeaderComponent={renderHeader}
            renderItem={renderPost}
            keyExtractor={item => item.id}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
                </View>
            }
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
        />
      ) : (
        <View style={styles.swipeContainer}>
            {userProfile ? (
                <SwipeDeck currentUserId={userProfile.id} />
            ) : (
                <View style={styles.emptyContainer}>
                    <Text>Loading profile...</Text>
                </View>
            )}
        </View>
      )}

      {/* Create Post Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
        >
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>New Post</Text>
                <TouchableOpacity onPress={handleCreatePost} disabled={isPosting}>
                    <Text style={[styles.postText, isPosting && styles.disabledText]}>Share</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
                {/* Image Picker */}
                <ScrollView horizontal style={styles.previewScroll}>
                    <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImages}>
                        <Text style={styles.addPhotoIcon}>📷</Text>
                        <Text style={styles.addPhotoText}>Add Photos</Text>
                    </TouchableOpacity>
                    {newPostImages.map((img, index) => (
                        <Image key={index} source={{ uri: img }} style={styles.previewImage} />
                    ))}
                </ScrollView>

                <TextInput
                    style={styles.input}
                    placeholder="Write a caption..."
                    multiline
                    value={newPostDescription}
                    onChangeText={setNewPostDescription}
                />

                <View style={styles.songInputContainer}>
                    <Text style={styles.inputLabel}>Add Music</Text>
                    <TextInput
                        style={styles.songInput}
                        placeholder="Type song name (e.g. Espresso)"
                        value={newPostSong}
                        onChangeText={setNewPostSong}
                    />
                    <Text style={styles.helperText}>We'll auto-find the preview for you!</Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentsModalVisible(false)}
      >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comments</Text>
                <TouchableOpacity onPress={() => setCommentsModalVisible(false)}>
                    <Text style={styles.cancelText}>Close</Text>
                </TouchableOpacity>
            </View>
            
            <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.commentsList}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No comments yet.</Text>
                }
            />
            
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                style={styles.commentInputContainer}
            >
                <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    value={newCommentText}
                    onChangeText={setNewCommentText}
                />
                <TouchableOpacity onPress={handleSubmitComment} disabled={!newCommentText.trim()}>
                    <Text style={[styles.postText, !newCommentText.trim() && styles.disabledText]}>Post</Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    color: '#000',
  },
  headerTitleInactive: {
    color: '#ccc',
  },
  headerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDivider: {
    fontSize: 24,
    color: '#eee',
    marginHorizontal: 10,
  },
  swipeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  addButton: {
    padding: 5,
  },
  addButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: '#000',
  },
  listContent: {
    paddingBottom: 20,
  },
  postContainer: {
    marginBottom: 20,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  songContainer: {
    marginTop: 2,
  },
  songTag: {
    fontSize: 11,
    color: '#666',
  },
  playingSong: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  imageScroll: {
    width: width,
    height: width, // Square posts
  },
  postImage: {
    width: width,
    height: width,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: -20,
    marginBottom: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#fff',
  },
  postFooter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  actionIcon: {
    fontSize: 22,
    marginRight: 5,
  },
  likesCount: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
  },
  boldUsername: {
    fontWeight: 'bold',
  },
  viewComments: {
    color: '#666',
    marginTop: 5,
    fontSize: 14,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelText: {
    fontSize: 16,
    color: '#000',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  postText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#999',
  },
  modalContent: {
    padding: 20,
  },
  previewScroll: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginRight: 10,
  },
  addPhotoIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  addPhotoText: {
    fontSize: 12,
    color: '#666',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 10,
  },
  input: {
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  songInputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  songInput: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  // Comment Styles
  commentsList: {
    padding: 15,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  commentText: {
    fontWeight: 'normal',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 50 : 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  // New Section Styles
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 15,
    marginBottom: 10,
    color: '#000',
  },
  recommendationList: {
    paddingHorizontal: 15,
  },
  recommendationItem: {
    marginRight: 15,
    alignItems: 'center',
    width: 80,
  },
  recommendationImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#E94057',
  },
  recommendationName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  recommendationInfo: {
    fontSize: 10,
    color: '#666',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#E94057',
  },
  eventTimeContainer: {
    marginRight: 15,
    justifyContent: 'center',
  },
  eventTimeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E94057',
  },
  eventDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventDescription: {
    fontSize: 12,
    color: '#666',
  },
  emptyEventCard: {
    backgroundColor: '#f9f9f9',
    marginHorizontal: 15,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
  },
  emptyEventText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
  },
  addEventText: {
    fontSize: 14,
    color: '#E94057',
    fontWeight: 'bold',
  },
});