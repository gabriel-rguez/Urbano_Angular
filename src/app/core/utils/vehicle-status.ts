export type DriverVehicleStatus = 'TRABAJANDO' | 'NO_DISPONIBLE' | 'AVERIADO';

export const VEHICLE_STATUS_COLORS: Record<DriverVehicleStatus, string> = {
  TRABAJANDO: '#22c55e',
  NO_DISPONIBLE: '#eab308',
  AVERIADO: '#ef4444'
};

export const VEHICLE_STATUS_OPTIONS: Array<{
  value: DriverVehicleStatus;
  label: string;
  detail: string;
  color: string;
}> = [
  {
    value: 'TRABAJANDO',
    label: 'Trabajando',
    detail: 'El ecomóvil está en servicio y puede circular.',
    color: VEHICLE_STATUS_COLORS.TRABAJANDO
  },
  {
    value: 'NO_DISPONIBLE',
    label: 'No disponible',
    detail: 'Hoy no va a estar disponible para el servicio.',
    color: VEHICLE_STATUS_COLORS.NO_DISPONIBLE
  },
  {
    value: 'AVERIADO',
    label: 'Roto',
    detail: 'Averiado: no se puede mover.',
    color: VEHICLE_STATUS_COLORS.AVERIADO
  }
];

export function normalizeVehicleStatus(estado?: string | null): DriverVehicleStatus {
  const value = (estado || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (
    value.includes('INACTIVO') ||
    value.includes('NO_DISPONIBLE') ||
    value === 'INDISPONIBLE'
  ) {
    return 'NO_DISPONIBLE';
  }
  if (
    value.includes('FUERA') ||
    value.includes('AVERI') ||
    value.includes('ROTO') ||
    value.includes('MANTENIMIENTO')
  ) {
    return 'AVERIADO';
  }
  return 'TRABAJANDO';
}

export function vehicleStatusColor(estado?: string | null): string {
  return VEHICLE_STATUS_COLORS[normalizeVehicleStatus(estado)];
}

export function vehicleStatusLabel(estado?: string | null): string {
  switch (normalizeVehicleStatus(estado)) {
    case 'NO_DISPONIBLE':
      return 'No disponible';
    case 'AVERIADO':
      return 'Roto / no se puede mover';
    default:
      return 'Trabajando';
  }
}

export function telemetryEstadoIndex(status: DriverVehicleStatus): number {
  if (status === 'NO_DISPONIBLE') {
    return 1;
  }
  if (status === 'AVERIADO') {
    return 4;
  }
  return 0;
}

/**
 * Calle Tello Sánchez, Los Olivos I, Sancti Spíritus.
 * Al oeste de la Universidad (Capitán Silverio Blanco Núñez / UNISS),
 * sobre la calzada, con separación entre unidades.
 */
const PARKING_ANCHOR = { lat: 21.92892, lng: -79.43888 };
const STEP = { dLat: -0.000068, dLng: 0.000128 };
const LANE = { dLat: 0.000032, dLng: -0.000038 };

export function fallbackParkingPosition(vehicleId: number): { lat: number; lng: number } {
  const slot = Math.max(0, Number.isFinite(vehicleId) ? vehicleId - 1 : 0);
  const index = slot % 12;
  const lane = Math.floor(slot / 12) % 2;
  return {
    lat: PARKING_ANCHOR.lat + STEP.dLat * index + LANE.dLat * lane,
    lng: PARKING_ANCHOR.lng + STEP.dLng * index + LANE.dLng * lane
  };
}
