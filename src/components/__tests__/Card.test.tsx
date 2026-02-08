import React from 'react';
import { render } from '@testing-library/react-native';
import Card from '../Card';

const mockUser = {
  id: '123',
  name: 'Test User',
  age: 25,
  bio: 'This is a test bio',
  image: '#000000',
};

describe('Card Component', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Card user={mockUser} />);
    
    expect(getByText('Test User, 25')).toBeTruthy();
    expect(getByText('This is a test bio')).toBeTruthy();
  });
});
