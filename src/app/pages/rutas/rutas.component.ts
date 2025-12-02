import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LayoutComponent } from '../../shared/layout/layout.component';
import * as L from 'leaflet';
import { PlannedRoute, RouteStop, Vehicle } from '../../core/models/routes.model';
import { RoutesService } from '../../core/services/routes.service';
import { ThemeService } from '../../core/services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [CommonModule, FormsModule, LayoutComponent],
  templateUrl: './rutas.component.html',
  styleUrl: './rutas.component.css'
})
export class RutasComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapWrapper', { static: false }) mapWrapper?: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private draftRoutePolyline: L.Polyline | null = null;
  private draftRouteMarkers: Array<L.Marker | L.CircleMarker> = [];
  private activeRoutePolyline: L.Polyline | null = null;
  private activeRouteShadow: L.Polyline | null = null;
  private activeRouteBorder: L.Polyline | null = null;
  private activeStopMarkers: L.Marker[] = [];
  private activeRouteNodes: L.CircleMarker[] = [];
  private vehicleMarkers: L.Marker[] = [];
  private routeTerminalMarkers: L.Marker[] = [];
  private mapClickHandler?: (event: L.LeafletMouseEvent) => void;
  private themeSubscription?: Subscription;

  routes: PlannedRoute[] = [
    {
      id: 1,
      nombre: 'Ruta Centro',
      origen: 'Parque Serafín',
      destino: 'Plaza Mayor',
      estado: 'Activa',
      polyline: [
        [21.9667, -79.4333],
        [21.9680, -79.4310],
        [21.9700, -79.4280]
      ],
      color: '#efb810',
      paradas: [
        { id: 11, nombre: 'Parada 1', lat: 21.9670, lng: -79.4320 },
        { id: 12, nombre: 'Parada 2', lat: 21.9685, lng: -79.4300 },
        { id: 13, nombre: 'Parada 3', lat: 21.9695, lng: -79.4290 }
      ]
    },
    {
      id: 2,
      nombre: 'Ruta Norte',
      origen: 'Avenida Libertad',
      destino: 'Estación Central',
      estado: 'Activa',
      polyline: [
        [21.9650, -79.4350],
        [21.9640, -79.4370],
        [21.9630, -79.4390]
      ],
      color: '#111111',
      paradas: [
        { id: 21, nombre: 'Norte 1', lat: 21.9645, lng: -79.4360 },
        { id: 22, nombre: 'Norte 2', lat: 21.9635, lng: -79.4380 }
      ]
    }
  ];

  vehicles: Vehicle[] = [
    // R-1: Posicionado sobre la Ruta Centro (entre punto 1 y 2 del polyline)
    { id: 101, unidad: 'R-1', conductor: 'Bruno Díaz', estado: 'En ruta', lat: 21.96735, lng: -79.43215, color: '#facc15', velocidad: 48, gpsActivo: true },
    // R-2: Posicionado cerca de una parada de la Ruta Centro
    { id: 102, unidad: 'R-2', conductor: 'Selena Pérez', estado: 'En parada', lat: 21.9670, lng: -79.4320, color: '#111111', velocidad: 0, gpsActivo: true },
    // R-3: Posicionado sobre la Ruta Norte (entre punto 1 y 2 del polyline)
    { id: 103, unidad: 'R-3', conductor: 'Marta Ruiz', estado: 'En ruta', lat: 21.9645, lng: -79.4360, color: '#f97316', velocidad: 32, gpsActivo: false }
  ];

  paletteColors: string[] = ['#efb810', '#111111', '#f97316', '#0ea5e9', '#10b981', '#f43f5e'];

  isAddingStop = false;
  isMapExpanded = false;
  isDrawingRoute = false;
  fullscreenActive = false;
  isRefreshing = false;
  refreshError = '';
  isRouteEditing = false;
  scissorMode = false;
  scissorSelection: number[] = [];
  draftRoutePoints: L.LatLngExpression[] = [];
  selectedRouteId: number | null = null;
  stopTargetRouteId: number | null = null;
  selectedStopId: number | null = null;
  pendingStopMessage = '';
  hasPendingChanges = false;
  showInitialHint = true;
  extendingStart = false;
  extendingEnd = false;
  extensionPoints: L.LatLngExpression[] = [];
  private historyStack: Array<{ routes: PlannedRoute[]; vehicles: Vehicle[] }> = [];
  private historyIndex = -1;
  private readonly MAX_HISTORY = 50;

  readonly defaultCenter: L.LatLngExpression = [21.9667, -79.4333]; // Municipio Sancti Spíritus, Cuba
  readonly defaultZoom = 12;

  constructor(
    private routesService: RoutesService,
    private themeService: ThemeService
  ) {}

  get selectedRoute(): PlannedRoute | null {
    return this.routes.find(route => route.id === this.selectedRouteId) ?? null;
  }

  get selectedStop(): RouteStop | null {
    if (!this.selectedRoute || !this.selectedStopId) {
      return null;
    }
    return this.selectedRoute.paradas.find(stop => stop.id === this.selectedStopId) ?? null;
  }

  get hasDraftRoute(): boolean {
    return this.draftRoutePoints.length > 0;
  }

  get canUndo(): boolean {
    return this.historyIndex > 0;
  }

  get canRedo(): boolean {
    return this.historyIndex < this.historyStack.length - 1;
  }

  ngOnInit(): void {
    this.setupLeafletIcons();
    const sharedRoutes = this.routesService.getCurrentRoutes();
    const sharedVehicles = this.routesService.getCurrentVehicles();
    if (sharedRoutes.length) {
      this.routes = sharedRoutes.map(route => ({
        ...route,
        polyline: route.polyline.map(point => [point[0], point[1]] as [number, number]),
        paradas: route.paradas.map(stop => ({ ...stop }))
      }));
    }
    if (sharedVehicles.length) {
      this.vehicles = sharedVehicles.map(vehicle => ({ ...vehicle }));
    }
    this.saveToHistory();
    this.syncSharedState();
    
    // Suscribirse a cambios de tema
    this.themeSubscription = this.themeService.theme$.subscribe(() => {
      this.updateMapTheme();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 200);
  }

  ngOnDestroy(): void {
    if (this.mapClickHandler && this.map) {
      this.map.off('click', this.mapClickHandler);
    }
    if (this.map) {
      this.map.remove();
    }
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }

  editRoute(route: PlannedRoute) {
    const nuevoNombre = prompt('Renombrar ruta', route.nombre);
    if (!nuevoNombre) {
      return;
    }
    this.routes = this.routes.map(r => r.id === route.id ? { ...r, nombre: nuevoNombre } : r);
    if (this.selectedRouteId === route.id) {
      this.renderSelectedRoute();
    }
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  deleteRoute(route: PlannedRoute) {
    if (!confirm('¿Eliminar esta ruta?')) {
      return;
    }
    this.routes = this.routes.filter(r => r.id !== route.id);
    if (this.selectedRouteId === route.id) {
      this.clearSelection();
    }
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  startRouteDrawing() {
    this.isDrawingRoute = true;
    this.isAddingStop = false;
    this.stopTargetRouteId = null;
    this.selectedRouteId = null;
    this.pendingStopMessage = '';
    this.showInitialHint = false;
    this.resetDraftRoute();
    this.clearActiveRouteLayers();
  }

  async finishRouteDrawing() {
    if (this.draftRoutePoints.length < 2) {
      alert('La ruta necesita al menos un inicio y un fin.');
      return;
    }

    const metadata = await this.promptRouteMetadata();
    if (!metadata) {
      return;
    }

    const newRoute: PlannedRoute = {
      id: Date.now(),
      nombre: metadata.nombre,
      origen: metadata.origen,
      destino: metadata.destino,
      estado: 'Activa',
      polyline: this.draftRoutePoints.map(point => this.toTuple(point)),
      color: metadata.color,
      paradas: []
    };

    this.routes = [newRoute, ...this.routes];
    this.selectedRouteId = newRoute.id;
    this.stopTargetRouteId = newRoute.id;
    this.isAddingStop = false;
    this.isDrawingRoute = false;
    this.pendingStopMessage = 'Ruta creada. Usa "Agregar paradas" para completar la información antes de persistirla.';
    this.resetDraftRoute();
    this.renderSelectedRoute();
    // Sincronizar inmediatamente con los otros mapas
    this.syncSharedState();
    this.markPendingChanges();
  }

  cancelRouteDrawing() {
    this.isDrawingRoute = false;
    this.resetDraftRoute();
    this.pendingStopMessage = '';
  }

  startAddingStopForSelectedRoute() {
    if (!this.selectedRoute) {
      alert('Selecciona primero la ruta que deseas editar.');
      return;
    }
    this.startAddingStopForRoute(this.selectedRoute);
  }

  startAddingStopForRoute(route: PlannedRoute) {
    this.viewRoute(route);
    this.stopTargetRouteId = route.id;
    this.isAddingStop = true;
    this.pendingStopMessage = `Agregando paradas para ${route.nombre}. Haz clic en el mapa para posicionarlas.`;
  }

  finishStopMode() {
    this.isAddingStop = false;
    this.stopTargetRouteId = null;
    this.pendingStopMessage = '';
  }

  viewRoute(route: PlannedRoute) {
    this.selectedRouteId = route.id;
    this.stopTargetRouteId = null;
    this.isAddingStop = false;
    this.pendingStopMessage = '';
    this.showInitialHint = false;
    this.renderSelectedRoute();
    this.centerOnRoute(route);
  }

  clearSelection() {
    this.selectedRouteId = null;
    this.stopTargetRouteId = null;
    this.selectedStopId = null;
    this.isAddingStop = false;
    this.pendingStopMessage = '';
    this.clearActiveRouteLayers();
  }

  dismissInitialHint() {
    this.showInitialHint = false;
    // No cerrar el mensaje si está en modo extensión
    if (!this.pendingStopMessage || this.extendingStart || this.extendingEnd) {
      if (!this.extendingStart && !this.extendingEnd) {
        this.pendingStopMessage = '';
      }
    }
  }

  selectStop(stop: RouteStop, event?: Event) {
    // Solo permitir selección si está en modo edición
    if (!this.isRouteEditing) {
      return;
    }
    if (event) {
      event.stopPropagation();
    }
    if (this.selectedStopId === stop.id) {
      // Si ya está seleccionada, deseleccionar
      this.selectedStopId = null;
    } else {
      this.selectedStopId = stop.id;
    }
    // Actualizar el renderizado para reflejar la selección en el mapa
    if (this.selectedRoute) {
      this.renderSelectedRoute();
    }
  }

  clearStopSelection() {
    this.selectedStopId = null;
    // Actualizar el renderizado para reflejar la deselección en el mapa
    if (this.selectedRoute) {
      this.renderSelectedRoute();
    }
  }

  editStop(stop: RouteStop) {
    const route = this.selectedRoute;
    if (!route) {
      return;
    }
    const nuevoNombre = prompt('Editar nombre de la parada', stop.nombre)?.trim();
    if (!nuevoNombre) {
      return;
    }
    const nuevaDescripcion = prompt('Descripción de la parada', stop.descripcion ?? '')?.trim() ?? stop.descripcion ?? '';
    route.paradas = route.paradas.map(p => p.id === stop.id ? { ...p, nombre: nuevoNombre, descripcion: nuevaDescripcion } : p);
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  removeStop(stop: RouteStop, routeOverride?: PlannedRoute) {
    const target = routeOverride ?? this.selectedRoute;
    if (!target) {
      return;
    }
    if (!confirm(`¿Está seguro de que desea eliminar la parada "${stop.nombre}"?`)) {
      return;
    }
    target.paradas = target.paradas.filter(p => p.id !== stop.id);
    // Si la parada eliminada estaba seleccionada, limpiar la selección
    if (this.selectedStopId === stop.id) {
      this.selectedStopId = null;
    }
    // Renumerar las paradas restantes para que tengan números consecutivos
    this.renumberStops(target);
    this.routes = this.routes.map(route => route.id === target.id ? { ...target } : route);
    this.renderSelectedRoute();
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  centerMap() {
    if (this.map) {
      this.map.setView(this.defaultCenter, this.defaultZoom);
    }
  }

  toggleMapSize() {
    this.isMapExpanded = !this.isMapExpanded;
    setTimeout(() => {
      if (this.map) {
        // Mantener el mismo centro y zoom al cambiar tamaño
        const currentCenter = this.map.getCenter();
        const currentZoom = this.map.getZoom();
        this.map.invalidateSize();
        // Restaurar después de invalidar
        setTimeout(() => {
          if (this.map) {
            this.map.setView(currentCenter, currentZoom);
          }
        }, 50);
      }
    }, 300);
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

  async refreshData() {
    if (this.isRefreshing) {
      return;
    }
    this.refreshError = '';
    this.isRefreshing = true;
    try {
      const { routes, vehicles } = await this.routesService.refreshData();
      this.routes = routes.map(route => ({
        ...route,
        polyline: route.polyline.map(point => [point[0], point[1]] as [number, number]),
        paradas: route.paradas.map(stop => ({ ...stop }))
      }));
      this.vehicles = vehicles.map(vehicle => ({ ...vehicle }));
      this.renderSelectedRoute();
      this.renderVehicles();
    } catch (error) {
      console.error('No se pudo actualizar el mapa de rutas', error);
      this.refreshError = 'No se pudo actualizar el mapa. Inténtalo nuevamente.';
    } finally {
      this.isRefreshing = false;
    }
  }

  private setupLeafletIcons() {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }

  private initMap() {
    const element = document.getElementById('routes-map');
    if (!element) {
      console.error('Elemento del mapa no encontrado');
      return;
    }
    // Restaurar estado del mapa si existe, sino usar valores por defecto
    const savedCenter = this.getSavedMapCenter();
    const savedZoom = this.getSavedMapZoom();
    
    this.map = L.map('routes-map', {
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
    
    // Ajustar tamaño cuando cambia el contenedor
    this.map.on('resize', () => {
      // Mantener el mismo centro y zoom al redimensionar
      const currentCenter = this.map!.getCenter();
      const currentZoom = this.map!.getZoom();
      setTimeout(() => {
        if (this.map) {
          this.map.setView(currentCenter, currentZoom);
        }
      }, 100);
    });

    this.mapClickHandler = (event: L.LeafletMouseEvent) => this.handleMapClick(event);
    this.map.on('click', this.mapClickHandler);
    this.renderVehicles();
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
      // Aplicar filtro CSS para oscurecer el fondo pero mantener colores de carreteras y ríos
      this.tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        className: 'dark-map-tiles' // Clase para aplicar filtros CSS
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
    localStorage.setItem('map-center-routes', JSON.stringify([center.lat, center.lng]));
    localStorage.setItem('map-zoom-routes', zoom.toString());
  }

  private getSavedMapCenter(): L.LatLngExpression | null {
    const saved = localStorage.getItem('map-center-routes');
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
    const saved = localStorage.getItem('map-zoom-routes');
    return saved ? parseInt(saved, 10) : null;
  }

  private handleMapClick(event: L.LeafletMouseEvent) {
    // Prevenir que se agreguen nodos si hay una parada seleccionada
    if (this.selectedStopId !== null) {
      return;
    }
    
    if (this.isAddingStop) {
      this.createStopAt(event.latlng); // Ya es async, no necesita await aquí
    } else if (this.isDrawingRoute) {
      this.addRoutePoint(event.latlng);
    } else if (this.extendingStart || this.extendingEnd) {
      // Modo extensión de inicio o fin
      this.addExtensionPoint(event.latlng);
    } else if (this.scissorMode && this.isRouteEditing && this.selectedRoute) {
      this.insertNodeAt(event.latlng);
    } else if (this.isRouteEditing && this.selectedRoute && !this.scissorMode && !this.extendingStart && !this.extendingEnd) {
      // Permitir agregar nodos cuando está en modo edición pero no en modo tijera ni extensión
      this.insertNodeAt(event.latlng);
    }
  }

  private addExtensionPoint(latlng: L.LatLng) {
    const exactPoint: [number, number] = [latlng.lat, latlng.lng];
    this.extensionPoints.push(exactPoint);

    // Crear marcador temporal para visualizar el punto
    const marker = L.circleMarker(latlng, {
      radius: 6,
      color: this.extendingStart ? '#16a34a' : '#ef4444',
      weight: 2,
      fillColor: this.extendingStart ? '#22c55e' : '#f87171',
      fillOpacity: 0.9,
    }).addTo(this.map!);

    marker.bindTooltip(this.extendingStart ? `Punto inicio ${this.extensionPoints.length}` : `Punto fin ${this.extensionPoints.length}`, { permanent: false });
    this.draftRouteMarkers.push(marker);

    // Si hay más de un punto, dibujar línea temporal
    if (this.extensionPoints.length >= 2) {
      if (!this.draftRoutePolyline) {
        this.draftRoutePolyline = L.polyline(this.extensionPoints, {
          color: this.extendingStart ? '#16a34a' : '#ef4444',
          weight: 4,
          dashArray: '8 6',
        }).addTo(this.map!);
      } else {
        this.draftRoutePolyline.setLatLngs(this.extensionPoints);
      }
    }
  }

  private async createStopAt(latlng: L.LatLng) {
    if (!this.stopTargetRouteId) {
      alert('Selecciona primero la ruta a la que deseas agregar paradas.');
      this.isAddingStop = false;
      return;
    }
    const targetRoute = this.routes.find(route => route.id === this.stopTargetRouteId);
    if (!targetRoute) {
      alert('Ruta no encontrada para agregar la parada.');
      this.isAddingStop = false;
      return;
    }

    // Validar que el punto esté cerca de la línea de la ruta
    if (targetRoute.polyline.length < 2) {
      alert('La ruta necesita al menos dos puntos para agregar paradas.');
      this.isAddingStop = false;
      return;
    }

    // Verificar que el punto esté suficientemente cerca de la ruta (máximo 50 metros)
    const distanceToRoute = this.distanceToRoute(latlng, targetRoute.polyline);
    const MAX_DISTANCE_METERS = 50;
    const MAX_DISTANCE_DEGREES = MAX_DISTANCE_METERS / 111000; // Aproximadamente 1 grado = 111km

    if (distanceToRoute > MAX_DISTANCE_DEGREES) {
      alert(`El punto seleccionado está demasiado lejos de la ruta (más de ${MAX_DISTANCE_METERS}m). Por favor, haz clic más cerca de la línea amarilla de la ruta.`);
      this.isAddingStop = false;
      return;
    }

    // Usar las coordenadas EXACTAS del clic, no ajustar a la ruta
    // Obtener la dirección de la calle mediante geocodificación inversa con las coordenadas exactas
    this.pendingStopMessage = 'Obteniendo dirección de la calle...';
    const direccion = await this.reverseGeocode(latlng);
    
    const nombre = prompt('Nombre de la parada:', `Parada ${targetRoute.paradas.length + 1}`)?.trim();
    if (!nombre) {
      this.isAddingStop = false;
      this.pendingStopMessage = '';
      return;
    }

    const descripcion = prompt('Descripción de la parada (opcional):', direccion || '')?.trim() || direccion || '';
    // Usar las coordenadas EXACTAS del clic
    const stop = { 
      id: Date.now(), 
      nombre, 
      lat: latlng.lat, // Coordenadas exactas del clic
      lng: latlng.lng, // Coordenadas exactas del clic
      descripcion,
      direccion: direccion || undefined
    };
    targetRoute.paradas = [...targetRoute.paradas, stop];
    this.routes = this.routes.map(route => route.id === targetRoute.id ? { ...targetRoute } : route);
    this.renderSelectedRoute();
    this.isAddingStop = false;
    this.pendingStopMessage = '';
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  private distanceToRoute(point: L.LatLng, polyline: Array<[number, number]>): number {
    if (polyline.length < 2) {
      return Number.POSITIVE_INFINITY;
    }

    let minDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < polyline.length - 1; i++) {
      const start = L.latLng(polyline[i]);
      const end = L.latLng(polyline[i + 1]);
      const distance = this.distancePointToSegment(point, start, end);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }

    return minDistance;
  }

  private async reverseGeocode(latlng: L.LatLng): Promise<string> {
    try {
      // Pequeño delay para evitar rate limiting de Nominatim
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Usar Nominatim con zoom más alto para mayor precisión en la calle exacta
      // zoom=18 es para edificios, pero necesitamos la calle, así que usamos zoom=16-17
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=17&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EcomovilApp/1.0',
          'Accept-Language': 'es'
        }
      });
      
      if (!response.ok) {
        console.warn('Error en respuesta de geocodificación:', response.status);
        return '';
      }
      
      const data = await response.json();
      
      if (data && data.address) {
        const addr = data.address;
        let direccion = '';
        
        // Prioridad: road (calle principal) > street > pedestrian > path
        // En Cuba, generalmente se usa 'road' para las calles
        if (addr.road) {
          direccion = addr.road;
          // Agregar número de casa solo si está disponible y es relevante
          if (addr.house_number && addr.house_number.trim()) {
            direccion = `${addr.road} #${addr.house_number}`;
          }
        } else if (addr.street) {
          direccion = addr.street;
          if (addr.house_number && addr.house_number.trim()) {
            direccion = `${addr.street} #${addr.house_number}`;
          }
        } else if (addr.pedestrian) {
          direccion = addr.pedestrian;
        } else if (addr.path) {
          direccion = addr.path;
        } else if (data.display_name) {
          // Si no hay calle específica, intentar extraer la primera parte del display_name
          // que generalmente contiene la calle
          const parts = data.display_name.split(',');
          // Buscar la parte que parece ser una calle (no ciudad, no país, etc.)
          for (const part of parts) {
            const trimmed = part.trim();
            // Si contiene números o parece ser una dirección, usarla
            if (trimmed && !trimmed.match(/^(Cuba|Sancti Spíritus|Provincia)/i)) {
              direccion = trimmed;
              break;
            }
          }
          // Si no encontramos nada, usar la primera parte
          if (!direccion && parts.length > 0) {
            direccion = parts[0].trim();
          }
        }
        
        return direccion || '';
      }
      
      return '';
    } catch (error) {
      console.error('Error en geocodificación inversa:', error);
      return '';
    }
  }

  private addRoutePoint(latlng: L.LatLng) {
    // Usar coordenadas exactas sin redondeo para máxima precisión
    const exactPoint: [number, number] = [latlng.lat, latlng.lng];
    this.draftRoutePoints.push(exactPoint);

    const marker = L.circleMarker(latlng, {
      radius: 6,
      color: this.draftRoutePoints.length === 1 ? '#16a34a' : '#111111',
      weight: 2,
      fillColor: this.draftRoutePoints.length === 1 ? '#22c55e' : '#facc15',
      fillOpacity: 0.9,
    }).addTo(this.map!);

    marker.bindTooltip(this.draftRoutePoints.length === 1 ? 'Inicio' : `Punto ${this.draftRoutePoints.length}`);
    this.draftRouteMarkers.push(marker);

    if (this.draftRoutePoints.length >= 2) {
      if (!this.draftRoutePolyline) {
        this.draftRoutePolyline = L.polyline(this.draftRoutePoints, {
          color: '#f59e0b',
          weight: 4,
          dashArray: '8 6',
        }).addTo(this.map!);
      } else {
        this.draftRoutePolyline.setLatLngs(this.draftRoutePoints);
      }
    }
  }

  private resetDraftRoute() {
    this.draftRoutePoints = [];
    this.draftRouteMarkers.forEach(marker => marker.remove());
    this.draftRouteMarkers = [];
    if (this.draftRoutePolyline) {
      this.draftRoutePolyline.remove();
      this.draftRoutePolyline = null;
    }
    // También limpiar puntos de extensión si existen
    if (this.extendingStart || this.extendingEnd) {
      this.extensionPoints = [];
    }
  }

  private async promptRouteMetadata(): Promise<{ nombre: string; origen: string; destino: string; color: string } | null> {
    const nombre = prompt('Nombre de la nueva ruta', `Ruta ${this.routes.length + 1}`)?.trim();
    if (!nombre) {
      return null;
    }
    const origen = prompt('Punto de origen', 'Origen programado')?.trim() || 'Origen pendiente';
    const destino = prompt('Punto final', 'Destino programado')?.trim() || 'Destino pendiente';
    
    // Mostrar paleta de colores en lugar de prompt hexadecimal
    const color = await this.selectColorFromPalette();
    if (!color) {
      return null; // Usuario canceló la selección
    }
    
    return { nombre, origen, destino, color };
  }

  private selectColorFromPalette(): Promise<string | null> {
    // Crear un modal simple para seleccionar color
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 1.5rem;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
    `;
    
    content.innerHTML = `
      <h3 style="margin: 0 0 1rem 0; font-size: 1.2rem;">Selecciona un color para la ruta</h3>
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; margin-bottom: 1rem;">
        ${this.paletteColors.map(color => `
          <button 
            type="button"
            class="palette-color-btn"
            data-color="${color}"
            style="
              width: 40px;
              height: 40px;
              border-radius: 8px;
              background: ${color};
              border: 2px solid #000;
              cursor: pointer;
              transition: transform 0.2s;
            "
            onmouseover="this.style.transform='scale(1.1)'"
            onmouseout="this.style.transform='scale(1)'"
          ></button>
        `).join('')}
      </div>
      <button 
        type="button"
        id="cancel-color-btn"
        style="
          padding: 0.5rem 1rem;
          background: #6b7280;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        "
      >Cancelar</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    return new Promise<string | null>((resolve) => {
      let selectedColor: string | null = this.paletteColors[0]; // Color por defecto
      
      const colorButtons = content.querySelectorAll('.palette-color-btn');
      colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          selectedColor = (btn as HTMLElement).dataset['color'] || null;
          document.body.removeChild(modal);
          resolve(selectedColor);
        });
      });
      
      const cancelBtn = content.querySelector('#cancel-color-btn');
      cancelBtn?.addEventListener('click', () => {
        document.body.removeChild(modal);
        resolve(null);
      });
      
      // Cerrar al hacer clic fuera del modal
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          document.body.removeChild(modal);
          resolve(null);
        }
      });
    });
  }

  private renderSelectedRoute() {
    this.clearActiveRouteLayers();

    if (!this.selectedRouteId || !this.map) {
      return;
    }

    const route = this.routes.find(r => r.id === this.selectedRouteId);
    if (!route) {
      return;
    }

    const routeColor = route.color || '#efb810';
    
    // Crear efecto de relieve: línea de sombra más gruesa y oscura debajo
    this.activeRouteShadow = L.polyline(route.polyline, {
      color: '#000000',
      weight: 10,
      opacity: 0.4,
      className: 'route-shadow'
    }).addTo(this.map);
    
    // Línea principal con borde blanco para contraste
    this.activeRouteBorder = L.polyline(route.polyline, {
      color: '#ffffff',
      weight: 7,
      opacity: 0.9,
      className: 'route-border'
    }).addTo(this.map);
    
    // Línea principal de la ruta
    this.activeRoutePolyline = L.polyline(route.polyline, {
      color: routeColor,
      weight: 6,
      opacity: 1.0,
      className: 'route-main'
    }).addTo(this.map);

    // Filtrar paradas que están dentro de la ruta
    const stopsWithinRoute = route.paradas.filter(stop => {
      return this.isStopWithinRoute(stop, route.polyline);
    });

    stopsWithinRoute.forEach((stop, index) => {
      // Icono de parada similar a los vehículos - círculo con número dentro
      const iconSize = 28; // Tamaño fijo para mejor rendimiento
      const centerPoint = iconSize / 2; // Punto central exacto
      const routeColor = route.color || '#efb810';
      const isSelected = this.selectedStopId === stop.id;
      
      // Crear icono circular con el color de la ruta y el número de parada
      // Si está seleccionada, usar borde más grueso y sombra más pronunciada
      const icon = L.divIcon({
        className: 'stop-marker-container',
        html: `
          <div class="stop-marker-wrapper" style="position: relative; width: ${iconSize}px; height: ${iconSize}px;">
            <div class="stop-circle" 
                 style="width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; background: ${routeColor}; border: ${isSelected ? '3px' : '2px'} solid ${isSelected ? '#ffffff' : '#000000'}; display: flex; align-items: center; justify-content: center; box-shadow: ${isSelected ? '0 4px 12px rgba(0, 0, 0, 0.6)' : '0 3px 8px rgba(0, 0, 0, 0.4)'}; position: relative; z-index: ${isSelected ? '1001' : '1000'}; transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'}; transition: transform 0.2s;">
              <span style="color: #ffffff; font-size: 0.65rem; font-weight: 700; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));">${index + 1}</span>
            </div>
          </div>
        `,
        iconSize: [iconSize, iconSize],
        iconAnchor: [centerPoint, centerPoint], // Anclaje exactamente en el CENTRO
        popupAnchor: [0, -centerPoint] // Ajuste del popup
      });
      
      const marker = L.marker([stop.lat, stop.lng], {
        icon: icon,
        // Asegurar que el marcador use las coordenadas exactas sin redondeo
        draggable: false
      }).addTo(this.map!);
      
      // Agregar evento de clic para seleccionar la parada cuando está en modo edición
      marker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation(); // Prevenir que el clic se propague al mapa
        if (this.isRouteEditing && !this.extendingStart && !this.extendingEnd) {
          this.selectStop(stop);
        }
      });
      
      // Construir tooltip con dirección si está disponible
      let tooltipText = stop.nombre;
      if (stop.direccion) {
        tooltipText += `<br><small>📍 ${stop.direccion}</small>`;
      } else if (stop.descripcion) {
        tooltipText += ` - ${stop.descripcion}`;
      }
      
      marker.bindTooltip(tooltipText, { permanent: false });
      this.activeStopMarkers.push(marker);
    });

    // Solo mostrar nodos de edición si está en modo edición pero no en modo extensión
    if (this.isRouteEditing && !this.extendingStart && !this.extendingEnd) {
      this.renderRouteNodes(route);
    } else {
      this.clearRouteNodes();
    }

    this.renderRouteTerminals(route);
  }

  private clearActiveRouteLayers() {
    if (this.activeRoutePolyline) {
      this.activeRoutePolyline.remove();
      this.activeRoutePolyline = null;
    }
    if (this.activeRouteShadow) {
      this.activeRouteShadow.remove();
      this.activeRouteShadow = null;
    }
    if (this.activeRouteBorder) {
      this.activeRouteBorder.remove();
      this.activeRouteBorder = null;
    }
    this.activeStopMarkers.forEach(marker => marker.remove());
    this.activeStopMarkers = [];
    this.clearRouteNodes();
    this.clearRouteTerminals();
  }

  centerOnRoute(route: PlannedRoute) {
    if (!this.map || route.polyline.length === 0) {
      return;
    }
    const bounds = L.latLngBounds(route.polyline as [number, number][]);
    this.map.fitBounds(bounds, { padding: [40, 40] });
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

  onRouteColorChange(color: string) {
    const route = this.selectedRoute;
    if (!route) {
      return;
    }
    route.color = color;
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  toggleRouteEditing() {
    // Si está en modo extensión, cancelar primero
    if (this.extendingStart || this.extendingEnd) {
      const cancel = confirm('¿Cancelar la extensión de la ruta? Los puntos agregados se perderán.');
      if (!cancel) {
        return;
      }
      this.cancelExtension();
    }
    
    // Si se está activando el modo edición, verificar que no haya paradas fuera de la ruta
    if (!this.isRouteEditing && this.selectedRoute) {
      const route = this.selectedRoute;
      const stopsOutside = route.paradas.filter(stop => !this.isStopWithinRoute(stop, route.polyline));
      if (stopsOutside.length > 0) {
        const stopNames = stopsOutside.map(s => s.nombre).join(', ');
        alert(`⚠️ ADVERTENCIA: No se puede editar la ruta porque hay paradas que quedaron fuera de la ruta:\n\n${stopNames}\n\nPor favor, elimine estas paradas primero antes de editar la ruta.`);
        return;
      }
    }
    
    this.isRouteEditing = !this.isRouteEditing;
    this.scissorMode = false;
    this.scissorSelection = [];
    // Limpiar selección de parada al salir del modo edición
    if (!this.isRouteEditing) {
      this.selectedStopId = null;
      this.pendingStopMessage = '';
    }
    if (this.selectedRoute) {
      this.renderSelectedRoute();
    } else {
      this.clearRouteNodes();
    }
  }

  toggleScissorMode() {
    if (!this.isRouteEditing) {
      this.toggleRouteEditing();
    }
    this.scissorMode = !this.scissorMode;
    this.scissorSelection = [];
    this.pendingStopMessage = this.scissorMode
      ? '✂️ MODO CORTAR ACTIVADO: Haz clic en cualquier nodo amarillo de la ruta para cortarla en ese punto. Si cortas en el inicio, se te pedirá confirmación para modificar el punto de inicio. Si cortas en el final o en cualquier otro punto, se te pedirá confirmación para modificar el punto final. La ruta se acortará eliminando todos los puntos después del nodo seleccionado.'
      : '';
  }

  saveChanges() {
    alert('Cambios preparados para persistencia');
    this.hasPendingChanges = false;
  }

  private renderRouteNodes(route: PlannedRoute) {
    this.clearRouteNodes();
    if (!this.map) {
      return;
    }
    route.polyline.forEach((point, index) => {
      const marker = L.circleMarker(point as L.LatLngExpression, {
        radius: 7,
        color: '#0b0b0b',
        weight: 2,
        fillColor: this.scissorMode ? '#ef4444' : '#facc15',
        fillOpacity: 0.9,
        className: 'route-node-marker'
      }).addTo(this.map!);
      marker.bindTooltip(`Nodo ${index + 1}`, { permanent: false });
      marker.on('click', (e: L.LeafletMouseEvent) => {
        e.originalEvent.stopPropagation(); // Prevenir que el clic se propague al mapa
        this.handleNodeClick(index);
      });
      this.activeRouteNodes.push(marker);
    });
  }

  private handleNodeClick(index: number) {
    if (!this.selectedRoute || !this.isRouteEditing) {
      return;
    }
    if (this.scissorMode) {
      // En modo cortar, al hacer clic en un nodo se corta en ese punto
      // Ahora permite cortar en cualquier punto, incluyendo el último
      this.cutSegmentAt(index);
      this.scissorMode = false;
      this.pendingStopMessage = '';
      return;
    }

    // Si está en modo de extensión, no permitir eliminar nodos
    if (this.extendingStart || this.extendingEnd) {
      return;
    }

    const route = this.selectedRoute;
    const isFirstNode = index === 0;
    const isLastNode = index === route.polyline.length - 1;

    // Si es el primer nodo, ofrecer opción de extender inicio
    if (isFirstNode) {
      const action = confirm(`¿Extender la ruta desde el inicio?\n\nAceptar: Extender inicio (haz clic en el mapa para agregar nuevos puntos al inicio)\nCancelar: Solo eliminar el nodo`);
      if (action) {
        // Modo extensión de inicio
        this.startExtendingStart();
      } else {
        // Solo eliminar el nodo si hay más de 2 puntos
        if (route.polyline.length > 2) {
          const shouldDelete = confirm(`¿Eliminar el nodo de inicio? El siguiente punto se convertirá en el nuevo inicio.`);
          if (shouldDelete) {
            this.removeNode(index);
          }
        } else {
          alert('La ruta necesita al menos dos puntos. Usa "Extender inicio" para agregar puntos al inicio.');
        }
      }
      return;
    }

    // Si es el último nodo, ofrecer opción de extender fin
    if (isLastNode) {
      const action = confirm(`¿Extender la ruta desde el final?\n\nAceptar: Extender fin (haz clic en el mapa para agregar nuevos puntos al final)\nCancelar: Solo eliminar el nodo`);
      if (action) {
        // Modo extensión de fin
        this.startExtendingEnd();
      } else {
        // Solo eliminar el nodo si hay más de 2 puntos
        if (route.polyline.length > 2) {
          const shouldDelete = confirm(`¿Eliminar el nodo final? El punto anterior se convertirá en el nuevo final.`);
          if (shouldDelete) {
            this.removeNode(index);
          }
        } else {
          alert('La ruta necesita al menos dos puntos. Usa "Extender fin" para agregar puntos al final.');
        }
      }
      return;
    }

    // Para nodos intermedios, solo eliminar
    const shouldDelete = confirm(`¿Eliminar el nodo ${index + 1}?`);
    if (shouldDelete) {
      this.removeNode(index);
    }
  }

  private cutSegmentAt(cutIndex: number) {
    const route = this.selectedRoute;
    if (!route || cutIndex < 0 || cutIndex >= route.polyline.length) {
      return;
    }

    // Si se corta en el primer punto, preguntar si está seguro de modificar el inicio
    if (cutIndex === 0) {
      const confirmModifyStart = confirm('¿Está seguro de que desea modificar el punto de inicio de la ruta? Esto eliminará todos los puntos después del inicio.');
      if (!confirmModifyStart) {
        return;
      }
    }
    // Si se corta en el último punto o cerca del final, preguntar si está seguro de modificar el fin
    else if (cutIndex === route.polyline.length - 1) {
      const confirmModifyEnd = confirm('¿Está seguro de que desea modificar el punto final de la ruta? Esto eliminará todos los puntos después del punto seleccionado.');
      if (!confirmModifyEnd) {
        return;
      }
    }
    // Si se corta en cualquier otro punto, también preguntar (ya que modifica el fin)
    else {
      const confirmModifyEnd = confirm('¿Está seguro de que desea modificar el punto final de la ruta? Esto eliminará todos los puntos después del punto seleccionado.');
      if (!confirmModifyEnd) {
        return;
      }
    }

    // Crear una copia temporal del polyline cortado para verificar paradas
    const tempPolyline = route.polyline.slice(0, cutIndex + 1);
    if (tempPolyline.length < 2) {
      alert('El corte dejaría la ruta sin suficientes puntos.');
      return;
    }
    
    // Verificar que no haya paradas fuera de la ruta después del corte
    const stopsOutside = route.paradas.filter(stop => !this.isStopWithinRoute(stop, tempPolyline));
    if (stopsOutside.length > 0) {
      const stopNames = stopsOutside.map(s => s.nombre).join(', ');
      alert(`⚠️ ADVERTENCIA: No se puede cortar la ruta porque las siguientes paradas quedarían fuera:\n\n${stopNames}\n\nPor favor, elimine estas paradas primero antes de cortar la ruta.`);
      return;
    }

    // Eliminar todo después del corte y poner el punto final en el corte
    route.polyline = tempPolyline;
    // Ajustar numeración consecutiva de las paradas si tienen números
    this.renumberStops(route);
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  private removeNode(index: number) {
    const route = this.selectedRoute;
    if (!route || route.polyline.length <= 2) {
      alert('La ruta necesita al menos dos puntos.');
      return;
    }
    
    // Crear una copia temporal del polyline sin el nodo para verificar paradas
    const tempPolyline = route.polyline.filter((_, i) => i !== index);
    const stopsOutside = route.paradas.filter(stop => {
      const stopPoint = L.latLng(stop.lat, stop.lng);
      const MAX_DISTANCE_METERS = 50;
      const MAX_DISTANCE = MAX_DISTANCE_METERS / 111000;
      
      for (let i = 0; i < tempPolyline.length - 1; i++) {
        const start = L.latLng(tempPolyline[i]);
        const end = L.latLng(tempPolyline[i + 1]);
        const distance = this.distancePointToSegment(stopPoint, start, end);
        if (distance <= MAX_DISTANCE) {
          return false; // La parada está dentro
        }
      }
      return true; // La parada está fuera
    });
    
    if (stopsOutside.length > 0) {
      const stopNames = stopsOutside.map(s => s.nombre).join(', ');
      alert(`⚠️ ADVERTENCIA: No se puede eliminar este nodo porque las siguientes paradas quedarían fuera de la ruta:\n\n${stopNames}\n\nPor favor, elimine estas paradas primero.`);
      return;
    }
    
    route.polyline = tempPolyline;
    // Ajustar numeración consecutiva de las paradas si tienen números
    this.renumberStops(route);
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  startExtendingStart() {
    const route = this.selectedRoute;
    if (!route || route.polyline.length < 1) {
      return;
    }
    
    // Verificar que no haya paradas fuera de la ruta
    const stopsOutside = route.paradas.filter(stop => !this.isStopWithinRoute(stop, route.polyline));
    if (stopsOutside.length > 0) {
      const stopNames = stopsOutside.map(s => s.nombre).join(', ');
      alert(`⚠️ ADVERTENCIA: No se puede extender el inicio de la ruta porque hay paradas que quedaron fuera:\n\n${stopNames}\n\nPor favor, elimine estas paradas primero.`);
      return;
    }
    
    // Limpiar cualquier marcador temporal previo
    this.resetDraftRoute();
    // Entrar en modo de extensión de inicio
    this.extendingStart = true;
    this.extendingEnd = false;
    this.extensionPoints = [];
    this.isRouteEditing = true;
    this.scissorMode = false;
    this.pendingStopMessage = '📍 MODO EXTENSIÓN DE INICIO: Haz clic en el mapa para agregar puntos al inicio de la ruta. Puedes agregar tantos puntos como necesites. Usa "Finalizar extensión" cuando termines.';
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
  }

  startExtendingEnd() {
    const route = this.selectedRoute;
    if (!route || route.polyline.length < 1) {
      return;
    }
    
    // Verificar que no haya paradas fuera de la ruta
    const stopsOutside = route.paradas.filter(stop => !this.isStopWithinRoute(stop, route.polyline));
    if (stopsOutside.length > 0) {
      const stopNames = stopsOutside.map(s => s.nombre).join(', ');
      alert(`⚠️ ADVERTENCIA: No se puede extender el fin de la ruta porque hay paradas que quedaron fuera:\n\n${stopNames}\n\nPor favor, elimine estas paradas primero.`);
      return;
    }
    
    // Limpiar cualquier marcador temporal previo
    this.resetDraftRoute();
    // Entrar en modo de extensión de fin
    this.extendingEnd = true;
    this.extendingStart = false;
    this.extensionPoints = [];
    this.isRouteEditing = true;
    this.scissorMode = false;
    this.pendingStopMessage = '📍 MODO EXTENSIÓN DE FIN: Haz clic en el mapa para agregar puntos al final de la ruta. Puedes agregar tantos puntos como necesites. Usa "Finalizar extensión" cuando termines.';
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
  }

  finishExtension() {
    const route = this.selectedRoute;
    if (!route) {
      return;
    }

    if (this.extensionPoints.length === 0) {
      alert('No se han agregado puntos. La extensión se cancelará.');
      this.cancelExtension();
      return;
    }

    // Limpiar marcadores temporales antes de agregar puntos
    this.draftRouteMarkers.forEach(marker => marker.remove());
    this.draftRouteMarkers = [];
    if (this.draftRoutePolyline) {
      this.draftRoutePolyline.remove();
      this.draftRoutePolyline = null;
    }

    if (this.extendingStart) {
      // Agregar los puntos al inicio (en orden inverso para que el último agregado sea el nuevo inicio)
      const reversedPoints = this.extensionPoints.reverse().map(p => this.toTuple(p));
      route.polyline = [...reversedPoints, ...route.polyline];
    } else if (this.extendingEnd) {
      // Agregar los puntos al final
      const newPoints = this.extensionPoints.map(p => this.toTuple(p));
      route.polyline = [...route.polyline, ...newPoints];
    }

    // Verificar que no haya paradas fuera de la ruta después del cambio
    const stopsOutside = route.paradas.filter(stop => !this.isStopWithinRoute(stop, route.polyline));
    if (stopsOutside.length > 0) {
      const stopNames = stopsOutside.map(s => s.nombre).join(', ');
      alert(`⚠️ ADVERTENCIA: Las siguientes paradas quedaron fuera de la ruta después de la extensión:\n\n${stopNames}\n\nPor favor, elimine estas paradas antes de continuar.`);
      // Revertir el cambio
      this.cancelExtension();
      this.renderSelectedRoute();
      return;
    }

    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.cancelExtension();
    this.renderSelectedRoute();
    this.syncSharedState();
    this.markPendingChanges();
  }

  cancelExtension() {
    this.extendingStart = false;
    this.extendingEnd = false;
    this.extensionPoints = [];
    this.pendingStopMessage = '';
    // Limpiar marcadores temporales de extensión
    this.draftRouteMarkers.forEach(marker => marker.remove());
    this.draftRouteMarkers = [];
    if (this.draftRoutePolyline) {
      this.draftRoutePolyline.remove();
      this.draftRoutePolyline = null;
    }
    this.renderSelectedRoute();
  }

  /**
   * Renumera las paradas para que tengan números consecutivos en sus nombres.
   * Extrae el número del nombre y lo reemplaza con un número consecutivo.
   * Ejemplo: Si se elimina "Parada 4" entre "Parada 3" y "Parada 5",
   * entonces "Parada 5" se convierte en "Parada 4".
   */
  private renumberStops(route: PlannedRoute) {
    route.paradas.forEach((stop, index) => {
      const newNumber = index + 1;
      // Detectar si el nombre tiene un patrón numérico al final (más común)
      // Ejemplos: "Parada 4", "Punto 3", "Norte 2", "Parada4", etc.
      const match = stop.nombre.match(/^(.+?)\s*(\d+)$/);
      if (match) {
        // Si tiene un número al final, reemplazarlo con el número consecutivo
        const baseName = match[1].trim();
        // Mantener el formato original (con o sin espacio)
        const hasSpace = match[0].includes(' ');
        stop.nombre = hasSpace ? `${baseName} ${newNumber}` : `${baseName}${newNumber}`;
      } else {
        // Si no tiene número al final, buscar el último número en el nombre
        const lastNumberMatch = stop.nombre.match(/(\d+)(?!.*\d)/);
        if (lastNumberMatch) {
          // Reemplazar solo el último número encontrado
          const numberStart = lastNumberMatch.index!;
          const numberLength = lastNumberMatch[0].length;
          const beforeNumber = stop.nombre.substring(0, numberStart);
          const afterNumber = stop.nombre.substring(numberStart + numberLength);
          stop.nombre = `${beforeNumber}${newNumber}${afterNumber}`;
        } else {
          // Si no hay número en el nombre, agregar uno al final
          stop.nombre = `${stop.nombre} ${newNumber}`;
        }
      }
    });
  }

  private cutSegmentBetween(first: number, second: number) {
    const route = this.selectedRoute;
    if (!route) {
      return;
    }
    // Encontrar el punto más cercano al clic (el punto de corte)
    const cutIndex = Math.min(first, second);
    // Eliminar todo después del corte
    route.polyline = route.polyline.slice(0, cutIndex + 1);
    // El último punto se convierte en el punto final
    if (route.polyline.length < 2) {
      alert('El corte dejaría la ruta sin suficientes puntos.');
      return;
    }
    // Ajustar numeración consecutiva de las paradas si tienen números
    this.renumberStops(route);
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
    this.markPendingChanges();
  }

  private insertNodeAt(latlng: L.LatLng) {
    const route = this.selectedRoute;
    if (!route || route.polyline.length < 2) {
      return;
    }
    
    // Pedir confirmación antes de agregar el punto porque esto cambia completamente la ruta
    const confirmAdd = confirm('¿Está seguro de que desea agregar un nuevo punto a la ruta? Esto modificará completamente el trazado de la ruta.');
    if (!confirmAdd) {
      return;
    }
    
    const closest = this.findClosestSegment(route.polyline, latlng);
    if (!closest) {
      return;
    }
    // Usar coordenadas exactas sin redondeo
    const exactPoint: [number, number] = [latlng.lat, latlng.lng];
    route.polyline.splice(closest.index + 1, 0, exactPoint);
    
    // Verificar si hay paradas fuera de la ruta después de agregar el punto
    const stopsOutside = route.paradas.filter(stop => !this.isStopWithinRoute(stop, route.polyline));
    if (stopsOutside.length > 0) {
      const stopNames = stopsOutside.map(s => s.nombre).join(', ');
      alert(`ADVERTENCIA: Las siguientes paradas quedaron fuera de la ruta después de agregar el punto:\n\n${stopNames}\n\nPor favor, elimine estas paradas antes de continuar editando la ruta.`);
      // Revertir el cambio
      route.polyline.splice(closest.index + 1, 1);
      this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
      this.renderSelectedRoute();
      return;
    }
    
    this.routes = this.routes.map(r => r.id === route.id ? { ...route } : r);
    this.renderSelectedRoute();
    // Sincronizar inmediatamente
    this.syncSharedState();
    this.markPendingChanges();
  }

  private findClosestSegment(points: Array<[number, number]>, latlng: L.LatLng) {
    let bestIndex = -1;
    let minDistance = Number.POSITIVE_INFINITY;
    const target = L.latLng(latlng);
    points.forEach((point, index) => {
      if (index === points.length - 1) {
        return;
      }
      const start = L.latLng(points[index]);
      const end = L.latLng(points[index + 1]);
      const distance = this.distancePointToSegment(target, start, end);
      if (distance < minDistance) {
        minDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex === -1) {
      return null;
    }
    return { index: bestIndex };
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

  private findClosestPointOnRoute(point: L.LatLng, polyline: Array<[number, number]>): [number, number] | null {
    if (polyline.length < 2) {
      return null;
    }

    let closestPoint: [number, number] | null = null;
    let minDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < polyline.length - 1; i++) {
      const start = L.latLng(polyline[i]);
      const end = L.latLng(polyline[i + 1]);
      
      // Calcular el punto más cercano en este segmento
      const A = point.lng - start.lng;
      const B = point.lat - start.lat;
      const C = end.lng - start.lng;
      const D = end.lat - start.lat;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = 0;
      
      if (lenSq !== 0) {
        param = dot / lenSq;
        // Limitar param entre 0 y 1 para estar en el segmento
        param = Math.max(0, Math.min(1, param));
      }
      
      const closestX = start.lng + param * C;
      const closestY = start.lat + param * D;
      const closest = L.latLng(closestY, closestX);
      
      const distance = this.distanceBetweenPoints(point, closest);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = [closestY, closestX];
      }
    }

    return closestPoint;
  }

  private distanceBetweenPoints(point1: L.LatLng | { lat: number; lng: number }, point2: L.LatLng | [number, number]): number {
    const lat1 = point1.lat;
    const lng1 = point1.lng;
    const lat2 = Array.isArray(point2) ? point2[0] : point2.lat;
    const lng2 = Array.isArray(point2) ? point2[1] : point2.lng;
    
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private isStopWithinRoute(stop: RouteStop, polyline: Array<[number, number]>): boolean {
    if (polyline.length < 2) {
      return false;
    }
    const stopPoint = L.latLng(stop.lat, stop.lng);
    // Distancia máxima permitida en grados (aproximadamente 50 metros, igual que al agregar)
    const MAX_DISTANCE_METERS = 50;
    const MAX_DISTANCE = MAX_DISTANCE_METERS / 111000; // Aproximadamente 1 grado = 111km
    
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

  private clearRouteNodes() {
    this.activeRouteNodes.forEach(marker => marker.remove());
    this.activeRouteNodes = [];
  }

  private renderRouteTerminals(route: PlannedRoute) {
    this.clearRouteTerminals();
    if (!this.map || route.polyline.length < 2) {
      return;
    }
    const routeColor = route.color || '#efb810';
    const start = this.createTerminalMarker(route.polyline[0], 'start', routeColor);
    const end = this.createTerminalMarker(route.polyline[route.polyline.length - 1], 'end', routeColor);
    if (start) {
      this.routeTerminalMarkers.push(start);
    }
    if (end) {
      this.routeTerminalMarkers.push(end);
    }
  }

  private createTerminalMarker(point: [number, number], type: 'start' | 'end', routeColor: string): L.Marker | null {
    if (!this.map) {
      return null;
    }
    const icon = L.divIcon({
      className: `route-terminal ${type}`,
      html: `
        <div style="width: 20px; height: 20px; border-radius: 50%; background: ${routeColor}; border: 2px solid #000000; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);"></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    const marker = L.marker(point, { icon }).addTo(this.map);
    return marker;
  }

  private clearRouteTerminals() {
    this.routeTerminalMarkers.forEach(marker => marker.remove());
    this.routeTerminalMarkers = [];
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
    if (!this.map || this.activeStopMarkers.length === 0) {
      return;
    }
    const iconSize = this.getIconSizeForZoom();
    const centerPoint = iconSize / 2; // Punto central exacto
    
    this.activeStopMarkers.forEach(marker => {
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

  private markPendingChanges() {
    this.hasPendingChanges = true;
    this.saveToHistory();
    this.syncSharedState();
  }

  private saveToHistory() {
    // Eliminar cualquier historial futuro si estamos en medio del stack
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
    }
    // Agregar estado actual al historial
    const state = {
      routes: this.routes.map(route => ({
        ...route,
        polyline: route.polyline.map(p => [p[0], p[1]] as [number, number]),
        paradas: route.paradas.map(s => ({ ...s }))
      })),
      vehicles: this.vehicles.map(v => ({ ...v }))
    };
    this.historyStack.push(state);
    this.historyIndex = this.historyStack.length - 1;
    // Limitar tamaño del historial
    if (this.historyStack.length > this.MAX_HISTORY) {
      this.historyStack.shift();
      this.historyIndex = this.historyStack.length - 1;
    }
  }

  undo() {
    if (!this.canUndo) {
      return;
    }
    this.historyIndex--;
    const state = this.historyStack[this.historyIndex];
    this.restoreState(state);
  }

  redo() {
    if (!this.canRedo) {
      return;
    }
    this.historyIndex++;
    const state = this.historyStack[this.historyIndex];
    this.restoreState(state);
  }

  private restoreState(state: { routes: PlannedRoute[]; vehicles: Vehicle[] }) {
    this.routes = state.routes.map(route => ({
      ...route,
      polyline: route.polyline.map(p => [p[0], p[1]] as [number, number]),
      paradas: route.paradas.map(s => ({ ...s }))
    }));
    this.vehicles = state.vehicles.map(v => ({ ...v }));
    this.renderSelectedRoute();
    this.renderVehicles();
    this.syncSharedState();
  }

  private syncSharedState() {
    const routesClone = this.routes.map(route => ({
      ...route,
      polyline: route.polyline.map(point => [point[0], point[1]] as [number, number]),
      paradas: route.paradas.map(stop => ({ ...stop }))
    }));
    const vehiclesClone = this.vehicles.map(vehicle => ({ ...vehicle }));
    this.routesService.setRoutes(routesClone);
    this.routesService.setVehicles(vehiclesClone);
  }

  private toTuple(point: L.LatLngExpression): [number, number] {
    if (Array.isArray(point)) {
      // Preservar precisión completa de las coordenadas
      return [point[0], point[1]] as [number, number];
    }
    const latLng = point as L.LatLng;
    // Usar lat y lng directamente sin redondeo para máxima precisión
    return [latLng.lat, latLng.lng];
  }

  private renderVehicles() {
    if (!this.map) {
      return;
    }
    this.vehicleMarkers.forEach(marker => marker.remove());
    this.vehicleMarkers = this.vehicles.map(vehicle => {
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
                 style="width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; background: ${circleColor}; border: 2px solid #000000; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4); position: relative; z-index: 1000; ${!isActive ? 'opacity: 0.8;' : ''}">
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
      return marker as any;
    });
  }
}

