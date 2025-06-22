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
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import { LocationService } from './src/services/LocationService';
import { ApiService } from './src/services/ApiService';

const LOCATION_TASK_NAME = 'background-location-task';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Define the background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }

  if (data) {
    try {
      // Get user ID from storage
      const userId = await AsyncStorage.getItem('user_id');
      
      if (userId && data.locations && data.locations.length > 0) {
        const location = data.locations[0];
        
        // Send location to API
        const success = await ApiService.sendLocation(
          userId,
          location.coords.latitude,
          location.coords.longitude
        );
        
        if (success) {
          console.log('Background location sent successfully');
          // Store last sync time
          await AsyncStorage.setItem('last_background_sync', new Date().toISOString());
        }
      }
    } catch (error) {
      console.error('Error in background task:', error);
    }
  }
});

export default function App() {
  const [location, setLocation] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [backgroundTaskRegistered, setBackgroundTaskRegistered] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Request notification permissions
    const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
    if (notificationStatus !== 'granted') {
      Alert.alert('Permisos', 'Se necesitan permisos de notificación para el funcionamiento continuo.');
    }

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
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert('Background permission', 'Background location permission is required for continuous tracking.');
      return;
    }

    await startLocationTracking();
    await setupBackgroundLocation();
    await showPersistentNotification();
  };

  const setupBackgroundLocation = async () => {
    try {
      // Check if background task is already registered
      const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
      
      if (isTaskDefined) {
        // Start background location tracking
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10 * 60 * 1000, // 10 minutes
          distanceInterval: 0, // Don't filter by distance
          deferredUpdatesInterval: 10 * 60 * 1000, // 10 minutes
          foregroundService: {
            notificationTitle: 'Localización de Williams activa',
            notificationBody: 'Manteniendo ubicación actualizada cada 10 minutos',
            notificationColor: '#2c5282',
          },
        });
        
        setBackgroundTaskRegistered(true);
        console.log('Background location tracking started');
      }
    } catch (error) {
      console.error('Error setting up background location:', error);
    }
  };

  const showPersistentNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📍 Localización Williams',
          body: 'Funcionando correctamente en segundo plano',
          data: { persistent: true },
          sticky: true,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
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
      <Text style={styles.title}>LOCALIZACIÓN DE WILLIAMS POR EL MUNDO</Text>
      
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
              title="Ubicación de Williams"
              description={`Precisión: ${location.coords.accuracy?.toFixed(1)}m`}
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
                title={`Ubicación ${index + 1}`}
                description={new Date(loc.timestamp).toLocaleTimeString()}
                pinColor="blue"
              />
            ))}
          </MapView>
        </View>
      )}
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>✅ Funcionando correctamente</Text>
        <Text style={styles.statusText}>
          {backgroundTaskRegistered ? '🔄 Tracking en segundo plano activo' : '⏳ Configurando tracking...'}
        </Text>
        {lastSync && (
          <Text style={styles.lastSyncText}>
            Última actualización: {lastSync}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 50,
    marginBottom: 20,
    marginHorizontal: 15,
    color: '#2c5282',
    lineHeight: 28,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 15,
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
  statusContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginHorizontal: 15,
    marginBottom: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22543d',
    marginBottom: 8,
  },
  lastSyncText: {
    fontSize: 16,
    color: '#4a5568',
    fontWeight: '500',
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});