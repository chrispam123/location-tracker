import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import { LocationService } from './src/services/LocationService';
import { ApiService } from './src/services/ApiService';

export default function App() {
  const [location, setLocation] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);

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
          
          // Add to location history
          const newLocationPoint = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            timestamp: Date.now(),
          };
          
          setLocationHistory(prev => [...prev, newLocationPoint].slice(-10)); // Keep last 10 locations
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
      
      {location && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            followsUserLocation={true}
          >
            {/* Current location marker */}
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Current Location"
              description={`Accuracy: ${location.coords.accuracy?.toFixed(1)}m`}
              pinColor="red"
            />
            
            {/* Location history markers */}
            {locationHistory.map((loc, index) => (
              <Marker
                key={index}
                coordinate={{
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }}
                title={`Location ${index + 1}`}
                description={new Date(loc.timestamp).toLocaleTimeString()}
                pinColor="blue"
              />
            ))}
          </MapView>
        </View>
      )}
      
      <View style={styles.infoContainer}>
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

        <View style={styles.statusContainer}>
          <Text style={styles.label}>Location History:</Text>
          <Text style={styles.value}>{locationHistory.length} points</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 20,
    color: '#333',
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
  },
  infoContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  locationContainer: {
    marginVertical: 10,
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    padding: 10,
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  coordinates: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  accuracy: {
    fontSize: 11,
    color: '#6c757d',
    marginTop: 3,
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});