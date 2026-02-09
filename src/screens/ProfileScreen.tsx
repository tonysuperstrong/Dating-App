import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width / 3;

interface UserProfile {
  id: string;
  username?: string;
  password?: string;
  bio: string;
  hobbies: string;
  image: string;
  country: string;
  language: string;
  ethnicity: string;
  gender?: string;
  sport?: string;
  age?: string;
  personality_type?: string;
  detailed_bio?: string;
  partner_preferences?: string;
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        setLoading(true);
        try {
          const storedProfileStr = await AsyncStorage.getItem('userProfile');
          const storedProfile = storedProfileStr ? JSON.parse(storedProfileStr) : null;
          
          const targetUserId = route.params?.userId;
          let activeProfileId;

          if (targetUserId && storedProfile && targetUserId !== storedProfile.id) {
            // Viewing another user
            setIsCurrentUser(false);
            const user = await ApiService.getUserById(targetUserId);
            if (user) {
                setProfile(user);
                activeProfileId = user.id;
            }
          } else {
            // Viewing self (or fallback)
            setIsCurrentUser(true);
            setProfile(storedProfile);
            activeProfileId = storedProfile?.id;
          }

          if (activeProfileId) {
              const fetchedPosts = await ApiService.getPosts(undefined, activeProfileId);
              setPosts(fetchedPosts);
          }
        } catch (error) {
          console.error('Failed to load profile', error);
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

  if (loading) {
      return (
          <View style={[styles.container, { justifyContent: 'center' }]}>
              <ActivityIndicator size="large" color="#E94057" />
          </View>
      );
  }

  if (!profile) {
      return (
          <View style={[styles.container, { justifyContent: 'center' }]}>
              <Text style={{ fontSize: 18, color: '#666' }}>User not found</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                  <Text style={{ color: '#E94057', fontSize: 16 }}>Go Back</Text>
              </TouchableOpacity>
          </View>
      );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
      <Text style={styles.bio}>{profile?.bio || 'No bio available.'}</Text>

      {profile?.personality_type && (
          <View style={styles.personalityBadge}>
              <Text style={styles.personalityText}>✨ {profile.personality_type}</Text>
          </View>
      )}

      {profile && (
        <View style={styles.infoContainer}>
          {profile.detailed_bio ? (
              <View style={styles.section}>
                  <Text style={styles.sectionHeader}>About Me</Text>
                  <Text style={styles.sectionContent}>{profile.detailed_bio}</Text>
              </View>
          ) : null}

          {profile.partner_preferences ? (
              <View style={styles.section}>
                  <Text style={styles.sectionHeader}>Looking For</Text>
                  <Text style={styles.sectionContent}>{profile.partner_preferences}</Text>
              </View>
          ) : null}

          {profile.detailed_bio || profile.partner_preferences ? <View style={styles.divider} /> : null}

          {profile.age && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>🎂 Age:</Text>
              <Text style={styles.infoValue}>{profile.age}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 Country:</Text>
            <Text style={styles.infoValue}>{profile.country}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🗣 Language:</Text>
            <Text style={styles.infoValue}>{profile.language}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🌍 Ethnicity:</Text>
            <Text style={styles.infoValue}>{profile.ethnicity}</Text>
          </View>
          {profile.gender && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>⚧ Gender:</Text>
              <Text style={styles.infoValue}>{profile.gender}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>🎨 Hobbies:</Text>
            <Text style={styles.infoValue}>{profile.hobbies}</Text>
          </View>
        </View>
      )}

      {posts.length > 0 && (
          <View style={styles.postsSection}>
             <View style={styles.postsHeaderContainer}>
                <Text style={styles.postsTitle}>Posts</Text>
                <Text style={styles.postsCount}>{posts.length}</Text>
             </View>
             <View style={styles.postsGrid}>
                {posts.map((post) => (
                    <TouchableOpacity 
                        key={post.id} 
                        style={styles.postItem}
                        onPress={() => setSelectedImage(post.images[0])}
                    >
                        <Image source={{ uri: post.images[0] }} style={styles.postImage} />
                    </TouchableOpacity>
                ))}
             </View>
          </View>
      )}

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
            onPress={() => {
                navigation.replace('Login');
            }}
            >
                <Text style={[styles.settingText, { color: '#E94057' }]}>Logout</Text>
            </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionContainer}>
             <TouchableOpacity 
                 style={styles.messageButton}
                 onPress={handleMessage}
             >
                 <Text style={styles.messageButtonText}>💬 Message</Text>
             </TouchableOpacity>
         </View>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
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
  bio: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    paddingHorizontal: 30,
    textAlign: 'center',
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
  sectionHeader: {
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
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
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
  actionContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
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
