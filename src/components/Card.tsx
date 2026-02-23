import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from '../data/users';

const { width, height } = Dimensions.get('window');

interface CardProps {
  user: User;
}

export default function Card({ user }: CardProps) {
  const isColor = user.image && user.image.startsWith('#');
  const hasImage = !!user.image && !isColor;

  return (
    <View style={styles.card}>
      {isColor ? (
        <View style={[styles.image, { backgroundColor: user.image }]}>
          <Text style={styles.initial}>{user.name[0]}</Text>
        </View>
      ) : hasImage ? (
        <Image source={{ uri: user.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, { backgroundColor: '#ddd' }]}>
          <Text style={styles.initial}>{user.name[0]}</Text>
        </View>
      )}
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      >
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{user.name}, {user.age}</Text>
          <Text style={styles.bio}>{user.bio}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontSize: 80,
    color: '#fff',
    fontWeight: 'bold',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
    justifyContent: 'flex-end',
    padding: 20,
  },
  infoContainer: {
    marginBottom: 20,
  },
  name: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  bio: {
    fontSize: 18,
    color: '#eee',
  },
});
