import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import { Ionicons } from '@expo/vector-icons';

interface UserProfile {
  id?: string;
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
  favorite_teams?: string[]; // Array of team names
  voice_bio?: string;
}

const POPULAR_TEAMS = [
    "Lakers", "Warriors", "Bulls", "Celtics", "Heat", "Knicks", // NBA
    "Man Utd", "Liverpool", "Arsenal", "Chelsea", "Man City", "Real Madrid", "Barcelona", // Soccer
    "Chiefs", "49ers", "Cowboys", "Eagles", "Packers", // NFL
    "Yankees", "Dodgers", "Red Sox", "Cubs" // MLB
];

export default function ProfileView() {
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [activeMode, setActiveMode] = useState<'dating' | 'sport'>('dating');
  
  // Sport Team State
  const [teamModalVisible, setTeamModalVisible] = useState(false);
  
  // Personality Test State
  const [answers, setAnswers] = useState({
    q1: '', // Introvert/Extrovert
    q2: '', // Indoor/Outdoor
    q3: '', // Plan/Spontaneous
    detailedBio: '',
    preferences: ''
  });

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile) {
        const parsedProfile = JSON.parse(storedProfile);
        setProfile(parsedProfile);
        
        // Fetch posts
        if (parsedProfile.id) {
            const posts = await ApiService.getPosts(parsedProfile.id, parsedProfile.id, true);
            setMyPosts(posts);
        }
      }
    } catch (error) {
      // Failed to load profile
    }
  };

  const handleToggleTeam = useCallback(async (team: string) => {
      if (!profile?.id) return;
      
      let currentTeams = profile.favorite_teams || [];
      let newTeams;
      
      if (currentTeams.includes(team)) {
          newTeams = currentTeams.filter(t => t !== team);
      } else {
          newTeams = [...currentTeams, team];
      }
      
      const updatedData = { ...profile, favorite_teams: newTeams };
      setProfile(updatedData); // Optimistic
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedData));
      await ApiService.updateUser(profile.id, updatedData);
  }, [profile]);

  const handleArchivePost = useCallback(async (post: any) => {
    const newStatus = !post.isArchived;
    const action = newStatus ? 'archive' : 'unarchive';
    
    Alert.alert(
      newStatus ? "Archive Post" : "Unarchive Post",
      `Are you sure you want to ${action} this post?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          style: newStatus ? "destructive" : "default",
          onPress: async () => {
            try {
              await ApiService.archivePost(post.id, newStatus);
              // Update local state
              setMyPosts(currentPosts => 
                currentPosts.map(p => 
                  p.id === post.id ? { ...p, isArchived: newStatus } : p
                )
              );
            } catch (error) {
              Alert.alert("Error", `Failed to ${action} post`);
            }
          }
        }
      ]
    );
  }, []);

  const handleSaveTest = useCallback(async () => {
    if (!profile?.id) return;

    // Simple logic to determine personality type based on answers
    const type = `${answers.q1} ${answers.q2} ${answers.q3}`;
    
    const updatedData = {
      ...profile,
      personality_type: type.trim() || profile.personality_type,
      detailed_bio: answers.detailedBio || profile.detailed_bio,
      partner_preferences: answers.preferences || profile.partner_preferences
    };

    try {
      await ApiService.updateUser(profile.id, updatedData);
      await AsyncStorage.setItem('userProfile', JSON.stringify(updatedData));
      setProfile(updatedData);
      setTestModalVisible(false);
      Alert.alert('Success', 'Your personality profile has been updated!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile details.');
    }
  }, [profile, answers]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Account</Text>
      </View>

      <View style={styles.avatarContainer}>
        {profile?.image && !profile.image.startsWith('#') ? (
          <Image source={{ uri: profile.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: profile?.image && profile.image.startsWith('#') ? profile.image : '#ddd' }]}>
             <Text style={styles.avatarText}>{profile?.username?.[0]?.toUpperCase() || 'Me'}</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.name}>{profile?.username ? `@${profile.username}` : 'My Profile'}</Text>
      <Text style={styles.bio}>{profile?.bio || 'No bio yet.'}</Text>
      
      {/* Mode Toggle */}
      <View style={styles.toggleContainer}>
          <TouchableOpacity 
              style={[styles.toggleButton, activeMode === 'dating' && styles.toggleButtonActive]}
              onPress={() => setActiveMode('dating')}
          >
              <Text style={[styles.toggleText, activeMode === 'dating' && styles.toggleTextActive]}>❤️ Dating</Text>
          </TouchableOpacity>
          <TouchableOpacity 
              style={[styles.toggleButton, activeMode === 'sport' && styles.toggleButtonActive]}
              onPress={() => setActiveMode('sport')}
          >
              <Text style={[styles.toggleText, activeMode === 'sport' && styles.toggleTextActive]}>⚽️ Sport</Text>
          </TouchableOpacity>
      </View>

      {/* DATING MODE CONTENT */}
      {activeMode === 'dating' && (
          <>
            {profile?.personality_type && (
                <View style={styles.personalityBadge}>
                    <Text style={styles.personalityText}>✨ {profile.personality_type}</Text>
                </View>
            )}

            {profile && (
                <View style={styles.infoContainer}>
                {profile.detailed_bio ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>About Me (Detailed)</Text>
                        <Text style={styles.sectionContent}>{profile.detailed_bio}</Text>
                    </View>
                ) : null}

                {profile.partner_preferences ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>Looking For</Text>
                        <Text style={styles.sectionContent}>{profile.partner_preferences}</Text>
                    </View>
                ) : null}

                {(profile.detailed_bio || profile.partner_preferences) && <View style={styles.divider} />}

                {profile.age && (
                    <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>🎂 Age:</Text>
                    <Text style={styles.infoValue}>{profile.age.toString()}</Text>
                    </View>
                )}
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>📍 Country:</Text>
                    <Text style={styles.infoValue}>{profile.location || 'Not set'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>🗣 Language:</Text>
                    <Text style={styles.infoValue}>{profile.language || 'Not set'}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>🌍 Ethnicity:</Text>
                    <Text style={styles.infoValue}>{profile.ethnicity || 'Not set'}</Text>
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
                        {Array.isArray(profile.hobbies) && profile.hobbies.length > 0 
                            ? profile.hobbies.join(', ') 
                            : typeof profile.hobbies === 'string' && profile.hobbies 
                                ? profile.hobbies 
                                : 'Not set'}
                    </Text>
                </View>
                </View>
            )}

            <View style={styles.settings}>
                <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setTestModalVisible(true)}
                >
                    <Text style={styles.actionButtonText}>📝 Take Personality Test</Text>
                </TouchableOpacity>
            </View>
          </>
      )}

      {/* SPORT MODE CONTENT */}
      {activeMode === 'sport' && (
          <>
            <View style={styles.infoContainer}>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                    <Text style={styles.sectionHeader}>My Favorite Teams</Text>
                    <TouchableOpacity onPress={() => setTeamModalVisible(true)}>
                        <Text style={{color: '#E94057', fontWeight: 'bold'}}>+ Add</Text>
                    </TouchableOpacity>
                </View>
                
                {(!profile?.favorite_teams || profile.favorite_teams.length === 0) ? (
                    <Text style={{color: '#999', fontStyle: 'italic'}}>No teams selected yet.</Text>
                ) : (
                    <View style={styles.teamsGrid}>
                        {profile.favorite_teams.map((team, index) => (
                            <View key={index} style={styles.teamBadge}>
                                <Text style={styles.teamText}>{team}</Text>
                                <TouchableOpacity onPress={() => handleToggleTeam(team)}>
                                    <Ionicons name="close-circle" size={16} color="#fff" style={{marginLeft: 5}} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </View>
            
            <View style={styles.infoContainer}>
                <Text style={styles.sectionHeader}>Sports Stats</Text>
                <Text style={{color: '#999', marginTop: 5}}>Coming soon... Track your match predictions and game attendance here.</Text>
            </View>
          </>
      )}

      {/* Shared Posts Section (Visible in both or just Dating? Let's keep it shared but maybe styled differently) */}
      <View style={styles.infoContainer}>
        <Text style={[styles.sectionHeader, { marginBottom: 15 }]}>My Posts</Text>
        {myPosts.length === 0 ? (
          <Text style={{ color: '#999', textAlign: 'center', fontStyle: 'italic' }}>No posts yet.</Text>
        ) : (
          myPosts.map((post) => (
            <View key={post.id} style={[styles.postCard, post.isArchived && styles.archivedPostCard]}>
               <View style={styles.postHeader}>
                 <Text style={styles.postDate}>{new Date(Number(post.timestamp)).toLocaleDateString()}</Text>
                 {post.isArchived && <View style={styles.archivedBadge}><Text style={styles.archivedText}>Archived</Text></View>}
               </View>
               <Text style={styles.postContent}>{post.content}</Text>
               {post.images && post.images.length > 0 && (
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.postImagesScroll}>
                   {post.images.map((img: string, idx: number) => (
                     <Image key={idx} source={{ uri: img }} style={styles.postImage} />
                   ))}
                 </ScrollView>
               )}
               <TouchableOpacity 
                 style={[styles.archiveButton, post.isArchived ? styles.unarchiveButton : null]}
                 onPress={() => handleArchivePost(post)}
               >
                 <Text style={[styles.archiveButtonText, post.isArchived ? styles.unarchiveButtonText : null]}>
                   {post.isArchived ? "Unarchive" : "Archive Post"}
                 </Text>
               </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.settings}>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => navigation.navigate('ProfileSetup', { isEditing: true })}
        >
            <Text style={styles.settingText}>Edit Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => navigation.replace('Login')}
        >
            <Text style={[styles.settingText, { color: '#E94057' }]}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Personality Test Modal */}
      <Modal
        visible={testModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Personality Profile</Text>
                <TouchableOpacity onPress={() => setTestModalVisible(false)}>
                    <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
                <Text style={styles.question}>1. How do you recharge?</Text>
                <View style={styles.optionsRow}>
                    <TouchableOpacity 
                        style={[styles.optionButton, answers.q1 === 'Introvert' && styles.optionSelected]}
                        onPress={() => setAnswers({...answers, q1: 'Introvert'})}
                    >
                        <Text style={[styles.optionText, answers.q1 === 'Introvert' && styles.optionTextSelected]}>Alone (Introvert)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.optionButton, answers.q1 === 'Extrovert' && styles.optionSelected]}
                        onPress={() => setAnswers({...answers, q1: 'Extrovert'})}
                    >
                        <Text style={[styles.optionText, answers.q1 === 'Extrovert' && styles.optionTextSelected]}>With Others (Extrovert)</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.question}>2. Ideal Weekend?</Text>
                <View style={styles.optionsRow}>
                    <TouchableOpacity 
                        style={[styles.optionButton, answers.q2 === 'Cozy' && styles.optionSelected]}
                        onPress={() => setAnswers({...answers, q2: 'Cozy'})}
                    >
                        <Text style={[styles.optionText, answers.q2 === 'Cozy' && styles.optionTextSelected]}>Cozy Indoors</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.optionButton, answers.q2 === 'Active' && styles.optionSelected]}
                        onPress={() => setAnswers({...answers, q2: 'Active'})}
                    >
                        <Text style={[styles.optionText, answers.q2 === 'Active' && styles.optionTextSelected]}>Active Outdoors</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.question}>3. Tell us more about yourself</Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="What makes you unique?"
                    multiline
                    value={answers.detailedBio}
                    onChangeText={(text) => setAnswers({...answers, detailedBio: text})}
                />

                <Text style={styles.question}>4. What are you looking for?</Text>
                <TextInput
                    style={styles.textArea}
                    placeholder="Describe your ideal partner..."
                    multiline
                    value={answers.preferences}
                    onChangeText={(text) => setAnswers({...answers, preferences: text})}
                />

                <TouchableOpacity style={styles.saveButton} onPress={handleSaveTest}>
                    <Text style={styles.saveButtonText}>Save Profile</Text>
                </TouchableOpacity>
                <View style={{height: 50}} />
            </ScrollView>
          </KeyboardAvoidingView>
      </Modal>

      {/* Team Selection Modal */}
      <Modal
        visible={teamModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
          <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Favorite Teams</Text>
                  <TouchableOpacity onPress={() => setTeamModalVisible(false)}>
                      <Text style={styles.closeText}>Done</Text>
                  </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalContent}>
                  <View style={styles.teamsList}>
                      {POPULAR_TEAMS.map(team => {
                          const isSelected = profile?.favorite_teams?.includes(team);
                          return (
                              <TouchableOpacity 
                                  key={team} 
                                  style={[styles.teamOption, isSelected && styles.teamOptionSelected]}
                                  onPress={() => handleToggleTeam(team)}
                              >
                                  <Text style={[styles.teamOptionText, isSelected && styles.teamOptionTextSelected]}>{team}</Text>
                                  {isSelected && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
                              </TouchableOpacity>
                          );
                      })}
                  </View>
              </ScrollView>
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
    paddingBottom: 100, // Space for bottom bar
  },
  header: {
    width: '100%',
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  avatarContainer: {
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
    marginBottom: 5,
  },
  bio: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    paddingHorizontal: 30,
    textAlign: 'center',
  },
  // Toggle Styles
  toggleContainer: {
      flexDirection: 'row',
      backgroundColor: '#f0f0f0',
      borderRadius: 25,
      padding: 4,
      marginBottom: 20,
      width: '80%',
  },
  toggleButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 22,
  },
  toggleButtonActive: {
      backgroundColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
  },
  toggleText: {
      color: '#999',
      fontWeight: 'bold',
  },
  toggleTextActive: {
      color: '#E94057',
  },
  // Team Styles
  teamsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
  },
  teamBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#E94057',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
  },
  teamText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 14,
  },
  teamsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      padding: 10,
  },
  teamOption: {
      width: '48%',
      padding: 15,
      backgroundColor: '#f9f9f9',
      borderRadius: 10,
      alignItems: 'center',
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
  },
  teamOptionSelected: {
      backgroundColor: '#E94057',
  },
  teamOptionText: {
      fontWeight: 'bold',
      color: '#333',
  },
  teamOptionTextSelected: {
      color: '#fff',
  },
  // Existing Styles
  personalityBadge: {
      backgroundColor: '#FFF0F3',
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#FFC1CC',
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
    marginBottom: 20,
  },
  section: {
      marginBottom: 15,
  },
  sectionHeader: {
      fontWeight: 'bold',
      fontSize: 16,
      marginBottom: 5,
      color: '#333',
  },
  sectionContent: {
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
  actionButton: {
      backgroundColor: '#E94057',
      padding: 15,
      borderRadius: 12,
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: '#E94057',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
  },
  actionButtonText: {
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
  },
  settingItem: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
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
      padding: 20,
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
  modalContent: {
      padding: 20,
  },
  question: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 15,
      marginTop: 10,
  },
  optionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
  },
  optionButton: {
      flex: 1,
      padding: 15,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 10,
      marginHorizontal: 5,
      alignItems: 'center',
  },
  optionSelected: {
      backgroundColor: '#E94057',
      borderColor: '#E94057',
  },
  optionText: {
      color: '#333',
      fontWeight: '500',
  },
  optionTextSelected: {
      color: '#fff',
  },
  // optionText duplicate removed
  textArea: {
      backgroundColor: '#f9f9f9',
      borderRadius: 10,
      padding: 15,
      height: 100,
      textAlignVertical: 'top',
      marginBottom: 20,
      fontSize: 16,
  },
  saveButton: {
      backgroundColor: '#E94057',
      padding: 18,
      borderRadius: 15,
      alignItems: 'center',
      marginTop: 10,
  },
  saveButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
  },
  // Post Styles
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  archivedPostCard: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  postDate: {
    fontSize: 12,
    color: '#999',
  },
  archivedBadge: {
    backgroundColor: '#666',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  archivedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  postContent: {
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  postImagesScroll: {
    marginBottom: 10,
  },
  postImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
  },
  archiveButton: {
    alignSelf: 'flex-end',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: '#fff0f0',
    borderWidth: 1,
    borderColor: '#ffcccb',
  },
  unarchiveButton: {
    backgroundColor: '#e6f7ff',
    borderColor: '#91d5ff',
  },
  archiveButtonText: {
    fontSize: 12,
    color: '#ff4d4f',
    fontWeight: 'bold',
  },
  unarchiveButtonText: {
    color: '#1890ff',
  },
});
