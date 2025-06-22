import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = 'https://4s3qwh5mzc.execute-api.us-east-1.amazonaws.com/prod';

// TypeScript interfaces
export interface Location {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  createdAt: string;
  formattedTime: string;
}

export interface ApiLocationResponse {
  success: boolean;
  count: number;
  users: number;
  timeRange: string;
  locations: Location[];
}

export interface ApiServiceResponse<T> {
  success: boolean;
  data: T | null;
  error?: string;
}

export interface LocationQueryOptions {
  userId?: string;
  hours?: number;
  limit?: number;
}

class ApiService {
  /**
   * Get all locations from the API
   */
  static async getLocations(options: LocationQueryOptions = {}): Promise<ApiServiceResponse<ApiLocationResponse>> {
    try {
      const params = new URLSearchParams();
      
      if (options.userId) {
        params.append('user_id', options.userId);
      }
      
      if (options.hours) {
        params.append('hours', options.hours.toString());
      }
      
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }

      const url = `${API_BASE_URL}/locations${params.toString() ? '?' + params.toString() : ''}`;
      
      console.log('Fetching locations from:', url);
      
      const response: AxiosResponse<ApiLocationResponse> = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
        }
      });

      return {
        success: true,
        data: response.data
      };

    } catch (error: any) {
      console.error('Error fetching locations:', error);
      
      let errorMessage = 'Failed to fetch locations';
      
      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
      } else if (error.request) {
        // Network error
        errorMessage = 'Network error - please check your connection';
      } else {
        // Other error
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
        data: null
      };
    }
  }

  /**
   * Get locations for a specific user
   */
  static async getUserLocations(
    userId: string, 
    hours: number = 24
  ): Promise<ApiServiceResponse<ApiLocationResponse>> {
    return this.getLocations({ userId, hours, limit: 100 });
  }

  /**
   * Get recent locations (last 24 hours)
   */
  static async getRecentLocations(
    limit: number = 50
  ): Promise<ApiServiceResponse<ApiLocationResponse>> {
    return this.getLocations({ hours: 24, limit });
  }

  /**
   * Get locations from last week
   */
  static async getWeeklyLocations(
    userId?: string
  ): Promise<ApiServiceResponse<ApiLocationResponse>> {
    return this.getLocations({ 
      userId, 
      hours: 24 * 7, // 7 days
      limit: 200 
    });
  }

  /**
   * Test API connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      const result = await this.getLocations({ limit: 1 });
      return result.success;
    } catch (error) {
      console.error('API connection test failed:', error);
      return false;
    }
  }
}

export default ApiService;