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
  ViewToken,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
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

const formatRelativeTime = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (seconds < 60) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return `${weeks}w`;
};

const PostItem = React.memo(({ 
  item, 
  isPlaying, 
  isAnimating, 
  scaleValue, 
  onLike, 
  onComment, 
  onShare, 
  onPlayMusic, 
  navigation 
}: {
  item: Post;
  isPlaying: boolean;
  isAnimating: boolean;
  scaleValue: Animated.Value;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (post: Post) => void;
  onPlayMusic: (url: string, id: string) => void;
  navigation: any;
}) => {
    const isUserColor = item.user_image && item.user_image.startsWith('#');
    const hasUserImage = !!item.user_image && !isUserColor;
    
    return (
      <View style={styles.postContainer}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            <TouchableOpacity onPress={() => {
                if (item.user_id) {
                    console.log('[DatePortalView] Navigating to profile:', item.user_id);
                    navigation.navigate('Profile', { userId: item.user_id });
                } else {
                    console.warn('[DatePortalView] Missing user_id for post:', item.id);
                }
            }}>
                {isUserColor ? (
                  <View style={[styles.avatar, { backgroundColor: item.user_image }]}>
                      <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                ) : hasUserImage ? (
                  <Image source={{ uri: item.user_image }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: '#ddd' }]}>
                      <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                )}
            </TouchableOpacity>
            <View>
                <Text style={styles.username}>{item.name}</Text>
                {item.song ? (
                    <TouchableOpacity 
                        style={styles.songContainer} 
                        onPress={() => item.song_preview ? onPlayMusic(item.song_preview, item.id) : null}
                        disabled={!item.song_preview}
                    >
                        <Text style={[styles.songTag, isPlaying && styles.playingSong]}>
                            {isPlaying ? '🔊 Playing: ' : '🎵 '}{item.song}
                        </Text>
                    </TouchableOpacity>
                ) : null}
            </View>
          </View>
          <Text style={styles.timestamp}>{new Date(Number(item.timestamp)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
        </View>

        {/* Post Images (Horizontal Scroll) */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {item.images.filter(Boolean).map((img, index) => (
            <Image key={index} source={{ uri: img }} style={styles.postImage} resizeMode="cover" />
          ))}
        </ScrollView>
        {item.images.filter(Boolean).length > 1 && (
            <View style={styles.paginationDots}>
                {item.images.filter(Boolean).map((_, i) => (
                    <View key={i} style={[styles.dot, i === 0 ? styles.activeDot : null]} />
                ))}
            </View>
        )}

        {/* Post Actions & Content */}
        <View style={styles.postFooter}>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => onLike(item.id)} style={styles.actionButton}>
              <Animated.Text style={[
                styles.actionIcon, 
                { transform: [{ scale: isAnimating ? scaleValue : 1 }] }
              ]}>
                {item.isLiked ? '❤️' : '🤍'}
              </Animated.Text>
              <Text style={styles.likesCount}>{item.likes} likes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={() => onComment(item.id)}>
              <Text style={styles.actionIcon}>💬</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item)}>
              <Text style={styles.actionIcon}>🚀</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.description}>
            <Text style={styles.boldUsername}>{item.username}</Text> {item.description}
          </Text>
          
          <TouchableOpacity onPress={() => onComment(item.id)}>
             <Text style={styles.viewComments}>View all comments</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.item === nextProps.item &&
        prevProps.isPlaying === nextProps.isPlaying &&
        prevProps.isAnimating === nextProps.isAnimating
    );
});

