import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, USERS } from '../data/users';
import ApiService from './ApiService';

const CHATS_KEY = 'user_chats';
const REQUESTS_KEY = 'incoming_requests';

export interface ChatSession {
  id: string; // match.id
  user: User;
  lastMessage: string;
  timestamp: number;
  status: 'active' | 'pending';
  initiatorId: string;
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
      // Get current user ID
      const profileString = await AsyncStorage.getItem('userProfile');
      if (!profileString) return [];
      const profile = JSON.parse(profileString);
      
      const matches = await ApiService.getMatches(profile.id);
      
      // Map backend matches to ChatSession
      const sessions = matches.map((m: any) => ({
        id: m.id, // match_id
        user: m.user,
        lastMessage: m.lastMessage || 'Start chatting!',
        timestamp: m.timestamp || Date.now(),
        status: m.status,
        initiatorId: m.user1_id
      }));
      console.log('ChatService: Mapped sessions:', JSON.stringify(sessions, null, 2));
      return sessions;
    } catch (error) {
      console.error('Error getting chats:', error);
      return [];
    }
  }

  // Add a chat (when I like someone, or accept a request)
  async addChat(user: User, status: 'active' | 'pending' = 'pending'): Promise<void> {
     // Legacy/Fallback support
     // In new flow, this is handled by ApiService.likeUser directly in DatePortalView
     console.log('ChatService.addChat called - prefer using ApiService.likeUser');
  }

  // Get incoming requests (notifications)
  async getIncomingRequests(): Promise<ConnectionRequest[]> {
    try {
      const chats = await this.getChats();
      const profileString = await AsyncStorage.getItem('userProfile');
      if (!profileString) return [];
      const profile = JSON.parse(profileString);

      // Filter for pending matches where I am NOT the initiator (meaning someone sent it to me)
      return chats
        .filter(c => c.status === 'pending' && String(c.initiatorId) !== String(profile.id))
        .map(c => ({
            id: c.id,
            fromUser: c.user,
            timestamp: c.timestamp,
            status: 'pending'
        }));
    } catch (error) {
      console.error('Error getting incoming requests:', error);
      return [];
    }
  }

  // Accept an incoming request
  async acceptRequest(requestId: string): Promise<void> {
    await ApiService.acceptMatch(requestId);
  }

  // Reject an incoming request
  async rejectRequest(requestId: string): Promise<void> {
    await ApiService.declineMatch(requestId);
  }

  // Clear all data (helper)
  async clearAll() {
      await AsyncStorage.removeItem(CHATS_KEY);
      await AsyncStorage.removeItem(REQUESTS_KEY);
  }
}

export default new ChatService();
