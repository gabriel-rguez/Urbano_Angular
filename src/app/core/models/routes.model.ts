export type RouteStatus = 'Activa' | 'Inactiva';

export interface RouteStop {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  descripcion?: string;
  direccion?: string; // Dirección de la calle obtenida por geocodificación inversa
}

export interface PlannedRoute {
  id: number;
  nombre: string;
  origen: string;
  destino: string;
  estado: RouteStatus;
  polyline: Array<[number, number]>;
  color: string;
  paradas: RouteStop[];
}

export interface Vehicle {
  id: number;
  unidad: string;
  conductor: string;
  estado: string;
  lat: number;
  lng: number;
  color?: string;
  velocidad?: number;
  gpsActivo?: boolean; // Indica si el GPS está activo y el vehículo es rastreable
  conductorId?: number | null; // ID del conductor asignado (de la BD)
  matricula?: string; // Matrícula/placa del vehículo
  imeiDispositivoGps?: string | null; // Identificador del dispositivo GPS, si existe en la BD
}

export interface ChargingStation {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  estado: 'Disponible' | 'Ocupada' | 'Mantenimiento';
  tipo: 'Carga Rápida' | 'Intercambio de Batería' | 'Carga e Intercambio';
  direccion?: string;
}

