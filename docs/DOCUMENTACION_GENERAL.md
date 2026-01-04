# Documentación General del Proyecto - Gestión Ecomovil

## 1. Visión General
**Gestión Ecomovil** es una plataforma web integral desarrollada en **Angular** para la administración y monitoreo de transporte urbano ecológico. El sistema permite a los administradores gestionar flotas, visualizar rutas en tiempo real, atender reportes de incidencias y mantener un control de seguridad sobre el acceso al sistema.

## 2. Arquitectura Técnica
El proyecto sigue una arquitectura modular basada en componentes y servicios de Angular (Standalone Components).

### Tecnologías Clave
- **Framework**: Angular (versión más reciente).
- **Mapas**: Leaflet.js para visualización interactiva y gestión de rutas.
- **Estilos**: CSS3 nativo con variables CSS para soportar temas (Claro/Oscuro).
- **Iconos**: FontAwesome.

### Estructura de Directorios Principal
- `src/app/core/`: Servicios singleton y modelos de datos (lógica de negocio).
- `src/app/pages/`: Componentes de página (vistas principales).
- `src/app/shared/`: Componentes reutilizables (Layout, Diálogos).
- `src/docs/`: Documentación del proyecto.

## 3. Módulos y Funcionalidades

### 3.1. Autenticación y Seguridad
- **Servicio**: `AuthService`.
- **Roles**: Soporta roles de `admin` y `driver`.
- **Funcionalidad**: Control de inicio de sesión, protección de rutas (Guards), y gestión de sesiones activas.
- **Persistencia**: Mantiene el estado del usuario mediante `localStorage` y `sessionStorage`.

### 3.2. Dashboard
- **Vista**: `DashboardComponent` / `HomeComponent`.
- **Propósito**: Panel principal con métricas clave y accesos directos.

### 3.3. Monitoreo en Tiempo Real
- **Vista**: `MonitoringComponent`.
- **Características**:
    - Mapa interactivo con Leaflet.
    - Visualización en tiempo real de la ubicación de vehículos.
    - Trazado de rutas y paradas activas.
    - Panel de detalles al seleccionar un vehículo.

### 3.4. Gestión de Flota
Este módulo núcleo permite la administración completa de los recursos:

*   **Conductores (`ConductoresComponent`)**:
    - Registro, edición y eliminación de conductores.
    - Gestión de licencias y asignación de vehículos.
*   **Vehículos (`VehiculosComponent`)**:
    - CRUD completo de vehículos (Ecotaxis, Minivans).
    - Control de estado (Activo, En Mantenimiento, etc.).
*   **Rutas (`RutasComponent`)**:
    - Herramienta avanzada de dibujo de rutas sobre el mapa.
    - Gestión de paradas (crear, mover, renombrar).
    - Cálculo de distancias y validación de trazados.

### 3.5. Operaciones y Soporte
*   **Reportes (`ReportsComponent`)**: Sistema para gestionar incidencias reportadas por conductores. Permite cambiar estados (Abierto, En Proceso, Cerrado) y acceder a un chat.
*   **Soporte (`AdminSupportComponent`)**: Interfaz para la comunicación directa entre administración y personal en campo.
*   **Averías (`DriverIssuesComponent`)**: Vista específica para que los conductores reporten problemas.

### 3.6. Administración del Sistema
*   **Historial de Auditoría (`HistoryComponent`)**:
    - Registro inmutable de todas las acciones críticas (Crear, Editar, Eliminar).
    - Filtros por categoría y tipo de acción.
    - Accesible solo para administradores.
*   **Control de Sesiones (`AdminSessionsComponent`)**:
    - Visualización de usuarios conectados en tiempo real.
    - Capacidad de cerrar sesiones remotamente.
    - Gestión de usuarios y restablecimiento de contraseñas.

### 3.7. Configuración (`SettingsComponent`)
- Gestión del perfil de usuario, cambio de contraseña y preferencias generales.

## 4. Servicios Core (`src/app/core/services/`)

1.  **`FleetService`**: Maneja el estado global de Conductores y Vehículos. Utiliza `BehaviorSubject` para reactividad.
2.  **`RoutesService`**: Centraliza la lógica de las rutas geográficas y la sincronización entre el editor de rutas y el monitoreo.
3.  **`AuditService`**: Servicio transversal que intercepta acciones para generar logs de auditoría automáticos.
4.  **`ThemeService`**: Controla el cambio de tema (Claro/Oscuro) manipulando variables CSS en el `root` y el `body`.
5.  **`ConfirmationService`**: Proporciona una interfaz unificada para diálogos modales, reemplazando las alertas nativas del navegador.

## 5. Diseño y UX
El proyecto implementa un sistema de diseño "Premium" personalizado:
- **Temas**: Soporte nativo para modo Claro y Oscuro con transición suave.
- **Esquema de Color**:
    - *Modo Oscuro*: Fondos negros/grises oscuros con acentos dorados (`#FFC107`).
    - *Modo Claro*: Fondos blancos/crema con acentos amarillos y textos oscuros.
- **Componentes UI**: Botones con gradientes, tarjetas con sombras suaves, tablas estilizadas y feedback visual interactivo (hover effects).

## 6. Base de Datos (Simulada)
Actualmente, el sistema utiliza **Persistencia Local** (`localStorage`) para simular un backend. Esto permite que la aplicación sea funcional y retenga datos entre recargas sin necesidad de un servidor real desplegado.
