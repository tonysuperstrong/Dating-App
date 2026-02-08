import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, USERS } from '../data/users';

const CHATS_KEY = 'user_chats';
const REQUESTS_KEY = 'incoming_requests';

export interface ChatSession {
  id: string; // usually user.id
  user: User;
  lastMessage: string;
  timestamp: number;
  status: 'active' | 'pending';
}

export interface ConnectionRequest {
  id: string; // unique request id
  fromUser: User;
  timestamp: number;
  status: 'pending';
}

class ChatService {
  // Get all active chats
  async getChats(): Promise<ChatSession[]> {
    try {
      const data = await AsyncStorage.getItem(CHATS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting chats:', error);
      return [];
    }
  }

  // Add a chat (when I like someone, or accept a request)
  async addChat(user: User, status: 'active' | 'pending' = 'pending'): Promise<void> {
    const chats = await this.getChats();
    // Check if already exists
    if (chats.some(c => c.user.id === user.id)) return;

    const newChat: ChatSession = {
      id: user.id,
      user,
      lastMessage: status === 'active' ? 'You matched! Say hi 👋' : 'Waiting for response...',
      timestamp: Date.now(),
      status
    };

    const updatedChats = [newChat, ...chats];
    await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(updatedChats));
  }

  // Get incoming requests (notifications)
  async getIncomingRequests(): Promise<ConnectionRequest[]> {
    try {
      const data = await AsyncStorage.getItem(REQUESTS_KEY);
      if (data) return JSON.parse(data);
      
      // Initialize with mock data if empty (Simulated "The Date" liking "Me")
      const initialMockRequests: ConnectionRequest[] = [
        {
          id: 'req_1',
          fromUser: USERS.find(u => u.name === 'Sophia') || USERS[0],
          timestamp: Date.now() - 3600000,
          status: 'pending' as const
        },
        {
            id: 'req_2',
            fromUser: USERS.find(u => u.name === 'Mia') || USERS[3],
            timestamp: Date.now() - 7200000,
            status: 'pending' as const
        }
      ].filter(req => req.fromUser); // Ensure user exists

      await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(initialMockRequests));
      return initialMockRequests;
    } catch (error) {
      console.error('Error getting requests:', error);
      return [];
    }
  }

  // Accept an incoming request
  async acceptRequest(requestId: string): Promise<void> {
    const requests = await this.getIncomingRequests();
    const request = requests.find(r => r.id === requestId);
    
    if (request) {
      // Add to chats as active
      await this.addChat(request.fromUser, 'active');
      
      // Remove from requests
      const updatedRequests = requests.filter(r => r.id !== requestId);
      await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(updatedRequests));
    }
  }

  // Reject an incoming request
  async rejectRequest(requestId: string): Promise<void> {
    const requests = await this.getIncomingRequests();
    const updatedRequests = requests.filter(r => r.id !== requestId);
    await AsyncStorage.setItem(REQUESTS_KEY, JSON.stringify(updatedRequests));
  }

  // Clear all data (helper)
  async clearAll() {
      await AsyncStorage.removeItem(CHATS_KEY);
      await AsyncStorage.removeItem(REQUESTS_KEY);
  }
}

export default new ChatService();
