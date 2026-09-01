import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout/layout.component';
import * as L from 'leaflet';
import { Subscription, combineLatest, firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { RouterModule } from '@angular/router';
import { PlannedRoute, Vehicle, RouteStop, ChargingStation } from '../../core/models/routes.model';
import { RoutesService } from '../../core/services/routes.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { FleetService, WeeklyStats } from '../../core/services/fleet.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { fallbackParkingPosition, vehicleStatusColor, vehicleStatusLabel, normalizeVehicleStatus } from '../../core/utils/vehicle-status';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LayoutComponent, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapWrapper', { static: false }) mapWrapper?: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private routesSub?: Subscription;
  private vehiclesSub?: Subscription;
  private themeSubscription?: Subscription;
  private routeLayers: L.Polyline[] = [];
  private vehicleMarkers: L.Marker[] = [];
  private terminalMarkers: L.Marker[] = [];
  private stopMarkers: L.Marker[] = [];
  private stationMarkers: L.Marker[] = [];

  routes: PlannedRoute[] = [];
  vehicles: Vehicle[] = [];
  stations: ChargingStation[] = [];

  stats = {
    vehicles: 0,
    drivers: 0,
    routes: 0,
    activeTrips: 0
  };

  weekly: WeeklyStats = { vehicles: 0, drivers: 0, routes: 0, trips: 0 };

  fullscreenActive = false;
  isRefreshing = false;
  refreshError = '';
  readonly defaultCenter: L.LatLngExpression = [21.9667, -79.4333]; // Municipio Sancti Spíritus, Cuba
  readonly defaultZoom = 12;

  constructor(
    private routesService: RoutesService,
    private themeService: ThemeService,
    private authService: AuthService,
    private fleetService: FleetService,
    private telemetryService: TelemetryService
  ) { }

  get isAdmin(): boolean {
    return this.authService.getCurrentUser()?.role === 'admin';
  }

  get isLoggedIn(): boolean {
    return !!this.authService.getCurrentUser();
  }

  ngOnInit() {
    // Configurar iconos de Leaflet
    this.setupLeafletIcons();
    this.routesSub = this.routesService.routes$.subscribe(routes => {
      this.routes = routes;
      this.stats.routes = routes.length;
      this.updateStats();
      this.renderNetwork();
    });
    this.vehiclesSub = combineLatest([
      this.fleetService.vehicles$,
      this.fleetService.drivers$,
      this.telemetryService.positions$,
      this.authService.currentUser$
    ]).subscribe(([realVehicles, drivers, positions, user]) => {
      const currentDriver = this.fleetService.findDriverForUser(user);
      const visibleFleet = user?.role === 'driver' && currentDriver
        ? realVehicles.filter(v => v.conductorId === currentDriver.id || v.id === currentDriver.vehiculoId)
        : realVehicles;

      this.vehicles = visibleFleet.map((v) => {
        const gps = positions.get(v.id) ?? (v.imeiDispositivoGps ? positions.get(v.imeiDispositivoGps) : undefined);
        const parking = fallbackParkingPosition(v.id);
        const driverName = drivers.find(d => d.id === v.conductorId)?.nombreCompleto || 'Sin asignar';
        const estado = gps?.estado || v.estado;
        return {
          id: v.id,
          unidad: v.matricula || `V-${v.id}`,
          matricula: v.matricula,
          conductor: driverName,
          conductorId: v.conductorId,
          estado,
          lat: gps?.lat || parking.lat,
          lng: gps?.lng || parking.lng,
          color: vehicleStatusColor(estado),
          velocidad: gps?.velocidad ?? 0,
          gpsActivo: !!gps,
          imeiDispositivoGps: v.imeiDispositivoGps
        };
      });
      this.updateStats();
      this.renderNetwork();
    });

    this.routesService.stations$.subscribe(stations => {
      this.stations = stations;
      this.renderNetwork();
    });

    this.fleetService.drivers$.subscribe(drivers => {
      this.stats.drivers = drivers.length;
      this.updateStats();
    });

    // Suscribirse a cambios de tema
    this.themeSubscription = this.themeService.theme$.subscribe(() => {
      this.updateMapTheme();
    });

    this.refreshData();
  }

  ngAfterViewInit() {
    // Inicializar el mapa después de que la vista se haya renderizado
    setTimeout(() => {
      this.initMap();
    }, 200);
  }

  private setupLeafletIcons() {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }

  ngOnDestroy() {
    this.routesSub?.unsubscribe();
    this.vehiclesSub?.unsubscribe();
    this.themeSubscription?.unsubscribe();
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap() {
    // Verificar que el elemento existe
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      console.error('Elemento del mapa no encontrado');
      return;
    }

    // Restaurar estado del mapa si existe, sino usar valores por defecto
    const savedCenter = this.getSavedMapCenter();
    const savedZoom = this.getSavedMapZoom();

    // Crear el mapa centrado en el municipio Sancti Spíritus, Cuba
    this.map = L.map('map', {
      scrollWheelZoom: false, // Deshabilitar zoom con scroll del mouse
      zoomControl: true // Mantener los botones de zoom
    }).setView(savedCenter || this.defaultCenter, savedZoom || this.defaultZoom);

    // Inicializar tiles según el tema actual
    this.updateMapTheme();

    // Guardar estado del mapa cuando cambia zoom o centro
    this.map.on('moveend', () => this.saveMapState());
    // Actualizar iconos durante el zoom para respuesta inmediata
    this.map.on('zoom', () => {
      this.updateStopIcons();
    });
    this.map.on('zoomend', () => {
      this.saveMapState();
      // Asegurar actualización final de iconos
      this.updateStopIcons();
    });

    // Ajustar tamaño cuando cambia el contenedor (mantener centro y zoom)
    this.map.on('resize', () => {
      const currentCenter = this.map!.getCenter();
      const currentZoom = this.map!.getZoom();
      setTimeout(() => {
        if (this.map) {
          this.map.setView(currentCenter, currentZoom);
        }
      }, 100);
    });

    // Cargar estado inicial de rutas y vehículos
    const currentRoutes = this.routesService.getCurrentRoutes();
    if (currentRoutes.length > 0) {
      this.routes = currentRoutes;
      this.stats.routes = currentRoutes.length;
    }

    this.renderNetwork();
  }

  private updateMapTheme() {
    if (!this.map) {
      return;
    }

    // Remover la capa de tiles anterior si existe
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    // Determinar qué tiles usar según el tema
    const isDarkMode = this.themeService.isDarkMode();

    if (isDarkMode) {
      // Usar OpenStreetMap con estilo oscuro que preserva colores naturales
      this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        className: 'dark-map-tiles'
      });

      // Agregar clase al contenedor del mapa para aplicar filtros
      const mapContainer = this.map.getContainer();
      mapContainer.classList.add('dark-map-container');
    } else {
      // Usar OpenStreetMap estándar para modo claro
      this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      });

      // Remover clase del contenedor del mapa
      const mapContainer = this.map.getContainer();
      mapContainer.classList.remove('dark-map-container');
    }

    // Agregar la nueva capa de tiles
    this.tileLayer.addTo(this.map);
  }

  private saveMapState() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    localStorage.setItem('map-center-home', JSON.stringify([center.lat, center.lng]));
    localStorage.setItem('map-zoom-home', zoom.toString());
  }

  private getSavedMapCenter(): L.LatLngExpression | null {
    const saved = localStorage.getItem('map-center-home');
    if (saved) {
      try {
        const [lat, lng] = JSON.parse(saved);
        return [lat, lng] as L.LatLngExpression;
      } catch {
        return null;
      }
    }
    return null;
  }

  private getSavedMapZoom(): number | null {
    const saved = localStorage.getItem('map-zoom-home');
    return saved ? parseInt(saved, 10) : null;
  }

  private renderNetwork() {
    if (!this.map) {
      return;
    }
    this.routeLayers.forEach(layer => layer.remove());
    this.vehicleMarkers.forEach(marker => marker.remove());
    this.terminalMarkers.forEach(marker => marker.remove());
    this.stopMarkers.forEach(marker => marker.remove());
    this.routeLayers = [];
    this.vehicleMarkers = [];
    this.terminalMarkers = [];
    this.stopMarkers = [];
    this.stationMarkers.forEach(marker => marker.remove());
    this.stationMarkers = [];

    // Render Stations
    this.stations.forEach(station => {
      let iconClass = 'fa-charging-station';
      if (station.tipo === 'Carga Rápida') iconClass = 'fa-bolt';
      else if (station.tipo === 'Intercambio de Batería') iconClass = 'fa-battery-full';

      const color = station.estado === 'Disponible' ? '#22c55e' : (station.estado === 'Ocupada' ? '#ef4444' : '#eab308');

      const icon = L.divIcon({
        className: 'station-icon-home',
        html: `
              <div style="background: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                <i class="fas ${iconClass}" style="color: white; font-size: 11px;"></i>
              </div>
            `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([station.lat, station.lng], { icon }).addTo(this.map!);
      marker.bindPopup(`
            <strong>${station.nombre}</strong><br>
            <small>${station.tipo}</small><br>
            ${station.direccion ? `<small>📍 ${station.direccion}</small><br>` : ''}
            <span style="color: ${color}; font-weight: bold;">● ${station.estado}</span>
        `);
      this.stationMarkers.push(marker);
    });

    this.routes.forEach(route => {
      if (!route.polyline || route.polyline.length < 2) {
        return;
      }
      const routeColor = route.color || '#efb810';

      // Crear efecto de relieve: línea de sombra más gruesa y oscura debajo
      const shadowLayer = L.polyline(route.polyline, {
        color: '#000000',
        weight: 8,
        opacity: 0.4,
        className: 'route-shadow'
      }).addTo(this.map!);
      this.routeLayers.push(shadowLayer);

      // Línea principal con borde blanco para contraste
      const borderLayer = L.polyline(route.polyline, {
        color: '#ffffff',
        weight: 6,
        opacity: 0.9,
        className: 'route-border'
      }).addTo(this.map!);
      this.routeLayers.push(borderLayer);

      // Línea principal de la ruta
      const layer = L.polyline(route.polyline, {
        color: routeColor,
        weight: 5,
        opacity: 1.0,
        className: 'route-main'
      }).addTo(this.map!);
      this.routeLayers.push(layer);

      // Agregar marcadores de inicio y fin como pequeños círculos en el borde de la ruta
      const startIcon = L.divIcon({
        className: 'route-terminal start',
        html: `
          <div style="width: 20px; height: 20px; border-radius: 50%; background: ${routeColor}; border: 2px solid #000000; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const endIcon = L.divIcon({
        className: 'route-terminal end',
        html: `
          <div style="width: 20px; height: 20px; border-radius: 50%; background: ${routeColor}; border: 2px solid #000000; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);"></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      const startMarker = L.marker(route.polyline[0], { icon: startIcon }).addTo(this.map!);
      const endMarker = L.marker(route.polyline[route.polyline.length - 1], { icon: endIcon }).addTo(this.map!);
      this.terminalMarkers.push(startMarker, endMarker);

      // Agregar paradas de la ruta
      route.paradas.forEach((stop: RouteStop, index: number) => {
        // Icono de parada similar a los vehículos - círculo con número dentro
        const iconSize = 28; // Tamaño fijo para mejor rendimiento
        const centerPoint = iconSize / 2; // Punto central exacto
        const routeColor = route.color || '#efb810';

        // Crear icono circular con el color de la ruta y el número de parada
        const icon = L.divIcon({
          className: 'stop-marker-container',
          html: `
            <div class="stop-marker-wrapper" style="position: relative; width: ${iconSize}px; height: ${iconSize}px;">
              <div class="stop-circle" 
                   style="width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; background: ${routeColor}; border: 2px solid #000000; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4); position: relative; z-index: 1000;">
                <span style="color: #ffffff; font-size: 0.65rem; font-weight: 700; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));">${index + 1}</span>
              </div>
            </div>
          `,
          iconSize: [iconSize, iconSize],
          iconAnchor: [centerPoint, centerPoint], // Siempre centrado exactamente
          popupAnchor: [0, -centerPoint] // Ajuste del popup
        });

        const marker = L.marker([stop.lat, stop.lng], {
          icon: icon,
          draggable: false
        }).addTo(this.map!);

        let popupText = `<strong>${stop.nombre}</strong>`;
        if (stop.direccion) {
          popupText += `<br><small>📍 ${stop.direccion}</small>`;
        } else if (stop.descripcion) {
          popupText += `<br>${stop.descripcion}`;
        }

        marker.bindPopup(popupText);
        this.stopMarkers.push(marker);
      });
    });

    this.vehicles.forEach((vehicle) => {
      if (!vehicle.lat || !vehicle.lng) {
        return;
      }
      const status = normalizeVehicleStatus(vehicle.estado);
      const isActive = status === 'TRABAJANDO';
      const iconSize = 32;
      const centerPoint = iconSize / 2;
      const lat = vehicle.lat;
      const lng = vehicle.lng;
      const circleColor = vehicleStatusColor(vehicle.estado);
      const estadoLabel = vehicleStatusLabel(vehicle.estado);
      const icon = L.divIcon({
        className: 'vehicle-marker-container',
        html: `
          <div class="vehicle-marker-wrapper" style="position: relative; width: ${iconSize}px; height: ${iconSize}px;">
            <div class="vehicle-circle ${isActive ? 'active' : 'inactive'}"
                 style="width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; background: ${circleColor}; border: 2px solid #000000; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4); position: relative; z-index: 1000; ${!isActive ? 'opacity: 0.8;' : ''}">
              <i class="fas fa-car" style="color: #facc15; font-size: 0.75rem; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));"></i>
            </div>
          </div>
        `,
        iconSize: [iconSize, iconSize],
        iconAnchor: [centerPoint, centerPoint],
        popupAnchor: [0, -centerPoint]
      });

      const marker = L.marker([lat, lng], { icon }).addTo(this.map!);

      // Buscar la ruta asignada al vehículo (por el campo conductor o nombre de unidad)
      const rutaAsignada = this.routes.find(r =>
        r.paradas.some(p => p.nombre?.toLowerCase().includes(vehicle.unidad?.toLowerCase() ?? ''))
      );
      const rutaNombre = rutaAsignada?.nombre ?? 'Sin ruta asignada';

      // Popup diferenciado por rol
      if (this.isAdmin) {
        const velocidad = vehicle.velocidad != null ? `${vehicle.velocidad} km/h` : 'Sin datos GPS';
        const conductor = vehicle.conductor && vehicle.conductor.trim() ? vehicle.conductor : 'Sin conductor';
        const estado = estadoLabel;
        const placa = (vehicle as any).matricula || (vehicle as any).placa || 'N/A';

        marker.bindPopup(`
          <div class="vehicle-popup-admin">
            <div class="vp-header">
              <span class="vp-badge ${isActive ? 'active' : 'inactive'}">${isActive ? '● EN LÍNEA' : '● OFFLINE'}</span>
              <strong class="vp-title">${vehicle.unidad}</strong>
            </div>
            <table class="vp-table">
              <tr><td>🚗 Placa</td><td><b>${placa}</b></td></tr>
              <tr><td>👤 Conductor</td><td>${conductor}</td></tr>
              <tr><td>🛣️ Ruta</td><td>${rutaNombre}</td></tr>
              <tr><td>⚡ Velocidad</td><td>${velocidad}</td></tr>
              <tr><td>📍 Estado</td><td>${estado}</td></tr>
              <tr><td>🌐 GPS</td><td>${isActive ? 'Activo' : 'Inactivo'}</td></tr>
            </table>
          </div>
        `, { maxWidth: 280 });
      } else {
        marker.bindPopup(`
          <div class="vehicle-popup">
            <strong>${vehicle.unidad}</strong><br>
            <span style="color: ${circleColor}; font-weight: 700;">● ${estadoLabel}</span>
          </div>
        `);
      }

      this.vehicleMarkers.push(marker as any);
      this.updateStats();
    });
  }

  private getIconSizeForZoom(): number {
    if (!this.map) {
      return 32; // Tamaño por defecto
    }
    const zoom = this.map.getZoom();
    // A mayor zoom (más cerca), icono más pequeño
    // A menor zoom (más lejos), icono más grande
    // Esto compensa el efecto visual y mantiene la posición fija
    if (zoom >= 17) {
      return 24; // Zoom muy alto: icono pequeño
    } else if (zoom >= 15) {
      return 28; // Zoom alto: icono mediano-pequeño
    } else if (zoom >= 13) {
      return 32; // Zoom medio: icono mediano
    } else if (zoom >= 11) {
      return 36; // Zoom bajo: icono mediano-grande
    } else {
      return 40; // Zoom muy bajo: icono grande
    }
  }

  private updateStats(): void {
    const activeStates = ['ACTIVO', 'EN RUTA', 'EN PARADA', 'CARGANDO'];
    this.stats.vehicles = this.vehicles.filter(v => {
      const estado = (v.estado || '').toUpperCase();
      return activeStates.includes(estado);
    }).length;

    this.stats.activeTrips = this.vehicles.filter(v =>
      v.conductorId != null || (v.estado || '').toUpperCase() === 'EN RUTA'
    ).length;

    this.stats.routes = this.routes.length;
    this.weekly = this.fleetService.getWeeklyStats();
    this.weekly.routes = this.routesService.getWeeklyCreatedCount();
    if (!this.isAdmin) {
      this.weekly = {
        ...this.weekly,
        drivers: 0
      };
    }
  }

  weeklyLabel(delta: number, period: 'semana' | 'hoy' = 'semana'): string {
    if (!delta) {
      return `Sin cambios esta ${period}`;
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta} esta ${period}`;
  }

private updateStopIcons() {
    if (!this.map || this.stopMarkers.length === 0) {
      return;
    }
    const iconSize = this.getIconSizeForZoom();
    const centerPoint = iconSize / 2; // Punto central exacto

    this.stopMarkers.forEach(marker => {
      const newIcon = L.divIcon({
        className: 'stop-marker-container',
        html: `
          <div class="stop-marker-wrapper" style="position: relative; width: ${iconSize}px; height: ${iconSize}px;">
            <div class="stop-circle" 
                 style="width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; background: #efb810; border: 2px solid #000000; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4); position: relative; z-index: 1000;">
              <i class="fas fa-map-marker-alt" style="color: #ffffff; font-size: 0.65rem; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));"></i>
            </div>
          </div>
        `,
        iconSize: [iconSize, iconSize],
        iconAnchor: [centerPoint, centerPoint], // Siempre centrado exactamente
        popupAnchor: [0, -centerPoint] // Ajuste del popup
      });
      marker.setIcon(newIcon);
    });
  }

  centerMap() {
    if (this.map) {
      this.map.setView(this.defaultCenter, this.defaultZoom);
    }
  }

  toggleFullscreen() {
    const wrapper = this.mapWrapper?.nativeElement;
    if (!wrapper) {
      return;
    }
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(() => {
        alert('El navegador no permitió activar pantalla completa.');
      });
    } else {
      document.exitFullscreen().catch(() => { });
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.fullscreenActive = !!document.fullscreenElement;
    setTimeout(() => {
      this.map?.invalidateSize();
      this.updateScrollWheelZoom();
    }, 200);
  }

  private updateScrollWheelZoom() {
    if (!this.map) {
      return;
    }
    // Habilitar scroll con mouse solo en pantalla completa
    if (this.fullscreenActive) {
      this.map.scrollWheelZoom.enable();
    } else {
      this.map.scrollWheelZoom.disable();
    }
  }

  async refreshData() {
    if (this.isRefreshing) {
      return;
    }
    this.refreshError = '';
    this.isRefreshing = true;
    try {
      // Refrescar datos del backend (rutas, estaciones)
      await firstValueFrom(this.fleetService.refreshDataFromBackend().pipe(
        catchError(() => of(null))
      ));
      await this.routesService.refreshData();

      // Forzar actualización de stats y renderizado
      this.updateStats();
      this.renderNetwork();
    } catch (error) {
      console.error('No se pudo actualizar el mapa del dashboard', error);
      this.refreshError = 'No se pudo actualizar. Verifica la conexión con el servidor.';
    } finally {
      this.isRefreshing = false;
    }
  }
}
