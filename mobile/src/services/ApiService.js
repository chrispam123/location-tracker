const API_BASE_URL = 'https://4s3qwh5mzc.execute-api.us-east-1.amazonaws.com/dev';

export class ApiService {
  static async sendLocation(userId, latitude, longitude) {
    try {
      const response = await fetch(`${API_BASE_URL}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          latitude: latitude,
          longitude: longitude,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('Location sent successfully:', data);
      return true;
    } catch (error) {
      console.error('ApiService - Error sending location:', error);
      return false;
    }
  }
}