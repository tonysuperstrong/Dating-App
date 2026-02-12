import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import AiAssistantScreen from './src/screens/AiAssistantScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import MapScreen from './src/screens/MapScreen';
import { StatusBar } from 'expo-status-bar';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#fff' }
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen 
          name="ProfileSetup" 
          component={ProfileSetupScreen} 
          options={({ route }: any) => ({
            headerShown: true,
            headerTitle: route.params?.isEditing ? 'Edit Profile' : 'Setup Profile',
            headerTintColor: '#E94057',
            // headerLeft: route.params?.isEditing ? undefined : () => null, // Allow back button for all
          })}
        />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen 
          name="Chat" 
          component={ChatScreen} 
          options={{ 
            headerShown: true,
            headerTitle: 'Messages',
            headerTintColor: '#E94057',
          }} 
        />
        <Stack.Screen 
          name="ChatDetail" 
          component={ChatDetailScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen} 
          options={{ 
            headerShown: true,
            headerTitle: 'Profile',
            headerTintColor: '#E94057',
          }} 
        />
        <Stack.Screen 
          name="AiAssistant" 
          component={AiAssistantScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Schedule" 
          component={ScheduleScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Map" 
          component={MapScreen} 
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
