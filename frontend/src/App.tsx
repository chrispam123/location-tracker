import React, { useState, useEffect, useRef } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import ApiService from './services/ApiService';
import './App.css';

// TypeScript interfaces
interface Location {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  createdAt: string;
  formattedTime: string;
}

interface MapCenter {
  lat: number;
  lng: number;
}

interface MapComponentProps {
  locations: Location[];
  center: MapCenter;
}

// Google Maps component
const MapComponent: React.FC<MapComponentProps> = ({ locations, center }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (mapRef.current && !map) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: center,
        zoom: 13,
        mapTypeId: 'roadmap',
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
      setMap(newMap);
    }
  }, [center, map]);

  useEffect(() => {
    if (map && locations.length > 0) {
      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      // Add new markers
      locations.forEach((location, index) => {
        const isLatest = index === 0;
        
        const marker = new window.google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: map,
          title: `Williams - ${location.formattedTime}`,
          icon: {
            url: isLatest 
              ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
              : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new window.google.maps.Size(32, 32)
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 10px;">
              <h3 style="margin: 0 0 10px 0; color: #2c5282;">
                ${isLatest ? '📍 Ubicación Actual' : '📍 Ubicación Anterior'}
              </h3>
              <p style="margin: 5px 0;"><strong>Fecha:</strong> ${location.formattedTime}</p>
              <p style="margin: 5px 0;"><strong>Coordenadas:</strong> ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</p>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        markersRef.current.push(marker);
      });

      // Center map on latest location
      if (locations.length > 0) {
        map.setCenter({
          lat: locations[0].latitude,
          lng: locations[0].longitude
        });
      }

      // Create path between locations if more than 1
      if (locations.length > 1) {
        const path = locations.map(loc => ({
          lat: loc.latitude,
          lng: loc.longitude
        }));

        const polyline = new window.google.maps.Polyline({
          path: path,
          geodesic: true,
          strokeColor: '#2c5282',
          strokeOpacity: 0.7,
          strokeWeight: 3
        });

        polyline.setMap(map);
      }
    }
  }, [map, locations]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

const App: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('24'); // 24 hours default
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [totalLocations, setTotalLocations] = useState<number>(0);

  const mapCenter: MapCenter = { lat: 40.4168, lng: -3.7038 }; // Madrid default

  const fetchLocations = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const hours = parseInt(filter);
      const result = await ApiService.getLocations({ 
        hours: hours,
        limit: 100 
      });

      if (result.success && result.data) {
        setLocations(result.data.locations || []);
        setTotalLocations(result.data.count || 0);
        setLastUpdate(new Date().toLocaleString());
      } else {
        setError(result.error || 'Error al cargar ubicaciones');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [filter]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLocations();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [filter]);

  const render = (status: Status): React.ReactElement => {
    switch (status) {
      case Status.LOADING:
        return <div className="loading">Cargando Google Maps...</div>;
      case Status.FAILURE:
        return <div className="error">Error cargando Google Maps</div>;
      case Status.SUCCESS:
        return (
          <MapComponent 
            locations={locations} 
            center={locations.length > 0 ? 
              { lat: locations[0].latitude, lng: locations[0].longitude } : 
              mapCenter
            } 
          />
        );
      default:
        return <div>Estado desconocido</div>;
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setFilter(e.target.value);
  };

  const getFilterLabel = (filterValue: string): string => {
    switch (filterValue) {
      case '1': return 'Última hora';
      case '6': return 'Últimas 6 horas';
      case '24': return 'Últimas 24 horas';
      case '168': return 'Última semana';
      default: return 'Período desconocido';
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🌍 Williams por el Mundo</h1>
        <div className="dashboard-controls">
          <select 
            value={filter} 
            onChange={handleFilterChange}
            className="time-filter"
          >
            <option value="1">Última hora</option>
            <option value="6">Últimas 6 horas</option>
            <option value="24">Últimas 24 horas</option>
            <option value="168">Última semana</option>
          </select>
          <button onClick={fetchLocations} className="refresh-btn" disabled={loading}>
            {loading ? '🔄' : '↻'} Actualizar
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="map-container">
          {error ? (
            <div className="error-message">
              <h3>❌ Error</h3>
              <p>{error}</p>
              <button onClick={fetchLocations}>Reintentar</button>
            </div>
          ) : (
            <Wrapper apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY!} render={render} />
          )}
        </div>

        <div className="info-panel">
          <div className="info-card">
            <h3>📊 Resumen</h3>
            <p><strong>Ubicaciones encontradas:</strong> {totalLocations}</p>
            <p><strong>Período:</strong> {getFilterLabel(filter)}</p>
            {lastUpdate && <p><strong>Última actualización:</strong> {lastUpdate}</p>}
          </div>

          {locations.length > 0 && (
            <div className="info-card">
              <h3>📍 Última Ubicación</h3>
              <p><strong>Fecha:</strong> {locations[0].formattedTime}</p>
              <p><strong>Coordenadas:</strong> {locations[0].latitude.toFixed(4)}, {locations[0].longitude.toFixed(4)}</p>
            </div>
          )}

          <div className="info-card">
            <h3>🔄 Actualización Automática</h3>
            <p>El mapa se actualiza automáticamente cada 5 minutos</p>
            <div className="status-indicator">
              <span className={`status-dot ${loading ? 'loading' : 'connected'}`}></span>
              {loading ? 'Actualizando...' : 'Conectado'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;