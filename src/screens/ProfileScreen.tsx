import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

interface UserProfile {
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
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
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
      loadProfile();
    }, [])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarContainer}>
        {profile?.image ? (
          <Image source={{ uri: profile.image }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
             <Text style={styles.avatarText}>Me</Text>
          </View>
        )}
      </View>
      
      <Text style={styles.name}>{profile?.username ? `@${profile.username}` : 'My Profile'}</Text>
      <Text style={styles.bio}>{profile?.bio || 'Software Developer looking for love ❤️'}</Text>

      {profile && (
        <View style={styles.infoContainer}>
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

      <View style={styles.settings}>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => navigation.navigate('ProfileSetup', { isEditing: true })}
        >
            <Text style={styles.settingText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingItem}>
            <Text style={styles.settingText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => {
            // For now just navigate back to Login. 
            // In a real app we might clear auth tokens.
            navigation.replace('Login');
          }}
        >
            <Text style={[styles.settingText, { color: '#E94057' }]}>Logout</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 30,
    paddingHorizontal: 30,
    textAlign: 'center',
  },
  infoContainer: {
    width: '90%',
    backgroundColor: '#f9f9f9',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
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
});
