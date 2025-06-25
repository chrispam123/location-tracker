import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocationService } from './src/services/LocationService';
import { ApiService } from './src/services/ApiService';

const LOCATION_TASK_NAME = 'background-location-task';

// Configure notifications to always show
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
          // Update persistent notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '📍 Williams Localizado',
              body: `Última actualización: ${new Date().toLocaleTimeString()}`,
              data: { persistent: true },
              sticky: true,
            },
            trigger: null,
          });
        }
      }
    } catch (error) {
      console.error('Error in background task:', error);
    }
  }
});

export default function App() {
  const [userId, setUserId] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Request notification permissions
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        Alert.alert('Permisos necesarios', 'Se necesitan permisos de notificación para funcionar correctamente.');
      }

      // Generate or retrieve user ID
      let storedUserId = await AsyncStorage.getItem('user_id');
      if (!storedUserId) {
        storedUserId = `williams_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('user_id', storedUserId);
      }
      setUserId(storedUserId);

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Los permisos de ubicación son necesarios para el funcionamiento.');
        return;
      }

      // Request background location permissions
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        Alert.alert('Permisos de segundo plano', 'Los permisos de ubicación en segundo plano son necesarios para el tracking continuo.');
      }

      await setupLocationTracking();
      await showPersistentNotification();
      setSetupComplete(true);

    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Error durante la inicialización');
    }
  };

  const setupLocationTracking = async () => {
    try {
      // Check if background task is already registered
      const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
      
      if (isTaskDefined) {
        // Start background location tracking with aggressive settings
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5 * 60 * 1000, // 5 minutes (more frequent)
          distanceInterval: 10, // Every 10 meters
          deferredUpdatesInterval: 5 * 60 * 1000,
          foregroundService: {
            notificationTitle: '📍 Williams - Localización Activa',
            notificationBody: 'Tracking de ubicación funcionando en segundo plano',
            notificationColor: '#2c5282',
          },
          pausesLocationUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        });
        
        setIsTracking(true);
        console.log('Aggressive background location tracking started');

        // Send initial location
        await sendCurrentLocation();
      }
    } catch (error) {
      console.error('Error setting up location tracking:', error);
      Alert.alert('Error', 'No se pudo configurar el tracking de ubicación');
    }
  };

  const sendCurrentLocation = async () => {
    try {
      const currentLocation = await LocationService.getCurrentLocation();
      
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
      console.error('Error sending current location:', error);
    }
  };

  const showPersistentNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📍 Williams Localizado',
          body: 'Sistema de localización activo y funcionando',
          data: { persistent: true },
          sticky: true,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  // Keep app alive - send location every 10 minutes even in foreground
  useEffect(() => {
    if (setupComplete) {
      const interval = setInterval(() => {
        sendCurrentLocation();
      }, 10 * 60 * 1000); // 10 minutes
      
      return () => clearInterval(interval);
    }
  }, [setupComplete, userId]);

  if (!setupComplete) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔄 Configurando...</Text>
        <Text style={styles.subtitle}>Inicializando sistema de localización</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📍 WILLIAMS</Text>
      <Text style={styles.title}>LOCALIZADO</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusIcon}>✅</Text>
        <Text style={styles.statusText}>FUNCIONANDO CORRECTAMENTE</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>🔄 Tracking automático cada 5-10 minutos</Text>
        <Text style={styles.infoText}>📱 Funciona en segundo plano</Text>
        <Text style={styles.infoText}>🔋 Optimizado para batería</Text>
        {lastSync && (
          <Text style={styles.syncText}>
            Última sincronización: {lastSync}
          </Text>
        )}
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>INSTRUCCIONES:</Text>
        <Text style={styles.instructionsText}>
          • Esta app funciona automáticamente{'\n'}
          • No es necesario hacer nada más{'\n'}
          • Mantén el móvil encendido{'\n'}
          • La familia puede ver tu ubicación
        </Text>
      </View>

      <View style={styles.statusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: isTracking ? '#48bb78' : '#ed8936' }]} />
        <Text style={styles.statusLabel}>
          {isTracking ? 'ACTIVO' : 'CONFIGURANDO'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c5282',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#4a5568',
    textAlign: 'center',
    marginBottom: 20,
  },
  statusContainer: {
    alignItems: 'center',
    backgroundColor: '#e6fffa',
    padding: 30,
    borderRadius: 20,
    marginVertical: 30,
    borderWidth: 3,
    borderColor: '#48bb78',
  },
  statusIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22543d',
    textAlign: 'center',
  },
  infoContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    marginVertical: 3,
  },
  syncText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 10,
    fontStyle: 'italic',
  },
  instructionsContainer: {
    backgroundColor: '#fffaf0',
    padding: 20,
    borderRadius: 15,
    marginVertical: 20,
    borderWidth: 2,
    borderColor: '#ed8936',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c05621',
    marginBottom: 10,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 16,
    color: '#744210',
    lineHeight: 24,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
  },
});