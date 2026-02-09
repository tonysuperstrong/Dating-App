import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';

const BASE_URL = API_BASE_URL;

class ApiService {
  async getUsers(currentUserId?: string) {
    try {
      console.log(`Fetching users from: ${BASE_URL}/users`);
      const response = await fetch(`${BASE_URL}/users?currentUserId=${currentUserId || ''}`);
      return await response.json();
    } catch (error) {
      console.error('API Error (getUsers):', error);
      return [];
    }
  }

  async searchUsers(query: string, currentUserId?: string) {
    try {
      const response = await fetch(`${BASE_URL}/users/search?q=${query}&currentUserId=${currentUserId || ''}`);
      return await response.json();
    } catch (error) {
      console.error('API Error (searchUsers):', error);
      return [];
    }
  }

  async getUserById(id: string) {
    try {
      const response = await fetch(`${BASE_URL}/users/${id}`);
      if (!response.ok) throw new Error('User not found');
      return await response.json();
    } catch (error) {
      console.error('API Error (getUserById):', error);
      return null;
    }
  }

  async login(username: string, password: string) {
    try {
      console.log(`Logging in at: ${BASE_URL}/login`);
      const response = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error('Login failed');
      return await response.json();
    } catch (error) {
      console.error('API Error (login):', error);
      throw error;
    }
  }

  async signup(userData: any) {
    try {
      console.log(`Signing up at: ${BASE_URL}/signup`);
      const response = await fetch(`${BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error('Signup failed');
      return await response.json();
    } catch (error) {
      console.error('API Error (signup):', error);
      throw error;
    }
  }

  async updateUser(id: string, userData: any) {
    try {
      const response = await fetch(`${BASE_URL}/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) throw new Error('Update failed');
      return await response.json();
    } catch (error) {
      console.error('API Error (updateUser):', error);
      throw error;
    }
  }

  async getMatches(userId: string) {
    try {
      const response = await fetch(`${BASE_URL}/matches?userId=${userId}`);
      return await response.json();
    } catch (error) {
      console.error('API Error (getMatches):', error);
      return [];
    }
  }

  async likeUser(fromUserId: string, toUserId: string) {
    try {
      const response = await fetch(`${BASE_URL}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId, toUserId }),
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (likeUser):', error);
      return null;
    }
  }

  async acceptMatch(matchId: string) {
    try {
      const response = await fetch(`${BASE_URL}/matches/${matchId}/accept`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (acceptMatch):', error);
      return null;
    }
  }

  async declineMatch(matchId: string) {
    try {
      const response = await fetch(`${BASE_URL}/matches/${matchId}/decline`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (declineMatch):', error);
      return null;
    }
  }

  async getMessages(matchId: string) {
    try {
      const response = await fetch(`${BASE_URL}/messages/${matchId}`);
      return await response.json();
    } catch (error) {
      console.error('API Error (getMessages):', error);
      return [];
    }
  }

  async getPosts(currentUserId?: string, userId?: string) {
    try {
      const url = `${BASE_URL}/posts?currentUserId=${currentUserId || ''}${userId ? `&userId=${userId}` : ''}`;
      console.log(`Fetching posts from: ${url}`);
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('API Error (getPosts):', error);
      return [];
    }
  }

  async createPost(postData: any) {
    try {
      console.log(`Creating post at: ${BASE_URL}/posts`);
      const response = await fetch(`${BASE_URL}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });
      if (!response.ok) throw new Error('Create post failed');
      return await response.json();
    } catch (error) {
      console.error('API Error (createPost):', error);
      throw error;
    }
  }

  async likePost(postId: string, userId: string) {
    try {
      const response = await fetch(`${BASE_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (likePost):', error);
      return null;
    }
  }

  async getComments(postId: string) {
    try {
      const response = await fetch(`${BASE_URL}/posts/${postId}/comments`);
      return await response.json();
    } catch (error) {
      console.error('API Error (getComments):', error);
      return [];
    }
  }

  async addComment(postId: string, userId: string, text: string) {
    try {
      const response = await fetch(`${BASE_URL}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, text }),
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (addComment):', error);
      return null;
    }
  }

  async searchMusic(term: string) {
    try {
      // Using iTunes Search API (free, no auth required)
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=1`);
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
      const response = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, senderId, text }),
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (sendMessage):', error);
      return null;
    }
  }

  async sendOtp(phoneNumber: string) {
    try {
      const response = await fetch(`${BASE_URL}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (sendOtp):', error);
      return { success: false, error: 'Network error' };
    }
  }

  async verifyOtp(phoneNumber: string, code: string) {
    try {
      const response = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code }),
      });
      return await response.json();
    } catch (error) {
      console.error('API Error (verifyOtp):', error);
      return { success: false, error: 'Network error' };
    }
  }
}

export default new ApiService();
