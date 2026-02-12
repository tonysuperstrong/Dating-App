import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import ApiService from '../services/ApiService';

WebBrowser.maybeCompleteAuthSession();

type RootStackParamList = {
  Home: undefined;
  ProfileSetup: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleCredentialsLogin = useCallback(async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    try {
      // Trim inputs to avoid accidental spaces
      const user = await ApiService.login(username.trim(), password.trim());
      if (user) {
        // Save user profile to AsyncStorage for app-wide use
        await AsyncStorage.setItem('userProfile', JSON.stringify(user));
        navigation.replace('Home');
      } else {
        Alert.alert('Login Failed', 'Invalid credentials');
      }
    } catch (error) {
      // Login error
      Alert.alert('Login Failed', 'Invalid username or password');
    }
  }, [username, password, navigation]);

  // --- Google Sign-In Setup ---
  // You need to generate these Client IDs in the Google Cloud Console:
  // https://console.cloud.google.com/
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    expoClientId: 'YOUR_EXPO_CLIENT_ID', 
    iosClientId: 'YOUR_IOS_CLIENT_ID', 
    androidClientId: 'YOUR_ANDROID_CLIENT_ID', 
    webClientId: 'YOUR_WEB_CLIENT_ID', 
  } as any);

  // --- Facebook Login Setup ---
  // You need to create an App in the Meta for Developers console:
  // https://developers.facebook.com/
  const [facebookRequest, facebookResponse, promptFacebookAsync] = Facebook.useAuthRequest({
    clientId: 'YOUR_FACEBOOK_APP_ID', // Replace with your Facebook App ID
  });

  useEffect(() => {
    // Handle Google Response
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      // console.log('Google Login Success:', authentication);
      // In a real app, send authentication.accessToken to your backend
      navigation.navigate('ProfileSetup');
    }

    // Handle Facebook Response
    if (facebookResponse?.type === 'success') {
      const { authentication } = facebookResponse;
      // console.log('Facebook Login Success:', authentication);
      // In a real app, send authentication.accessToken to your backend
      navigation.navigate('ProfileSetup');
    }
  }, [googleResponse, facebookResponse]);

  const handleLogin = useCallback(async (provider: string) => {
    if (provider === 'Google') {
      // Check if we are using placeholder IDs
      if (!googleRequest || googleRequest?.clientId === 'YOUR_EXPO_CLIENT_ID' || googleRequest?.clientId === 'YOUR_IOS_CLIENT_ID') {
         // Mock successful login for demo purposes
         const mockUser = {
            id: 'mock-google-user',
            username: 'Google User',
            image: 'https://via.placeholder.com/150',
            bio: 'This is a demo account logged in via Google.',
            hobbies: 'Coding, Testing',
            country: 'Internet',
            language: 'English',
            ethnicity: 'AI',
            gender: 'Non-binary',
            age: '25'
         };
         
         Alert.alert(
           'Demo Mode', 
           'Google Client IDs are not configured. Simulating successful login...',
           [{ 
             text: 'OK', 
             onPress: async () => {
               await AsyncStorage.setItem('userProfile', JSON.stringify(mockUser));
               navigation.replace('Home');
             } 
           }]
         );
         return;
      }
      try {
        await promptGoogleAsync();
      } catch (e) {
        Alert.alert('Login Error', 'Failed to start Google Sign-In');
      }
    } else if (provider === 'Facebook') {
       if (!facebookRequest || facebookRequest?.clientId === 'YOUR_FACEBOOK_APP_ID') {
         // Mock successful login for demo purposes
         const mockUser = {
            id: 'mock-facebook-user',
            username: 'Facebook User',
            image: 'https://via.placeholder.com/150',
            bio: 'This is a demo account logged in via Facebook.',
            hobbies: 'Social Media, Sharing',
            country: 'Internet',
            language: 'English',
            ethnicity: 'AI',
            gender: 'Non-binary',
            age: '25'
         };

         Alert.alert(
           'Demo Mode', 
           'Facebook App ID is not configured. Simulating successful login...',
           [{ 
             text: 'OK', 
             onPress: async () => {
               await AsyncStorage.setItem('userProfile', JSON.stringify(mockUser));
               navigation.replace('Home');
             } 
           }]
         );
         return;
      }
      try {
        await promptFacebookAsync();
      } catch (e) {
        Alert.alert('Login Error', 'Failed to start Facebook Login');
      }
    } else if (provider === 'Instagram') {
      // Instagram Login is more complex and typically requires a custom webview flow or 'react-native-instagram-login'
      // which is often deprecated. For Expo Go, the best way is often via a generic OAuth flow or just linking manually.
      Alert.alert('Instagram Login', 'Instagram Login requires complex setup with the Instagram Basic Display API. Please use Google/Facebook for this demo.');
    }
  }, [googleRequest, facebookRequest, promptGoogleAsync, promptFacebookAsync, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dating App</Text>
      <Text style={styles.subtitle}>Find your perfect match!</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.loginButton} onPress={handleCredentialsLogin}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signupButton} onPress={() => navigation.navigate('ProfileSetup')}>
            <Text style={styles.signupButtonText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity 
        style={[styles.button, styles.googleButton]}
        onPress={() => handleLogin('Google')}
      >
        <Text style={[styles.buttonText, styles.googleText]}>Sign in with Google</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.facebookButton]}
        onPress={() => handleLogin('Facebook')}
      >
        <Text style={styles.buttonText}>Sign in with Facebook</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.instagramButton]}
        onPress={() => handleLogin('Instagram')}
      >
        <Text style={styles.buttonText}>Sign in with Instagram</Text>
      </TouchableOpacity>
      
      <Text style={styles.note}>
        * To enable actual login, you must add Client IDs in the code.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#E94057',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  signupButton: {
      marginTop: 15,
      alignItems: 'center',
  },
  signupButtonText: {
      color: '#E94057',
      fontSize: 16,
      fontWeight: '600',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
  },
  instagramButton: {
    backgroundColor: '#E1306C',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleText: {
    color: '#000',
  },
  note: {
    marginTop: 20,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  loginButton: {
    backgroundColor: '#E94057',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
  },
});
