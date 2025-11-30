
export enum VehicleType {
  CAR = 'CAR',
  MOTORCYCLE = 'MOTORCYCLE',
}

export enum ParkingStatus {
  FREE = 'FREE',
  OCCUPIED = 'OCCUPIED',
}

export enum UserRole {
  ADMIN = 'ADMIN', // "Server" account
  GUEST = 'GUEST', // Read-only account
}

export interface ParkingSpot {
  id: string;
  type: VehicleType;
  status: ParkingStatus;
  lastUpdated?: Date;
}

export interface SpotLocation {
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
}

export interface MapZone {
  id: string;
  label: string;
  x: number; // Percentage
  y: number; // Percentage
  width: number; // Percentage
  height: number; // Percentage
  color: string; // Hex or tailwind class fragment
  type: 'default' | 'car' | 'moto' | 'disabled';
}

export interface ParkingStats {
  totalCars: number;
  occupiedCars: number;
  totalMotos: number;
  occupiedMotos: number;
  occupancyRate: number;
}

export interface LayoutSnapshot {
  id: string;
  name: string;
  date: number;
  spotLocations: Record<string, SpotLocation>;
  zones: MapZone[];
}

// WebSocket Payload Types
export interface AppStatePayload {
    spots?: ParkingSpot[];
    spotLocations?: Record<string, SpotLocation>;
    zones?: MapZone[];
    mapImage?: string | null;
}

export interface WSMessage {
    type: 'INIT' | 'UPDATE' | 'SYNC_INITIAL';
    payload: AppStatePayload;
}
