import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../data/users';
import ApiService from './ApiService';

export interface ChatSession {
  id: string; // match.id
  user: User;
  lastMessage: string;
  timestamp: number;
  status: 'active' | 'pending';
  initiatorId: string;
  lastMessageSenderId?: string;
}

export interface ConnectionRequest {
  id: string; // unique request id
  fromUser: User;
  timestamp: number;
  status: 'pending';
}

class ChatService {
  // Get all active chats
  async getChats(currentUserId?: string): Promise<ChatSession[]> {
    try {
      // Get current user ID
      let profileId = currentUserId;
      if (!profileId) {
        const profileString = await AsyncStorage.getItem('userProfile');
        if (!profileString) return [];
        const profile = JSON.parse(profileString);
        profileId = profile.id;
      }
      
      const matches = await ApiService.getMatches(profileId as string);
      
      // Map backend matches to ChatSession
      const sessions = matches.map((m: any) => ({
        id: m.id, // match_id
        user: m.user,
        lastMessage: m.lastMessage || 'Start chatting!',
        timestamp: m.timestamp || Date.now(),
        status: m.status,
        initiatorId: m.user1_id,
        lastMessageSenderId: m.lastMessageSenderId
      }));

      // Sort by timestamp descending (newest first)
      sessions.sort((a: ChatSession, b: ChatSession) => b.timestamp - a.timestamp);

      // Deduplicate sessions by Partner ID (user.id)
      // This ensures we only show one chat per person, even if multiple matches exist
      const uniqueSessionsMap = new Map();
      sessions.forEach((s: ChatSession) => {
          if (!uniqueSessionsMap.has(s.user.id)) {
              uniqueSessionsMap.set(s.user.id, s);
          }
      });
      
      const uniqueSessions = Array.from(uniqueSessionsMap.values()) as ChatSession[];
      
      return uniqueSessions;
    } catch (error) {
      console.error('Error getting chats:', error);
      return [];
    }
  }

  // Add a chat (when I like someone, or accept a request)
  // Legacy/Fallback support - removed
  // async addChat(user: User, status: 'active' | 'pending' = 'pending'): Promise<void> {}

  // Get incoming requests (notifications)
  async getIncomingRequests(currentUserId?: string): Promise<ConnectionRequest[]> {
    try {
      let profileId = currentUserId;
      if (!profileId) {
        const profileString = await AsyncStorage.getItem('userProfile');
        if (!profileString) return [];
        const profile = JSON.parse(profileString);
        profileId = profile.id;
      }

      const chats = await this.getChats(profileId);

      // Filter for pending matches where I am NOT the initiator (meaning someone sent it to me)
      return chats
        .filter(c => c.status === 'pending' && String(c.initiatorId) !== String(profileId))
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
      // No local storage for chats anymore
  }
}

export default new ChatService();
