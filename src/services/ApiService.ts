import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { API_BASE_URL } from '../config';

const BASE_URL = API_BASE_URL;

class ApiService {
  constructor() {
    if (__DEV__) {
      // console.log('ApiService initialized with BASE_URL:', BASE_URL);
    }
  }

  private handleError(method: string, error: any) {
    // console.error(`API Error (${method}):`, error);
    if (__DEV__) {
        const errorMessage = error.message || 'Unknown error';
        Alert.alert(
            'Connection Failed', 
            `Device: ${Platform.OS}\nTarget: ${BASE_URL}\nMethod: ${method}\nError: ${errorMessage}\n\n1. Check your Wi-Fi connection.\n2. Ensure device and server are on the same network.\n3. Verify IP: 192.168.68.88`
        );
    }
    return null;
  }

  private async fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}) {
    const { timeout = 10000 } = options as any;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    // Add header to bypass localtunnel reminder page
    const headers = {
        'bypass-tunnel-reminder': 'true',
        ...(options.headers || {})
    };
    
    try {
      const response = await fetch(resource, {
        ...options,
        headers,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  async getUsers(currentUserId?: string, page: number = 1, limit: number = 20) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/users?currentUserId=${currentUserId || ''}&page=${page}&limit=${limit}`);
      return await response.json();
    } catch (error) {
      this.handleError('getUsers', error);
      return [];
    }
  }

  async searchUsers(query: string, currentUserId?: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/users/search?q=${query}&currentUserId=${currentUserId || ''}`);
      return await response.json();
    } catch (error) {
      this.handleError('searchUsers', error);
      return [];
    }
  }

  async getUserById(id: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/users/${id}`);
      if (!response.ok) throw new Error('User not found');
      const data = await response.json();
      console.log('ApiService.getUserById response:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      this.handleError('getUserById', error);
      return null;
    }
  }

  async login(username: string, password: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error('Login failed');
      return await response.json();
    } catch (error) {
      this.handleError('login', error);
      throw error;
    }
  }

  async signup(userData: any) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Signup failed response:', errorText);
        throw new Error(`Signup failed: ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      this.handleError('signup', error);
      throw error;
    }
  }

  async updateUser(id: string, userData: any) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error('Update failed');
      return await response.json();
    } catch (error) {
      this.handleError('updateUser', error);
      throw error;
    }
  }

  async getMatches(userId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/matches?userId=${userId}`);
      const text = await response.text();
      try {
          return JSON.parse(text);
      } catch (e) {
          console.error('[ApiService] getMatches JSON Parse Error. Response Body:', text);
          throw e;
      }
    } catch (error) {
      this.handleError('getMatches', error);
      return [];
    }
  }

  async likeUser(fromUserId: string, toUserId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId, toUserId }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('likeUser', error);
      return null;
    }
  }

  async acceptMatch(matchId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/matches/${matchId}/accept`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      this.handleError('acceptMatch', error);
      return null;
    }
  }

  async declineMatch(matchId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/matches/${matchId}/decline`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      this.handleError('declineMatch', error);
      return null;
    }
  }

  async getMessages(matchId: string, page: number = 1, limit: number = 20) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/messages/${matchId}?page=${page}&limit=${limit}`);
      return await response.json();
    } catch (error) {
      this.handleError('getMessages', error);
      return [];
    }
  }

  async getPosts(currentUserId?: string, userId?: string, includeArchived: boolean = false, page: number = 1, limit: number = 10) {
    try {
      const url = `${BASE_URL}/posts?currentUserId=${currentUserId || ''}${userId ? `&userId=${userId}` : ''}&includeArchived=${includeArchived}&page=${page}&limit=${limit}`;
      const response = await this.fetchWithTimeout(url);
      return await response.json();
    } catch (error) {
      this.handleError('getPosts', error);
      return [];
    }
  }

  async archivePost(postId: number, archived: boolean) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/posts/${postId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('archivePost', error);
      throw error;
    }
  }

  async createPost(postData: any) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });
      if (!response.ok) throw new Error('Create post failed');
      return await response.json();
    } catch (error) {
      this.handleError('createPost', error);
      throw error;
    }
  }

  async likePost(postId: string, userId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('likePost', error);
      return null;
    }
  }

  async getComments(postId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/posts/${postId}/comments`);
      return await response.json();
    } catch (error) {
      this.handleError('getComments', error);
      return [];
    }
  }

  async addComment(postId: string, userId: string, text: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, text }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('addComment', error);
      return null;
    }
  }

  async searchMusic(term: string) {
    try {
      // Using iTunes Search API (free, no auth required)
      const response = await this.fetchWithTimeout(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=1`);
      const data = await response.json();
      if (data.resultCount > 0) {
        return {
          name: `${data.results[0].trackName} - ${data.results[0].artistName}`,
          previewUrl: data.results[0].previewUrl,
        };
      }
      return null;
    } catch (error) {
      console.error('Music Search Error:', error);
      return null;
    }
  }

  async sendMessage(matchId: string, senderId: string, text: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, senderId, text }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('sendMessage', error);
      return null;
    }
  }

  async sendOtp(phoneNumber: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('sendOtp', error);
      return { error: 'Network error' };
    }
  }

  async verifyOtp(phoneNumber: string, code: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('verifyOtp', error);
      return { error: 'Network error' };
    }
  }

  // --- Sport Events ---
  
  async getSportEvents(userId?: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/sport-events?userId=${userId || ''}`);
      const data = await response.json();
      if (!Array.isArray(data)) {
          return [];
      }
      return data;
    } catch (error) {
      this.handleError('getSportEvents', error);
      return [];
    }
  }

  async createSportEvent(eventData: any) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/sport-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });
      return await response.json();
    } catch (error) {
      this.handleError('createSportEvent', error);
      throw error;
    }
  }

  async joinSportEvent(eventId: string, userId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/sport-events/${eventId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('joinSportEvent', error);
      return null;
    }
  }

  async leaveSportEvent(eventId: string, userId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/sport-events/${eventId}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('leaveSportEvent', error);
      return null;
    }
  }

  async getDailyTopic(userId?: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/daily-topic?userId=${userId || ''}`);
      return await response.json();
    } catch (error) {
      this.handleError('getDailyTopic', error);
      return null;
    }
  }

  async voteDailyTopic(userId: string, topicId: string, choice: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/daily-topic/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, topicId, choice }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('voteDailyTopic', error);
      return { success: false };
    }
  }

  // Polls
  async getPolls(userId?: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/polls?userId=${userId || ''}`);
      return await response.json();
    } catch (error) {
      this.handleError('getPolls', error);
      return [];
    }
  }

  async createPoll(userId: string, question: string, options: string[]) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, question, options }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('createPoll', error);
      return { success: false };
    }
  }

  async votePoll(userId: string, pollId: string, choice: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, choice }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('votePoll', error);
      return { success: false };
    }
  }

  // Notifications
  async getNotifications(userId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/notifications?userId=${userId}`);
      return await response.json();
    } catch (error) {
      this.handleError('getNotifications', error);
      return [];
    }
  }

  async markNotificationsRead(userId: string) {
    try {
      await this.fetchWithTimeout(`${BASE_URL}/notifications/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      return { success: true };
    } catch (error) {
      this.handleError('markNotificationsRead', error);
      return { success: false };
    }
  }

  async reportUser(reporterId: string, reportedId: string, reason: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/users/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reporterId, reportedId, reason }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('reportUser', error);
      return null;
    }
  }

  async blockUser(blockerId: string, blockedId: string) {
    try {
      const response = await this.fetchWithTimeout(`${BASE_URL}/users/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blockerId, blockedId }),
      });
      return await response.json();
    } catch (error) {
      this.handleError('blockUser', error);
      return null;
    }
  }
}

export default new ApiService();
