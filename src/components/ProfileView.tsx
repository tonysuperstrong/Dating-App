import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

interface UserProfile {
  id?: string;
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

export default function ProfileView() {
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  
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
        setProfile(JSON.parse(storedProfile));
      }
    } catch (error) {
      console.error('Failed to load profile', error);
    }
  };

  const handleSaveTest = async () => {
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
  };

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

          <View style={styles.divider} />

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
            <Text style={styles.infoLabel}>🎨 Hobbies:</Text>
            <Text style={styles.infoValue}>{profile.hobbies}</Text>
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
    marginBottom: 10,
    paddingHorizontal: 30,
    textAlign: 'center',
  },
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
  },
  optionTextSelected: {
      color: '#fff',
      fontWeight: 'bold',
  },
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
});