export default function DatePortalView() {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'feed' | 'swipe'>('feed');

  // Pagination State
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
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
  const playingPostIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    playingPostIdRef.current = playingPostId;
  }, [playingPostId]);

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
    }, [userProfile])
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

        // Get user ID properly to ensure exclusion works
        let currentUserId = userProfile?.id;
        if (!currentUserId) {
             const profileString = await AsyncStorage.getItem('userProfile');
             if (profileString) {
                 const p = JSON.parse(profileString);
                 currentUserId = p.id;
             }
        }

        // Load Recommendations (Mock fetch from API for now, or real if endpoint ready)
        // Using existing getUsers from ApiService which fetches potential matches
        const users = await ApiService.getUsers(currentUserId);
        if (users && users.length > 0) {
            // Filter out current user and map to recommendation format
            const recs = users
                .filter((u: any) => u.id !== currentUserId)
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

  const loadData = useCallback(async () => {
    try {
      const profileString = await AsyncStorage.getItem('userProfile');
      let profileId = undefined;
      if (profileString) {
        const profile = JSON.parse(profileString);
        setUserProfile(profile);
        profileId = profile.id;
      }
      loadInitialPosts(profileId);
    } catch (error) {
      // console.error('Error loading data:', error);
    }
  }, []);

  const loadInitialPosts = useCallback(async (userId?: string) => {
    try {
      const currentUserId = userId || userProfile?.id;
      // Reset to page 1
      const fetchedPosts = await ApiService.getPosts(currentUserId, undefined, false, 1, 10);
      
      // Filter potential duplicates within the fetched batch itself (paranoid check)
      const uniquePosts = Array.from(new Map(fetchedPosts.map((item: Post) => [item.id, item])).values());
      
      setPosts(uniquePosts as Post[]);
      setHasMore(fetchedPosts.length === 10);
      setPage(1); // Keep page at 1, so next load calls page + 1 = 2
    } catch (error) {
      // console.error('Failed to load posts', error);
    }
  }, [userProfile]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
        const currentUserId = userProfile?.id;
        const nextPage = page + 1; 
        const fetchedPosts = await ApiService.getPosts(currentUserId, undefined, false, nextPage, 10);
        
        if (fetchedPosts.length > 0) {
            setPosts(prev => {
                const existingIds = new Set(prev.map(p => p.id));
                const newPosts = fetchedPosts.filter((p: Post) => !existingIds.has(p.id));
                return [...prev, ...newPosts];
            });
            setPage(nextPage);
        }
        
        if (fetchedPosts.length < 10) {
            setHasMore(false);
        }
    } catch (error) {
        // console.error('Failed to load more posts', error);
    } finally {
        setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, userProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialPosts();
    setRefreshing(false);
  }, [loadInitialPosts]);

  const handlePickImages = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });

    if (!result.canceled) {
      const localUris = result.assets.map(asset => asset.uri).filter(Boolean);
      const uploadedUrls: string[] = [];
      let hadFailures = false;
      let lastErrorMessage = '';

      for (const uri of localUris) {
        try {
          const uploadedUrl = await ApiService.uploadImage(uri);
          uploadedUrls.push(uploadedUrl);
        } catch (error: any) {
          hadFailures = true;
          lastErrorMessage =
            (error && error.message) || 'Unknown upload error. Please try again.';
          console.error('Post image upload error', error);
        }
      }

      if (uploadedUrls.length === 0) {
        Alert.alert('Upload Error', lastErrorMessage);
        return;
      }

      setNewPostImages(prev => [...prev, ...uploadedUrls]);

      if (hadFailures) {
        Alert.alert(
          'Upload Error',
          'Some photos failed to upload and will not be included in the post.'
        );
      }
    }
  }, []);

  const resetPostForm = useCallback(() => {
    setNewPostDescription('');
    setNewPostSong('');
    setNewPostImages([]);
    setIsPosting(false);
  }, []);

  const handleCreatePost = useCallback(async () => {
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
      
      resetPostForm();
      setCreateModalVisible(false);
      loadInitialPosts();
    } catch (error) {
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  }, [newPostImages, newPostDescription, newPostSong, userProfile, resetPostForm, loadInitialPosts]);

  const handleLikePost = useCallback(async (postId: string) => {
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
  }, [userProfile]);

  const stopMusic = useCallback(async () => {
    if (soundRef.current) {
        try {
            await soundRef.current.unloadAsync();
        } catch (error) {
            // Ignore unload errors
        }
        soundRef.current = null;
        setSound(null);
        setPlayingPostId(null);
    }
  }, []);

  const playMusic = useCallback(async (previewUrl: string, postId: string) => {
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
      // console.error('Error playing sound:', error);
    }
  }, [stopMusic]);

  const handlePlayMusic = useCallback(async (previewUrl: string, postId: string) => {
    if (playingPostIdRef.current === postId) {
        await stopMusic();
    } else {
        await playMusic(previewUrl, postId);
    }
  }, [stopMusic, playMusic]);

  const handleShare = useCallback(async (post: Post) => {
    try {
        const result = await Share.share({
            message: `Check out ${post.name}'s post: "${post.description}" ${post.song ? `🎵 Listening to ${post.song}` : ''}`,
            title: 'Share Post',
            url: post.images[0] // iOS only
        });
    } catch (error) {
        // console.error(error);
    }
  }, []);

  const openComments = useCallback(async (postId: string) => {
    setActivePostId(postId);
    setCommentsModalVisible(true);
    setLoadingComments(true);
    try {
        const fetchedComments = await ApiService.getComments(postId);
        setComments(fetchedComments);
    } catch (error) {
        // console.error('Error fetching comments:', error);
    } finally {
        setLoadingComments(false);
    }
  }, []);

  const handleSubmitComment = useCallback(async () => {
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
  }, [newCommentText, activePostId, userProfile, comments]);

  const renderPost = useCallback(({ item }: { item: Post }) => (
    <PostItem
        item={item}
        isPlaying={playingPostId === item.id}
        isAnimating={animatingPostId === item.id}
        scaleValue={scaleValue}
        onLike={handleLikePost}
        onComment={openComments}
        onShare={handleShare}
        onPlayMusic={handlePlayMusic}
        navigation={navigation}
    />
  ), [playingPostId, animatingPostId, scaleValue, handleLikePost, openComments, handleShare, handlePlayMusic, navigation]);

  const renderComment = useCallback(({ item }: { item: Comment }) => {
    const isUserColor = item.user_image && item.user_image.startsWith('#');
    const hasUserImage = !!item.user_image && !isUserColor;
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
                ) : hasUserImage ? (
                  <Image source={{ uri: item.user_image }} style={styles.commentAvatar} />
                ) : (
                  <View style={[styles.commentAvatar, { backgroundColor: '#ddd' }]}>
                      <Text style={styles.commentAvatarText}>{item.username?.[0]?.toUpperCase()}</Text>
                  </View>
                )}
            </TouchableOpacity>
            
            <View style={styles.commentContent}>
                <Text style={styles.commentUsername}>{item.username}</Text>
                <Text style={styles.commentTextContainer}>
                    <Text style={styles.commentText}>{item.text}</Text>
                </Text>
                <View style={styles.commentMetaContainer}>
                    <Text style={styles.commentTime}>{formatRelativeTime(Number(item.timestamp))}</Text>
                    <TouchableOpacity>
                        <Text style={styles.replyText}>Reply</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity style={styles.commentLikeButton}>
                <Ionicons name="heart-outline" size={14} color="#666" />
            </TouchableOpacity>
        </View>
    );
  }, [navigation]);

  // Viewability Config
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80 // Item is considered visible if 80% is on screen
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
        setViewablePostId(viewableItems[0].item.id);
    }
  }).current;

  const renderHeader = useCallback(() => (
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
                renderItem={({ item }) => {
                    const isColor = item.image && item.image.startsWith('#');
                    const hasImage = !!item.image && !isColor;
                    return (
                        <TouchableOpacity 
                            style={styles.recommendationItem}
                            onPress={() => {
                                if (item.id) {
                                    (navigation as any).navigate('Profile', { userId: item.id });
                                }
                            }}
                        >
                            {isColor ? (
                                <View style={[styles.recommendationImage, { backgroundColor: item.image, justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                                </View>
                            ) : hasImage ? (
                                <Image source={{ uri: item.image }} style={styles.recommendationImage} />
                            ) : (
                                <View style={[styles.recommendationImage, { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={styles.avatarText}>{item.name[0]}</Text>
                                </View>
                            )}
                            <Text style={styles.recommendationName} numberOfLines={1}>{item.name}</Text>
                            {item.age && <Text style={styles.recommendationInfo}>{item.age}</Text>}
                        </TouchableOpacity>
                    );
                }}
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
  ), [recommendations, todayEvents, navigation]);

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
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 20 }} /> : null}
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
                <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => {
                        resetPostForm();
                        setCreateModalVisible(false);
                    }}
                >
                    <Text style={styles.modalCloseIcon}>×</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>New Post</Text>
                <TouchableOpacity 
                    onPress={handleCreatePost} 
                    disabled={isPosting}
                    style={[styles.shareButton, isPosting && styles.shareButtonDisabled]}
                >
                    <Ionicons 
                      name="send" 
                      size={20} 
                      color="#fff" 
                    />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
                {/* Image Picker */}
                <ScrollView horizontal style={styles.previewScroll}>
                    <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImages}>
                        <Text style={styles.addPhotoIcon}>📷</Text>
                        <Text style={styles.addPhotoText}>Add Photos</Text>
                    </TouchableOpacity>
                    {newPostImages.filter(Boolean).map((img, index) => (
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
        transparent={true}
        onRequestClose={() => setCommentsModalVisible(false)}
      >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1}
                onPress={() => setCommentsModalVisible(false)}
            />
            <View style={styles.halfScreenContainer}>
                <View style={styles.modalHeaderCenter}>
                    <View style={styles.dragHandle} />
                    <Text style={styles.modalTitleCenter}>Comments</Text>
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
                
                <View style={styles.commentInputContainer}>
                    {userProfile?.image ? (
                    userProfile.image.startsWith('#') ? (
                        <View style={[styles.currentUserAvatar, { backgroundColor: userProfile.image }]}>
                            <Text style={styles.currentUserAvatarText}>{userProfile.name?.[0]?.toUpperCase()}</Text>
                        </View>
                    ) : (
                        <Image source={{ uri: userProfile.image }} style={styles.currentUserAvatar} />
                    )
                    ) : null}

                    <TextInput
                        style={styles.commentInput}
                        placeholder={`Add a comment as ${userProfile?.name || '...'}`}
                        placeholderTextColor="#999"
                        value={newCommentText}
                        onChangeText={setNewCommentText}
                    />
                    <TouchableOpacity onPress={handleSubmitComment} disabled={!newCommentText.trim()}>
                        <Text style={[styles.postButtonText, !newCommentText.trim() && styles.disabledPostButtonText]}>Post</Text>
                    </TouchableOpacity>
                </View>
            </View>
          </KeyboardAvoidingView>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
  },
  halfScreenContainer: {
    height: '50%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseIcon: {
    fontSize: 22,
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
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: '#ccc',
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
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
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
    marginRight: 10,
  },
  commentTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  commentUsername: {
    fontWeight: 'bold',
    fontSize: 14,
    marginRight: 5,
    color: '#000',
  },
  commentText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 18,
  },
  commentMetaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentTime: {
    fontSize: 12,
    color: '#999',
    marginRight: 15,
  },
  replyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  commentLikeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  
  // Input Area Styles
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 15, // Adjusted for safe area
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  currentUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentUserAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f0f0f0', // Light gray background like Insta
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#000',
  },
  postButtonText: {
    color: '#0095F6', // Instagram blue
    fontWeight: '600',
    fontSize: 14,
  },
  disabledPostButtonText: {
    opacity: 0.3,
  },

  // Modal Header Styles
  modalHeaderCenter: {
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#dbdbdb',
    borderRadius: 2,
    marginBottom: 10,
  },
  modalTitleCenter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
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
