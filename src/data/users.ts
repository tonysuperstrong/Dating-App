export interface User {
  id: string;
  username?: string; // Optional because legacy mocks don't have it
  name: string;
  age: number;
  bio: string;
  image: string; // URL or placeholder color
  type: 'date' | 'sport';
  location: string;
  hobbies: string[];
  phone_number?: string; // Added for call feature verification
}

export const USERS: User[] = [
  {
    id: '1',
    name: 'Jessica',
    age: 24,
    bio: 'Loves hiking and coffee ☕️',
    image: '#FF6B6B',
    type: 'date',
    location: 'New York, USA',
    hobbies: ['Hiking', 'Coffee', 'Photography'],
  },
  {
    id: '2',
    name: 'David',
    age: 28,
    bio: 'Looking for a tennis partner 🎾',
    image: '#4ECDC4',
    type: 'sport',
    location: 'London, UK',
    hobbies: ['Tennis', 'Gym', 'Cooking'],
  },
  {
    id: '3',
    name: 'Sarah',
    age: 22,
    bio: 'Travel enthusiast ✈️',
    image: '#FFE66D',
    type: 'date',
    location: 'Paris, France',
    hobbies: ['Travel', 'Art', 'Music'],
  },
  {
    id: '4',
    name: 'Michael',
    age: 30,
    bio: 'Tech enthusiast 💻',
    image: '#1A535C',
    type: 'sport',
    location: 'New York, USA',
    hobbies: ['Tech', 'Gaming', 'Reading'],
  },
  {
    id: '5',
    name: 'Emma',
    age: 26,
    bio: 'Marathon runner 🏃‍♀️',
    image: '#FF9F1C',
    type: 'sport',
    location: 'London, UK',
    hobbies: ['Running', 'Health', 'Travel'],
  },
  {
    id: '6',
    name: 'Alex',
    age: 29,
    bio: 'Board game nights? 🎲',
    image: '#6A0572',
    type: 'date',
    location: 'Tokyo, Japan',
    hobbies: ['Board Games', 'Anime', 'Food'],
  },
  {
    id: '7',
    name: 'Ryan',
    age: 25,
    bio: 'Looking for something serious ❤️',
    image: '#2D3436',
    type: 'date',
    location: 'New York, USA',
    hobbies: ['Movies', 'Reading', 'Coffee'],
  },
  {
    id: '8',
    name: 'Lisa',
    age: 27,
    bio: 'Yoga partner wanted 🧘‍♀️',
    image: '#00B894',
    type: 'sport',
    location: 'Paris, France',
    hobbies: ['Yoga', 'Nature', 'Meditation'],
  },
];
