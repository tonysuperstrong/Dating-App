import { API_BASE_URL } from '../config';

export interface ScheduledDate {
  id: string;
  sender_id: string;
  receiver_id: string;
  date: string;
  time: string;
  location: string;
  description: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  sender_name?: string;
  sender_image?: string;
  receiver_name?: string;
  receiver_image?: string;
}

const DateService = {
  getDates: async (userId: string): Promise<ScheduledDate[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/dates?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch dates');
      return await response.json();
    } catch (error) {
      console.error('DateService.getDates error:', error);
      return [];
    }
  },

  requestDate: async (data: { 
    sender_id: string; 
    receiver_id: string; 
    date: string; 
    time: string; 
    location: string; 
    description?: string; 
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create date request');
      return await response.json();
    } catch (error) {
      console.error('DateService.requestDate error:', error);
      throw error;
    }
  },

  updateDateStatus: async (id: string, status: 'accepted' | 'rejected' | 'cancelled') => {
    try {
      const response = await fetch(`${API_BASE_URL}/dates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update date status');
      return await response.json();
    } catch (error) {
      console.error('DateService.updateDateStatus error:', error);
      throw error;
    }
  }
};

export default DateService;
