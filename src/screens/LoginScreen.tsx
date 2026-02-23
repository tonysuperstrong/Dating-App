import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import ApiService from '../services/ApiService';

type RootStackParamList = {
  Home: undefined;
  ProfileSetup: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync()
        .then(setIsAppleAvailable)
        .catch(() => setIsAppleAvailable(false));
    }
  }, []);

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

  const handleAppleLogin = useCallback(async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const user = await ApiService.loginWithApple(
        credential.user,
        credential.email || undefined,
        credential.fullName?.givenName || undefined
      );

      await AsyncStorage.setItem('userProfile', JSON.stringify(user));
      navigation.replace('Home');
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED') {
        return;
      }
      Alert.alert('Login Error', 'Failed to sign in with Apple');
    }
  }, [navigation]);

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

      {isAppleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={30}
          style={styles.appleButton}
          onPress={handleAppleLogin}
        />
      )}
      
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
  appleButton: {
    width: '100%',
    height: 50,
    marginBottom: 15,
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
