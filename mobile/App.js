import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationService } from './src/services/LocationService';
import { ApiService } from './src/services/ApiService';

export default function App() {
  const [location, setLocation] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Generate or retrieve user ID
    let storedUserId = await AsyncStorage.getItem('user_id');
    if (!storedUserId) {
      storedUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('user_id', storedUserId);
    }
    setUserId(storedUserId);

    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required for this app to work.');
      return;
    }

    // Request background location permissions
    if (Platform.OS === 'android') {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        Alert.alert('Background permission', 'Background location permission is recommended for continuous tracking.');
      }
    }

    startLocationTracking();
  };

  const startLocationTracking = async () => {
    setIsTracking(true);
    
    // Get initial location
    await updateLocation();
    
    // Set up interval for location updates every 10 minutes
    const interval = setInterval(updateLocation, 10 * 60 * 1000); // 10 minutes
    
    return () => clearInterval(interval);
  };

  const updateLocation = async () => {
    try {
      const currentLocation = await LocationService.getCurrentLocation();
      setLocation(currentLocation);

      if (userId && currentLocation) {
        const success = await ApiService.sendLocation(
          userId,
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
        
        if (success) {
          setLastSync(new Date().toLocaleTimeString());
        }
      }
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to get location');
    }
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Initializing...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Location Tracker</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.label}>User ID:</Text>
        <Text style={styles.value}>{userId}</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.label}>Tracking Status:</Text>
        <Text style={[styles.value, { color: isTracking ? 'green' : 'red' }]}>
          {isTracking ? 'Active' : 'Inactive'}
        </Text>
      </View>

      {location && (
        <View style={styles.locationContainer}>
          <Text style={styles.label}>Current Location:</Text>
          <Text style={styles.coordinates}>
            Lat: {location.coords.latitude.toFixed(6)}
          </Text>
          <Text style={styles.coordinates}>
            Lng: {location.coords.longitude.toFixed(6)}
          </Text>
          <Text style={styles.accuracy}>
            Accuracy: {location.coords.accuracy?.toFixed(1)}m
          </Text>
        </View>
      )}

      {lastSync && (
        <View style={styles.statusContainer}>
          <Text style={styles.label}>Last Sync:</Text>
          <Text style={styles.value}>{lastSync}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  statusContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  locationContainer: {
    marginVertical: 20,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 5,
  },
  value: {
    fontSize: 14,
    color: '#333',
  },
  coordinates: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
  accuracy: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});