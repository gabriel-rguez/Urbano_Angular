import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutComponent } from '../../shared/layout/layout.component';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';
import { PlannedRoute, RouteStatus, Vehicle } from '../../core/models/routes.model';
import { RoutesService } from '../../core/services/routes.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [CommonModule, LayoutComponent],
  templateUrl: './monitoring.component.html',
  styleUrl: './monitoring.component.css'
})
export class MonitoringComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapWrapper', { static: false }) mapWrapper?: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private routesSub?: Subscription;
  private vehiclesSub?: Subscription;
  private themeSubscription?: Subscription;
  private routeLayers: L.Polyline[] = [];
  private terminalMarkers: L.Marker[] = [];
  private stopMarkers: L.Marker[] = [];
  private vehicleMarkers: L.Marker[] = [];

  plannedRoutes: PlannedRoute[] = [];
  vehicles: Vehicle[] = [];
  vehicleSlideIndex = 0;
  routeSlideIndex = 0;
  readonly vehiclesPerSlide = 1;
  readonly routesPerSlide = 1;

  get activeRoutes(): PlannedRoute[] {
    return this.plannedRoutes.filter(route => route.estado === 'Activa');
  }

  get visibleVehicles(): Vehicle[] {
    const start = this.vehicleSlideIndex * this.vehiclesPerSlide;
    return this.vehicles.slice(start, start + this.vehiclesPerSlide);
  }

  get canVehiclePrev(): boolean {
    return this.vehicleSlideIndex > 0;
  }

  get canVehicleNext(): boolean {
    return this.vehicleSlideIndex < this.getMaxVehicleSlide();
  }

  get visibleRoutes(): PlannedRoute[] {
    const active = this.activeRoutes;
    const start = this.routeSlideIndex * this.routesPerSlide;
    return active.slice(start, start + this.routesPerSlide);
  }

  get canRoutePrev(): boolean {
    return this.routeSlideIndex > 0;
  }

  get canRouteNext(): boolean {
    return this.routeSlideIndex < this.getMaxRouteSlide();
  }

  fullscreenActive = false;
  isRefreshing = false;
  refreshError = '';
  readonly defaultCenter: L.LatLngExpression = [21.9667, -79.4333]; // Municipio Sancti Spíritus, Cuba
  readonly defaultZoom = 12;

  constructor(
    private routesService: RoutesService,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    // Configurar iconos de Leaflet
    this.setupLeafletIcons();
    this.routesSub = this.routesService.routes$.subscribe(routes => {
      this.plannedRoutes = routes;
      this.clampRouteSlide();
      this.renderNetwork();
    });
    this.vehiclesSub = this.routesService.vehicles$.subscribe(vehicles => {
      this.vehicles = vehicles;
      this.clampVehicleSlide();
      this.renderNetwork();
    });
    
    // Suscribirse a cambios de tema
    this.themeSubscription = this.themeService.theme$.subscribe(() => {
      this.updateMapTheme();
    });
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
    const mapElement = document.getElementById('monitoring-map');
    if (!mapElement) {
      console.error('Elemento del mapa no encontrado');
      return;
    }

    // Restaurar estado del mapa si existe, sino usar valores por defecto
    const savedCenter = this.getSavedMapCenter();
    const savedZoom = this.getSavedMapZoom();

    // Crear el mapa centrado en el municipio Sancti Spíritus, Cuba
    this.map = L.map('monitoring-map', {
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
    const currentVehicles = this.routesService.getCurrentVehicles();
    if (currentRoutes.length > 0) {
      this.plannedRoutes = currentRoutes;
      this.clampRouteSlide();
    }
    if (currentVehicles.length > 0) {
      this.vehicles = currentVehicles;
      this.clampVehicleSlide();
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
    localStorage.setItem('map-center-monitoring', JSON.stringify([center.lat, center.lng]));
    localStorage.setItem('map-zoom-monitoring', zoom.toString());
  }

  private getSavedMapCenter(): L.LatLngExpression | null {
    const saved = localStorage.getItem('map-center-monitoring');
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
    const saved = localStorage.getItem('map-zoom-monitoring');
    return saved ? parseInt(saved, 10) : null;
  }

  private renderNetwork() {
    if (!this.map) {
      return;
    }
    this.routeLayers.forEach(layer => layer.remove());
    this.routeLayers = [];
    this.stopMarkers.forEach(marker => marker.remove());
    this.stopMarkers = [];
    this.terminalMarkers.forEach(marker => marker.remove());
    this.terminalMarkers = [];
    this.vehicleMarkers.forEach(marker => marker.remove());
    this.vehicleMarkers = [];

    this.plannedRoutes.forEach(route => {
      if (!route.polyline.length) {
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
      const polyline = L.polyline(route.polyline, {
        color: routeColor,
        weight: 5,
        opacity: 1.0,
        className: 'route-main'
      }).addTo(this.map!);
      this.routeLayers.push(polyline);

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

      // Filtrar paradas que están dentro de la ruta
      const stopsWithinRoute = route.paradas.filter(stop => {
        return this.isStopWithinRoute(stop, route.polyline);
      });

      stopsWithinRoute.forEach((stop, index) => {
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
          iconAnchor: [centerPoint, centerPoint], // Anclaje siempre en el CENTRO exacto
          popupAnchor: [0, -centerPoint] // Ajuste del popup
        });
        
        const marker = L.marker([stop.lat, stop.lng], {
          icon: icon,
          draggable: false
        }).addTo(this.map!);
        
        // Construir popup con dirección si está disponible
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

    this.vehicles.forEach(vehicle => {
      const isActive = vehicle.gpsActivo !== false; // Por defecto activo si no se especifica
      // Icono pequeño con círculo de fondo y icono de carro dentro
      // El anclaje en el centro asegura que se mantenga fijo al hacer zoom
      const iconSize = 32; // Tamaño pequeño para rendimiento óptimo
      const centerPoint = iconSize / 2;
      
      const circleColor = isActive ? '#10b981' : '#6b7280';
      const icon = L.divIcon({
        className: 'vehicle-marker-container',
        html: `
          <div class="vehicle-marker-wrapper" style="position: relative; width: ${iconSize}px; height: ${iconSize}px;">
            <div class="vehicle-circle ${isActive ? 'active' : 'inactive'}" 
                 style="width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; background: ${circleColor}; border: 2px solid #000000; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4); position: relative; z-index: 1000;">
              <i class="fas fa-car" style="color: #facc15; font-size: 0.75rem; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));"></i>
            </div>
          </div>
        `,
        iconSize: [iconSize, iconSize],
        iconAnchor: [centerPoint, centerPoint],
        popupAnchor: [0, -centerPoint]
      });
      
      const marker = L.marker([vehicle.lat, vehicle.lng], { icon }).addTo(this.map!);
      marker.bindPopup(`
        <div class="vehicle-popup">
          <strong>${vehicle.unidad}</strong><br>
          Conductor: ${vehicle.conductor}<br>
          Estado: ${vehicle.estado}<br>
          GPS: ${isActive ? '<span style="color: #10b981;">● Activo</span>' : '<span style="color: #6b7280;">○ Inactivo</span>'}${vehicle.velocidad !== undefined ? `<br>Velocidad: ${vehicle.velocidad} km/h` : ''}
        </div>
      `);
      this.vehicleMarkers.push(marker as any);
    });
  }

  private isStopWithinRoute(stop: { lat: number; lng: number }, polyline: Array<[number, number]>): boolean {
    if (polyline.length < 2) {
      return false;
    }
    const stopPoint = L.latLng(stop.lat, stop.lng);
    // Distancia máxima permitida en grados (aproximadamente 100 metros)
    const MAX_DISTANCE = 0.001;
    
    for (let i = 0; i < polyline.length - 1; i++) {
      const start = L.latLng(polyline[i]);
      const end = L.latLng(polyline[i + 1]);
      const distance = this.distancePointToSegment(stopPoint, start, end);
      if (distance <= MAX_DISTANCE) {
        return true;
      }
    }
    return false;
  }

  private distancePointToSegment(point: L.LatLng, start: L.LatLng, end: L.LatLng): number {
    const A = point.lng - start.lng;
    const B = point.lat - start.lat;
    const C = end.lng - start.lng;
    const D = end.lat - start.lat;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    let xx, yy;
    if (param < 0) {
      xx = start.lng;
      yy = start.lat;
    } else if (param > 1) {
      xx = end.lng;
      yy = end.lat;
    } else {
      xx = start.lng + param * C;
      yy = start.lat + param * D;
    }
    const dx = point.lng - xx;
    const dy = point.lat - yy;
    return Math.sqrt(dx * dx + dy * dy);
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
      document.exitFullscreen().catch(() => {});
    }
    // Actualizar el estado del scroll después de un pequeño delay
    setTimeout(() => {
      this.updateScrollWheelZoom();
    }, 100);
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
      const { routes, vehicles } = await this.routesService.refreshData();
      this.plannedRoutes = routes;
      this.vehicles = vehicles;
      this.renderNetwork();
    } catch (error) {
      console.error('No se pudo actualizar el mapa de monitoreo', error);
      this.refreshError = 'No se pudo actualizar el mapa. Inténtalo nuevamente.';
    } finally {
      this.isRefreshing = false;
    }
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

  getStatusClass(state?: string): string {
    const normalized = (state || '').toLowerCase();
    if (normalized.includes('ruta') || normalized.includes('activo')) {
      return 'status-chip--route';
    }
    if (normalized.includes('parada') || normalized.includes('espera')) {
      return 'status-chip--stop';
    }
    return 'status-chip--idle';
  }

  getSpeedPercent(vehicle: Vehicle): string {
    const speed = vehicle?.velocidad ?? 0;
    const percent = Math.max(0, Math.min(100, (speed / 120) * 100));
    return `${percent}%`;
  }

  getRouteStatusClass(status: RouteStatus): string {
    return status === 'Activa' ? 'status-chip--route-alt' : 'status-chip--idle';
  }

  getStopCountLabel(route: PlannedRoute): string {
    const count = route.paradas?.length ?? 0;
    return count === 1 ? '1 parada' : `${count} paradas`;
  }

  onVehicleNav(direction: 'prev' | 'next') {
    if (direction === 'prev' && this.canVehiclePrev) {
      this.vehicleSlideIndex -= 1;
    } else if (direction === 'next' && this.canVehicleNext) {
      this.vehicleSlideIndex += 1;
    }
  }

  onRouteNav(direction: 'prev' | 'next') {
    if (direction === 'prev' && this.canRoutePrev) {
      this.routeSlideIndex -= 1;
    } else if (direction === 'next' && this.canRouteNext) {
      this.routeSlideIndex += 1;
    }
  }

  private getMaxVehicleSlide(): number {
    if (!this.vehicles.length) {
      return 0;
    }
    return Math.max(Math.ceil(this.vehicles.length / this.vehiclesPerSlide) - 1, 0);
  }

  private getMaxRouteSlide(): number {
    const total = this.activeRoutes.length;
    if (!total) {
      return 0;
    }
    return Math.max(Math.ceil(total / this.routesPerSlide) - 1, 0);
  }

  private clampVehicleSlide() {
    this.vehicleSlideIndex = Math.min(this.vehicleSlideIndex, this.getMaxVehicleSlide());
    if (this.vehicleSlideIndex < 0) {
      this.vehicleSlideIndex = 0;
    }
  }

  private clampRouteSlide() {
    this.routeSlideIndex = Math.min(this.routeSlideIndex, this.getMaxRouteSlide());
    if (this.routeSlideIndex < 0) {
      this.routeSlideIndex = 0;
    }
  }
}

