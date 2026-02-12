import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView, Image, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchAIResponse } from '../services/AIService';

interface PlanDetails {
  title: string;
  date: string;
  time: string;
  description: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  image?: string;
  locations?: { 
    name: string; 
    query: string;
    time?: string;
    description?: string;
  }[];
  link?: string; // Deprecated
  linkTitle?: string; // Deprecated
  planDetails?: PlanDetails;
}

type ConversationStep = 'init' | 'date_planning_vibe' | 'restaurant_cuisine' | 'travel_type';

const PUB_PREFIXES = ['The Old', 'The Royal', 'The Golden', 'The Rusty', 'The Happy', 'The Tipsy', 'The Black', 'The White', 'The Red'];
const PUB_SUFFIXES = ['Tavern', 'Lion', 'Anchor', 'Barrel', 'Taphouse', 'Goat', 'Swan', 'Bear', 'Horse', 'Eagle'];

const getRandomPubName = () => {
    const prefix = PUB_PREFIXES[Math.floor(Math.random() * PUB_PREFIXES.length)];
    const suffix = PUB_SUFFIXES[Math.floor(Math.random() * PUB_SUFFIXES.length)];
    return `${prefix} ${suffix}`;
};

export default function AiAssistantScreen() {
  const [step, setStep] = useState<ConversationStep>('init');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your AI Dating Assistant. I can help you find restaurants, plan date schedules, or suggest travel spots in your area. What do you need help with today?",
      sender: 'ai',
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [userLocation, setUserLocation] = useState('Unknown Location');
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation();

  useFocusEffect(
    React.useCallback(() => {
      loadLocation();
    }, [])
  );

  const loadLocation = React.useCallback(async () => {
    try {
      // 1. Try to get real-time location first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        if (reverseGeocode.length > 0) {
            const address = reverseGeocode[0];
            const city = address.city || address.subregion || address.region;
            const country = address.country;
            const locationString = city ? `${city}, ${country}` : country || 'Unknown Location';
            
            // console.log('AI Assistant: Refreshed real-time location:', locationString);
            setUserLocation(locationString);
            // Optionally update AsyncStorage too
            await AsyncStorage.setItem('userLocation', locationString);
            return;
        }
      }

      // 2. Fallback to AsyncStorage
      const storedLocation = await AsyncStorage.getItem('userLocation');
      if (storedLocation) {
        setUserLocation(storedLocation);
      }
    } catch (error) {
      // console.error('Failed to load location', error);
      // Fallback to AsyncStorage if live fetch fails
      const storedLocation = await AsyncStorage.getItem('userLocation');
      if (storedLocation) {
        setUserLocation(storedLocation);
      }
    }
  }, []);

  const handleSavePlan = React.useCallback(async (plan: PlanDetails) => {
    try {
      const storedEvents = await AsyncStorage.getItem('scheduleEvents');
      const events = storedEvents ? JSON.parse(storedEvents) : [];
      
      const newEvent = {
        id: Date.now().toString(),
        date: plan.date,
        title: plan.title,
        time: plan.time,
        description: plan.description,
      };
      
      await AsyncStorage.setItem('scheduleEvents', JSON.stringify([...events, newEvent]));
      Alert.alert(
        'Success', 
        'Plan saved to your schedule!',
        [
            { text: 'OK' },
            { text: 'View Schedule', onPress: () => navigation.navigate('Schedule' as never) }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save plan');
    }
  }, [navigation]);

  const generateMockResponse = React.useCallback((query: string) => {
    let responseText = '';
    let image: string | undefined;
    let locations: { name: string; query: string }[] | undefined;
    let planDetails: PlanDetails | undefined;

    const lowerQuery = query.toLowerCase();
    const location = userLocation || "your area";
    // Force location refresh from state just in case
    // console.log("Generating response for location:", location);

    let nextStep = step;
    const today = new Date().toISOString().split('T')[0];

    // Reset command
    if (['reset', 'start', 'hello', 'hi', 'menu'].some(w => lowerQuery.includes(w))) {
         nextStep = 'init';
         setStep('init');
         responseText = "Let's start over! Do you want to plan a Date, find a Restaurant, or plan a Trip?";
    } else {
        switch (step) {
            case 'init':
                if (lowerQuery.includes('date') || lowerQuery.includes('plan')) {
                    nextStep = 'date_planning_vibe';
                    responseText = "I'd love to help plan a date! What kind of vibe are you looking for?\n\n• Romantic ❤️\n• Active/Adventure 🧗\n• Casual/Chill ☕";
                } else if (lowerQuery.includes('restaurant') || lowerQuery.includes('food') || lowerQuery.includes('eat')) {
                    nextStep = 'restaurant_cuisine';
                    responseText = `Yum! Dining in ${location}. What cuisine do you prefer?\n\n• Italian 🍝\n• Japanese 🍣\n• Local 🍔\n• Surprise Me 🎲`;
                } else if (lowerQuery.includes('travel') || lowerQuery.includes('trip')) {
                    nextStep = 'travel_type';
                    responseText = `Exciting! For a trip near ${location}, what's your style?\n\n• Nature 🌲\n• City Break 🏙️\n• Relaxing 🏖️`;
                } else if (lowerQuery.includes('pub') || lowerQuery.includes('bar') || lowerQuery.includes('drink')) {
                     nextStep = 'init'; // Reset after answer
                     
                     // Randomize mock data
                     const pub1 = getRandomPubName();
                     const pub2 = getRandomPubName();
                     const pub3 = getRandomPubName();
                     
                     responseText = `🍻 **Pubs & Bars in ${location}**\n\nHere are some popular spots:\n\n1. **${pub1}**: Classic vibes and great ales.\n2. **${pub2}**: Cocktails with a view.\n3. **${pub3}**: Best local craft beers.`;
                     image = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=500';
                     locations = [
                         { name: pub1, query: `${pub1} in ${location}` },
                         { name: pub2, query: `${pub2} in ${location}` },
                         { name: pub3, query: `${pub3} in ${location}` }
                     ];
                } else {
                    responseText = "I'm not sure I understood. Could you tell me if you want to:\n\n1. Plan a Date 📅\n2. Find a Restaurant 🍽️\n3. Plan a Trip ✈️";
                }
                break;

            case 'date_planning_vibe':
                if (lowerQuery.includes('romantic')) {
                    responseText = `💖 **Romantic Date in ${location}**\n\nI've designed a lovely evening for you:\n\n1. **Sunset Stroll**: Start at the City Botanical Gardens.\n2. **Dinner**: Candlelit dinner at 'Le Petit Bistro'.\n3. **Drinks**: Rooftop jazz at 'The Moon Lounge'.`;
                    image = 'https://images.unsplash.com/photo-1520854221256-17451cc330e7?w=500';
                    locations = [
                        { name: 'City Botanical Gardens', query: `City Botanical Gardens in ${location}` },
                        { name: 'Le Petit Bistro', query: `Le Petit Bistro in ${location}` },
                        { name: 'The Moon Lounge', query: `The Moon Lounge in ${location}` }
                    ];
                    planDetails = {
                        title: 'Romantic Date Night',
                        date: today,
                        time: '18:00',
                        description: `Romantic Date in ${location}\n\n• 18:00 - Sunset Stroll at Botanical Gardens\n• 19:30 - Dinner at Le Petit Bistro\n• 21:00 - Drinks at The Moon Lounge`
                    };
                } else if (lowerQuery.includes('active') || lowerQuery.includes('adventur')) {
                    responseText = `🧗 **Adventure Date in ${location}**\n\nGet your heart racing!\n\n1. **Activity**: Rock climbing at 'Peak Ascent'.\n2. **Lunch**: Healthy fuel at 'Green Power Cafe'.\n3. **Afternoon**: Kayaking on the river.`;
                    image = 'https://images.unsplash.com/photo-1526547541286-73a7aaa08f2a?w=500';
                    locations = [
                        { name: 'Peak Ascent', query: `Peak Ascent rock climbing in ${location}` },
                        { name: 'Green Power Cafe', query: `Green Power Cafe in ${location}` },
                        { name: 'River Kayaking', query: `Kayaking near ${location}` }
                    ];
                    planDetails = {
                        title: 'Adventure Day',
                        date: today,
                        time: '10:00',
                        description: `Adventure Date in ${location}\n\n• 10:00 - Rock climbing at Peak Ascent\n• 12:30 - Lunch at Green Power Cafe\n• 14:00 - Kayaking on the river`
                    };
                } else {
                    responseText = `😊 **Casual Date in ${location}**\n\nKeep it simple and fun:\n\n1. **Morning**: Coffee and pastries at 'Daily Brew'.\n2. **Activity**: Visit the Modern Art Gallery.\n3. **Lunch**: Famous burgers at 'The Joint'.`;
                    image = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500';
                    locations = [
                        { name: 'Daily Brew', query: `Daily Brew coffee in ${location}` },
                        { name: 'Modern Art Gallery', query: `Modern Art Gallery in ${location}` },
                        { name: 'The Joint', query: `The Joint burgers in ${location}` }
                    ];
                    planDetails = {
                        title: 'Casual Hangout',
                        date: today,
                        time: '11:00',
                        description: `Casual Date in ${location}\n\n• 11:00 - Coffee at Daily Brew\n• 12:30 - Modern Art Gallery\n• 14:00 - Lunch at The Joint`
                    };
                }
                responseText += "\n\n(Say 'reset' to start over)";
                nextStep = 'init';
                break;

            case 'restaurant_cuisine':
                if (lowerQuery.includes('italian')) {
                    responseText = `🍝 **Italian Picks in ${location}**\n\n**Luigi's Trattoria**\nAuthentic handmade pasta and wood-fired pizza.\n\n**Bella Roma**\nGreat wine list and romantic atmosphere.`;
                    image = 'https://images.unsplash.com/photo-1498579150354-977475b7ea0b?w=500';
                    locations = [
                        { name: "Luigi's Trattoria", query: `Luigi's Trattoria in ${location}` },
                        { name: "Bella Roma", query: `Bella Roma in ${location}` }
                    ];
                } else if (lowerQuery.includes('japanese') || lowerQuery.includes('sushi')) {
                    responseText = `🍣 **Japanese Spots in ${location}**\n\n**Sakura Sushi**\nFresh omakase and private booths.\n\n**Tokyo Ramen**\nRich tonkotsu broth and gyoza.`;
                    image = 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500';
                    locations = [
                        { name: "Sakura Sushi", query: `Sakura Sushi in ${location}` },
                        { name: "Tokyo Ramen", query: `Tokyo Ramen in ${location}` }
                    ];
                } else {
                    responseText = `🍽️ **Top Picks in ${location}**\n\n**The Local Grill**\nBest steaks in town.\n\n**Ocean Blue**\nFresh seafood with a view.`;
                    image = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500';
                    locations = [
                        { name: "The Local Grill", query: `The Local Grill in ${location}` },
                        { name: "Ocean Blue", query: `Ocean Blue in ${location}` }
                    ];
                }
                responseText += "\n\n(Say 'reset' to start over)";
                nextStep = 'init';
                break;
            
            case 'travel_type':
                if (lowerQuery.includes('nature')) {
                    responseText = `🌲 **Nature Escape near ${location}**\n\n**Crystal Lake**\nRent a cabin, go fishing, and hike the trails.\n\n**Green Valley**\nA perfect spot for camping under the stars.`;
                    image = 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=500';
                    locations = [
                        { name: "Crystal Lake", query: `Crystal Lake near ${location}` },
                        { name: "Green Valley", query: `Green Valley camping near ${location}` }
                    ];
                } else if (lowerQuery.includes('city')) {
                    responseText = `🏙️ **City Break**\n\n**Downtown Art District**\nGalleries, street art, and hip cafes.\n\n**Skyline Deck**\nPanoramic views of the city at sunset.`;
                    image = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=500';
                    locations = [
                        { name: "Downtown Art District", query: `Art District in ${location}` },
                        { name: "Skyline Deck", query: `Skyline Deck in ${location}` }
                    ];
                } else {
                    responseText = `🏖️ **Relaxing Getaway**\n\n**Seaside Cove**\nSun, sand, and surf. Perfect for a picnic.\n\n**Mountain Spa Resort**\nHot springs and massages to unwind.`;
                    image = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500';
                    locations = [
                        { name: "Seaside Cove", query: `Seaside Cove near ${location}` },
                        { name: "Mountain Spa Resort", query: `Mountain Spa Resort near ${location}` }
                    ];
                }
                responseText += "\n\n(Say 'reset' to start over)";
                nextStep = 'init';
                break;
        }
    }
    
    setStep(nextStep);

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: responseText,
      sender: 'ai',
      timestamp: Date.now(),
      image,
      locations,
      planDetails,
    };

    setMessages((prev) => [...prev, aiMessage]);
    setIsTyping(false);
  }, [step, userLocation]);

  const generateAiResponse = React.useCallback(async (query: string) => {
    try {
        // Construct history from recent messages (last 30 to keep more context)
        const history = messages.slice(-30).map(m => ({
            role: m.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: m.text
        }));

        const aiData = await fetchAIResponse(query, userLocation, history);

        if (aiData) {
            // Use Real AI Data
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: aiData.text,
                sender: 'ai',
                timestamp: Date.now(),
                image: aiData.imageKeyword ? `https://source.unsplash.com/600x400/?${encodeURIComponent(aiData.imageKeyword)}` : undefined,
                locations: aiData.locations || (aiData.locationQuery ? [{ name: aiData.locationName || 'View on Maps', query: aiData.locationQuery }] : undefined),
                planDetails: aiData.planDetails
            };
            setMessages((prev) => [...prev, aiMessage]);
            setIsTyping(false);
            return;
        }
    } catch (error) {
        // console.error("AI Service failed, falling back to mock", error);
    }

    // Fallback to Mock Logic if API fails or returns null
    generateMockResponse(query);
  }, [messages, userLocation, generateMockResponse]);

  const handleSend = React.useCallback(() => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Call AI Service
    generateAiResponse(userMessage.text);
  }, [inputText, generateAiResponse]);

  const renderMessage = React.useCallback(({ item }: { item: Message }) => (
    <View style={[
      styles.messageBubble, 
      item.sender === 'user' ? styles.userBubble : styles.aiBubble
    ]}>
      <Text style={[
        styles.messageText, 
        item.sender === 'user' ? styles.userText : styles.aiText
      ]}>{item.text}</Text>
      
      {item.image && (
        <Image 
          source={{ uri: item.image }} 
          style={styles.messageImage} 
          resizeMode="cover"
        />
      )}

      {item.locations && item.locations.length > 0 && (
        <View style={styles.linksContainer}>
            {item.locations.map((loc, index) => (
                <TouchableOpacity 
                    key={index}
                    onPress={() => Linking.openURL(`https://www.google.com/maps/search/${encodeURIComponent(loc.query)}`)} 
                    style={styles.locationCard}
                >
                    <View style={styles.locationHeader}>
                      <Text style={styles.locationName}>📍 {loc.name}</Text>
                      {loc.time && <Text style={styles.locationTime}>{loc.time}</Text>}
                    </View>
                    {loc.description && <Text style={styles.locationDescription}>{loc.description}</Text>}
                </TouchableOpacity>
            ))}
        </View>
      )}

      {/* Backward compatibility for old messages */}
      {!item.locations && item.link && (
        <TouchableOpacity onPress={() => Linking.openURL(item.link!)} style={styles.linkButton}>
          <Text style={styles.linkText}>{item.linkTitle || 'View on Maps'}</Text>
        </TouchableOpacity>
      )}

      {item.planDetails && (
        <TouchableOpacity 
          onPress={() => item.planDetails && handleSavePlan(item.planDetails)} 
          style={styles.confirmPlanButton}
        >
          <Text style={styles.confirmPlanText}>Confirm Plan & Save</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [handleSavePlan]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Assistant</Text>
        <View style={{ width: 50 }} /> 
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {isTyping && (
        <View style={styles.typingContainer}>
          <ActivityIndicator size="small" color="#E94057" />
          <Text style={styles.typingText}>AI is typing...</Text>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          placeholder="Ask for date ideas..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  backButtonText: {
    color: '#E94057',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  messagesContainer: {
    padding: 15,
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#E94057',
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 2,
  },
  messageImage: {
    width: 200,
    height: 120,
    borderRadius: 10,
    marginTop: 10,
  },
  linksContainer: {
    marginTop: 10,
    width: '100%',
  },
  locationCard: {
    marginTop: 8,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationName: {
    color: '#007AFF',
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
  locationTime: {
    color: '#E94057',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 8,
  },
  locationDescription: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    marginTop: 5,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmPlanButton: {
    marginTop: 10,
    backgroundColor: '#34C759', // Green for confirmation
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  confirmPlanText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingLeft: 20,
  },
  typingText: {
    marginLeft: 10,
    color: '#888',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#E94057',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
