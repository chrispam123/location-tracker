import * as Location from 'expo-location';

export class LocationService {
  static async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000, // 5 minutes cache
      });
      
      return location;
    } catch (error) {
      console.error('LocationService - Error getting location:', error);
      throw error;
    }
  }

  static async hasLocationPermission() {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  static async requestLocationPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  static async hasBackgroundPermission() {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === 'granted';
  }

  static async requestBackgroundPermission() {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  }
}