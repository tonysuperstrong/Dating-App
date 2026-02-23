import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, 
  Modal, 
  Alert 
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 3;

interface UserProfile {
  id: string;
  username?: string;
  password?: string;
  bio: string;
  hobbies: string | string[];
  image: string;
  location: string;
  language: string;
  ethnicity: string;
  gender?: string;
  sport?: string;
  age?: string | number;
  personality_type?: string;
  detailed_bio?: string;
  partner_preferences?: string;
  favorite_teams?: any[];
  voice_bio?: string;
}

interface FollowerStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [followerStats, setFollowerStats] = useState<FollowerStats>({
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
  });
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followingModalVisible, setFollowingModalVisible] = useState(false);
  const [followersList, setFollowersList] = useState<UserProfile[]>([]);
  const [followingList, setFollowingList] = useState<UserProfile[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        setLoading(true);
        try {
          const storedProfileStr = await AsyncStorage.getItem('userProfile');
          const storedProfile = storedProfileStr ? JSON.parse(storedProfileStr) : null;
          
          const targetUserId = route.params?.userId;
          let activeProfileId;

          if (targetUserId) {
            // Always fetch if userId is provided to ensure fresh data and handle guest mode
            const user = await ApiService.getUserById(targetUserId);
            console.log('ProfileScreen loaded user:', JSON.stringify(user, null, 2));
            
            if (user) {
                setProfile(user);
                activeProfileId = user.id;
                // Check if the fetched user is the current user
                setIsCurrentUser(storedProfile && String(storedProfile.id) === String(user.id));
            } else {
                // Fallback: if failed to fetch and it's us, use stored
                if (storedProfile && String(targetUserId) === String(storedProfile.id)) {
                    setProfile(storedProfile);
                    activeProfileId = storedProfile.id;
                    setIsCurrentUser(true);
                } else {
                    Alert.alert('Error', 'Failed to load user profile');
                }
            }
          } else if (storedProfile) {
            // No userId provided, default to current user
            setIsCurrentUser(true);
            setProfile(storedProfile);
            activeProfileId = storedProfile.id;
          }

          if (activeProfileId) {
              const fetchedPosts = await ApiService.getPosts(undefined, activeProfileId);
              setPosts(fetchedPosts);

              const stats = await ApiService.getFollowStats(
                activeProfileId,
                storedProfile ? storedProfile.id : undefined
              );
              if (stats) {
                setFollowerStats({
                  followersCount: stats.followersCount || 0,
                  followingCount: stats.followingCount || 0,
                  isFollowing: !!stats.isFollowing,
                });
              }
          }
        } catch (error) {
          // console.error('Failed to load profile', error);
              } finally {
                  setLoading(false);
              }
            };
            loadProfile();
          }, [route.params?.userId])
        );

  const handleMessage = async () => {
      if (!profile || !profile.id) return;
      
      try {
          const storedProfileStr = await AsyncStorage.getItem('userProfile');
          if (!storedProfileStr) {
              Alert.alert('Error', 'You must be logged in to send a message.');
              return;
          }
          const myProfile = JSON.parse(storedProfileStr);
          
          // Create or retrieve match to get matchId
          const result = await ApiService.likeUser(myProfile.id, profile.id);
          
          if (result && result.id) {
               navigation.navigate('ChatDetail', { 
                   userId: profile.id,
                   matchId: result.id,
                   name: profile.username || 'User',
                   image: profile.image
               });
          } else {
              Alert.alert('Error', 'Could not start chat.');
          }
      } catch (error) {
          console.error(error);
          Alert.alert('Error', 'Failed to connect.');
      }
  };

  const handleToggleFollow = async () => {
      if (!profile || !profile.id) return;
      try {
          const storedProfileStr = await AsyncStorage.getItem('userProfile');
          if (!storedProfileStr) {
              Alert.alert('Error', 'You must be logged in to follow users.');
              return;
          }
          const myProfile = JSON.parse(storedProfileStr);

          if (String(myProfile.id) === String(profile.id)) {
              return;
          }

          if (followerStats.isFollowing) {
              const result = await ApiService.unfollowUser(myProfile.id, profile.id);
              if (result && result.success) {
                  setFollowerStats(prev => ({
                      ...prev,
                      isFollowing: false,
                      followersCount: prev.followersCount > 0 ? prev.followersCount - 1 : 0,
                  }));
              }
          } else {
              const result = await ApiService.followUser(myProfile.id, profile.id);
              if (result && result.success) {
                  setFollowerStats(prev => ({
                      ...prev,
                      isFollowing: true,
                      followersCount: prev.followersCount + 1,
                  }));
              }
          }
      } catch (error) {
          Alert.alert('Error', 'Failed to update follow status.');
      }
  };

  const handleOpenFollowers = async () => {
      if (!profile || !profile.id) return;
      try {
          setFollowersLoading(true);
          setFollowersModalVisible(true);
          const users = await ApiService.getFollowers(profile.id);
          setFollowersList(users || []);
      } catch (error) {
          Alert.alert('Error', 'Failed to load followers.');
      } finally {
          setFollowersLoading(false);
      }
  };

  const handleOpenFollowing = async () => {
      if (!profile || !profile.id) return;
      try {
          setFollowingLoading(true);
          setFollowingModalVisible(true);
          const users = await ApiService.getFollowing(profile.id);
          setFollowingList(users || []);
      } catch (error) {
          Alert.alert('Error', 'Failed to load following.');
      } finally {
          setFollowingLoading(false);
      }
  };

  const playVoiceBio = async () => {
      if (profile?.voice_bio) {
          try {
            const { sound } = await Audio.Sound.createAsync({ uri: profile.voice_bio });
            setSound(sound);
            await sound.playAsync();
          } catch (error) {
              console.log('Error playing sound', error);
              Alert.alert('Error', 'Could not play voice bio');
          }
      }
  };

 const renderHeader = useCallback(() => {
    console.log('Rendering Profile Header. Profile:', JSON.stringify(profile, null, 2));
    
    return (
    <>
      <View style={styles.avatarContainer}>
        {profile?.image && !profile.image.startsWith('#') ? (
          <Image source={{ uri: profile.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: profile?.image && profile.image.startsWith('#') ? profile.image : '#ddd' }]}>
             <Text style={styles.avatarText}>{profile?.username?.[0]?.toUpperCase() || '?'}</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.name}>{profile?.username ? `@${profile.username}` : 'Profile'}</Text>

      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.statItem} onPress={handleOpenFollowers}>
          <Text style={styles.statNumber}>{followerStats.followersCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.statItem} onPress={handleOpenFollowing}>
          <Text style={styles.statNumber}>{followerStats.followingCount}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.bio}>{(profile?.bio && profile.bio.trim()) || 'No bio available.'}</Text>
      
      {profile?.voice_bio && (
          <TouchableOpacity style={styles.voiceBioButton} onPress={playVoiceBio}>
              <Ionicons name="mic" size={20} color="white" />
              <Text style={styles.voiceBioText}>Play Voice Bio</Text>
          </TouchableOpacity>
      )}

      {profile?.personality_type && (
          <View style={styles.personalityBadge}>
              <Text style={styles.personalityText}>
                  Personality: {profile.personality_type}
              </Text>
          </View>
      )}

      {profile && (
        <View style={styles.infoContainer}>
          {profile.detailed_bio ? (
              <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About Me</Text>
                  <Text style={styles.sectionContent}>{profile.detailed_bio}</Text>
              </View>
          ) : null}

          {profile.partner_preferences ? (
              <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Looking For</Text>
                  <Text style={styles.sectionContent}>{profile.partner_preferences}</Text>
              </View>
          ) : null}

          {profile.detailed_bio || profile.partner_preferences ? <View style={styles.divider} /> : null}

          {profile.age && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>🎂 Age:</Text>
              <Text style={styles.infoValue}>{profile.age.toString()}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 Country:</Text>
            <Text style={styles.infoValue}>
                {(profile.location && profile.location.trim()) ? profile.location : 'Not set'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🗣 Language:</Text>
            <Text style={styles.infoValue}>
                {(() => {
                    const l = profile.language;
                    console.log('Rendering Language:', l);
                    return (l && l.trim()) ? l : 'Not set';
                })()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🌍 Ethnicity:</Text>
            <Text style={styles.infoValue}>
                {(() => {
                    const e = profile.ethnicity;
                    console.log('Rendering Ethnicity:', e);
                    return (e && e.trim()) ? e : 'Not set';
                })()}
            </Text>
          </View>

          {profile.gender && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>⚧ Gender:</Text>
              <Text style={styles.infoValue}>{profile.gender}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🎨 Hobbies:</Text>
            <Text style={styles.infoValue}>
                {(() => {
                    const h = profile.hobbies;
                    console.log('Rendering Hobbies:', h, 'Type:', typeof h, 'IsArray:', Array.isArray(h));
                    if (Array.isArray(h) && h.length > 0) {
                        return h.filter((item: string) => item && item.trim()).join(', ') || 'Not set';
                    }
                    if (typeof h === 'string' && h.trim()) {
                        return h.trim();
                    }
                    return 'Not set';
                })()}
            </Text>
          </View>
          
          {profile.favorite_teams && profile.favorite_teams.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Teams</Text>
              <View style={styles.teamsContainer}>
                  {profile.favorite_teams.map((team: any, idx: number) => (
                    <View key={idx} style={styles.teamBadge}>
                      <Text style={styles.teamText}>{team.strTeam || team.name || team}</Text>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </View>
      )}

      {posts.length > 0 && (
         <View style={styles.postsHeaderContainer}>
            <Text style={styles.postsTitle}>Posts</Text>
            <Text style={styles.postsCount}>{posts.length}</Text>
         </View>
      )}
    </>
    );
  }, [profile, posts.length, followerStats.followersCount, followerStats.followingCount]);

  const renderFooter = useCallback(() => (
    <>
      {isCurrentUser ? (
        <View style={styles.settings}>
            <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => navigation.navigate('ProfileSetup', { isEditing: true })}
            >
                <Text style={styles.settingText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity 
            style={styles.settingItem}
            onPress={async () => {
                await AsyncStorage.removeItem('userProfile');
                navigation.replace('Login');
            }}
            >
                <Text style={[styles.settingText, { color: '#E94057' }]}>Logout</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionContainer}>
             <TouchableOpacity 
                 style={[
                   styles.followButton,
                   followerStats.isFollowing && styles.followingButton
                 ]}
                 onPress={handleToggleFollow}
             >
                 <Text
                   style={[
                     styles.followButtonText,
                     followerStats.isFollowing && styles.followingButtonText
                   ]}
                 >
                   {followerStats.isFollowing ? 'Following' : 'Follow'}
                 </Text>
             </TouchableOpacity>
             <TouchableOpacity 
                 style={styles.messageButton}
                 onPress={handleMessage}
             >
                 <Text style={styles.messageButtonText}>💬 Message</Text>
             </TouchableOpacity>
         </View>
      )}
    </>
  ), [isCurrentUser, navigation, handleMessage, followerStats.isFollowing, handleToggleFollow]);

  const renderPostItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity 
        style={styles.postItem}
        onPress={() => setSelectedImage(item.images[0])}
    >
        <Image source={{ uri: item.images[0] }} style={styles.postImage} />
    </TouchableOpacity>
  ), []);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={[styles.container, { justifyContent: 'center' }]}>
            <ActivityIndicator size="large" color="#E94057" />
        </View>
      ) : !profile ? (
        <View style={[styles.container, { justifyContent: 'center' }]}>
            <Text style={{ fontSize: 18, color: '#666' }}>User not found</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                <Text style={{ color: '#E94057', fontSize: 16 }}>Go Back</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPostItem}
            numColumns={3}
            ListHeaderComponent={renderHeader()}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <Modal visible={!!selectedImage} transparent={true} onRequestClose={() => setSelectedImage(null)}>
              <View style={styles.modalContainer}>
                  <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedImage(null)}>
                      <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                  {selectedImage && (
                    <Image source={{ uri: selectedImage }} style={styles.modalImage} resizeMode="contain" />
                  )}
              </View>
          </Modal>

          <Modal
            visible={followersModalVisible}
            animationType="slide"
            onRequestClose={() => setFollowersModalVisible(false)}
          >
            <View style={styles.listModalContainer}>
              <View style={styles.listModalHeader}>
                <Text style={styles.listModalTitle}>Followers</Text>
                <TouchableOpacity onPress={() => setFollowersModalVisible(false)}>
                  <Text style={styles.listModalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
              {followersLoading ? (
                <View style={styles.listLoaderContainer}>
                  <ActivityIndicator size="large" color="#E94057" />
                </View>
              ) : (
                <FlatList
                  data={followersList}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => {
                        setFollowersModalVisible(false);
                        navigation.navigate('Profile', { userId: item.id });
                      }}
                    >
                      {item.image && !item.image.startsWith('#') ? (
                        <Image source={{ uri: item.image }} style={styles.listAvatar} />
                      ) : (
                        <View style={[styles.listAvatar, styles.listAvatarPlaceholder]}>
                          <Text style={styles.listAvatarText}>
                            {item.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.listTextContainer}>
                        <Text style={styles.listUsername}>
                          {item.username ? `@${item.username}` : 'User'}
                        </Text>
                        {item.bio ? (
                          <Text style={styles.listBio} numberOfLines={1}>
                            {item.bio}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.listEmptyContainer}>
                      <Text style={styles.listEmptyText}>No followers yet.</Text>
                    </View>
                  }
                />
              )}
            </View>
          </Modal>

          <Modal
            visible={followingModalVisible}
            animationType="slide"
            onRequestClose={() => setFollowingModalVisible(false)}
          >
            <View style={styles.listModalContainer}>
              <View style={styles.listModalHeader}>
                <Text style={styles.listModalTitle}>Following</Text>
                <TouchableOpacity onPress={() => setFollowingModalVisible(false)}>
                  <Text style={styles.listModalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
              {followingLoading ? (
                <View style={styles.listLoaderContainer}>
                  <ActivityIndicator size="large" color="#E94057" />
                </View>
              ) : (
                <FlatList
                  data={followingList}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.listItem}
                      onPress={() => {
                        setFollowingModalVisible(false);
                        navigation.navigate('Profile', { userId: item.id });
                      }}
                    >
                      {item.image && !item.image.startsWith('#') ? (
                        <Image source={{ uri: item.image }} style={styles.listAvatar} />
                      ) : (
                        <View style={[styles.listAvatar, styles.listAvatarPlaceholder]}>
                          <Text style={styles.listAvatarText}>
                            {item.username?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={styles.listTextContainer}>
                        <Text style={styles.listUsername}>
                          {item.username ? `@${item.username}` : 'User'}
                        </Text>
                        {item.bio ? (
                          <Text style={styles.listBio} numberOfLines={1}>
                            {item.bio}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.listEmptyContainer}>
                      <Text style={styles.listEmptyText}>Not following anyone yet.</Text>
                    </View>
                  }
                />
              )}
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
  },
  avatarContainer: {
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  avatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#fff',
  },
  avatarPlaceholder: {
    backgroundColor: '#E94057',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
      color: 'white',
      fontSize: 30,
      fontWeight: 'bold',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statItem: {
    alignItems: 'center',
    marginHorizontal: 15,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#777',
  },
  bio: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    paddingHorizontal: 30,
    textAlign: 'center',
  },
  voiceBioButton: {
      flexDirection: 'row',
      backgroundColor: '#E94057',
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 20,
      marginBottom: 20,
      alignItems: 'center',
      alignSelf: 'center',
  },
  voiceBioText: {
      color: 'white',
      marginLeft: 5,
      fontWeight: 'bold',
      fontSize: 14,
  },
  personalityBadge: {
      backgroundColor: '#FFF0F3',
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 20,
  },
  personalityText: {
      color: '#E94057',
      fontWeight: 'bold',
      fontSize: 14,
  },
  infoContainer: {
    width: '90%',
    backgroundColor: '#f9f9f9',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
  },
  section: {
      marginBottom: 15,
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 5,
      color: '#333',
  },
  sectionContent: {
      fontSize: 14,
      color: '#555',
      lineHeight: 20,
  },
  teamsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 5,
  },
  teamBadge: {
    backgroundColor: '#E94057',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  divider: {
      height: 1,
      backgroundColor: '#eee',
      marginVertical: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontWeight: 'bold',
    width: 100,
    color: '#333',
  },
  infoValue: {
    flex: 1,
    color: '#555',
  },
  settings: {
    width: '100%',
    paddingHorizontal: 20,
  },
  settingItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    fontSize: 18,
    color: '#333',
  },
  postsSection: {
    width: '100%',
    marginBottom: 30,
  },
  postsHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
    width: '100%',
  },
  postsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
  },
  postsCount: {
    fontSize: 14,
    color: '#666',
  },
  postItem: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    padding: 1,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  modalCloseText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
  listModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  listModalCloseText: {
    fontSize: 16,
    color: '#E94057',
  },
  listLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  listAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#ddd',
  },
  listAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  listTextContainer: {
    flex: 1,
  },
  listUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  listBio: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  listEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  listEmptyText: {
    fontSize: 14,
    color: '#999',
  },
  actionContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E94057',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 10,
  },
  followButtonText: {
    color: '#E94057',
    fontSize: 16,
    fontWeight: 'bold',
  },
  followingButton: {
    backgroundColor: '#E94057',
  },
  followingButtonText: {
    color: '#fff',
  },
  messageButton: {
    backgroundColor: '#E94057',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: '#E94057',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  messageButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
