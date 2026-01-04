# Historial de Cambios

## [Fecha Actual] - Integración de Estaciones y Correcciones de Seguridad

### Nuevas Características (Refactorizado)
- **Planificación Unificada**: Se integró la gestión de **Estaciones de Carga** dentro de la página de **Planificación** (antes Rutas).
  - Ahora se utiliza un sistema de pestañas para alternar entre "Rutas" y "Estaciones", simplificando la navegación.
  - Los administradores pueden crear, editar y eliminar estaciones directamente desde el mismo mapa de planificación.
- **Acceso a Monitoreo Restringido**: Se restringió el acceso a la página de **Monitoreo** (`/monitoring`) exclusivamente para administradores.
- **Mapa de Conductores**: Se integraron las **Estaciones de Carga** en el mapa del **Dashboard (Home)** para que los conductores puedan visualizarlas sin necesidad de acceder a la herramienta de monitoreo completa.
- **Sistema de Notificaciones**:
  - Se implementó un **indicador visual (badge)** en el menú lateral para avisar de nuevos mensajes de soporte.
  - Visible tanto para **Administradores** (en "Soporte") como para **Conductores** (en "Reportar Avería").
  - El contador se actualiza en tiempo real según los mensajes no leídos.
- **Estaciones de Carga Mejoradas**:
  - Se eliminó la selección de tipo de estación, unificando todas como **"Carga e Intercambio"**.
  - Se implementó la **geocodificación inversa automática**: Al crear una estación, el sistema obtendrá automáticamente la dirección basándose en las coordenadas del mapa.
  - Se actualizó el modelo de datos para incluir el campo de dirección y el nuevo tipo unificado.
- **Acceso a Monitoreo Restringido**: Se restringió el acceso a la página de **Monitoreo** (`/monitoring`) exclusivamente para administradores.
- **Mapa de Conductores**: Se integraron las **Estaciones de Carga** en el mapa del **Dashboard (Home)** para que los conductores puedan visualizarlas sin necesidad de acceder a la herramienta de monitoreo completa.
- **AuthGuard Implementado**: Se creó e implementó `AuthGuard` para proteger todas las rutas sensibles.
  - `admin`: Acceso total (Conductores, Vehículos, Planificación, Reportes, Soporte, Monitoreo).
  - `driver`: Acceso limitado (Dashboard, Reporte de Problemas).
- **Correcciones Técnicas**: Se solucionaron errores de tipado en `RutasComponent`, se eliminó el código obsoleto de estaciones y se mejoró el servicio de confirmación para soportar selectores.
- **Limpieza de Código**: Se eliminó la página independiente de estaciones para reducir deuda técnica y redundancia.

### UI/UX
- **Barra Lateral Actualizada**: Se renombró "Rutas" a "Planificación" y se eliminó el enlace redundante a Estaciones.
- **Diseño de Pestañas**: Nueva interfaz visual para cambiar modos de trabajo sin recargar la página.

---
 y Auditoría - Walkthrough

Hemos implementado una nueva funcionalidad completa para rastrear y visualizar todos los cambios importantes en la aplicación (Conductores, Vehículos, Rutas y Paradas).

## Características Implementadas

### 1. Servicio de Auditoría (`AuditService`)
- Centraliza la gestión de registros (logs).
- Almacena los datos en memoria y los persiste en `localStorage` para que no se pierdan al recargar la página.
- Soporta acciones: `CREAR`, `ACTUALIZAR`, `ELIMINAR`.
- Categorías: `CONDUCTOR`, `VEHICULO`, `RUTA`, `PARADA`, `MAPA`.

### 2. Integración Automática
El sistema registra automáticamente los cambios cuando se realizan acciones en las páginas existentes:

#### Conductores
- **Crear**: Nuevo conductor agregado.
- **Editar**: Actualización de datos personales o licencias.
- **Eliminar**: Baja de un conductor.
- **Asignación**: Cambios de vehículo asignado.

#### Vehículos
- **Crear**: Nuevo vehículo en la flota.
- **Editar**: Cambios en matrícula, estado, etc.
- **Eliminar**: Baja de un vehículo.
- **Asignación**: Cambios de conductor.

#### Rutas y Mapa
- **Rutas**: Creación, renombrado y eliminación de rutas.
- **Rutas**: Creación, renombrado y eliminación de rutas.
- **Paradas**: Agregar, mover (editar) o borrar paradas.
- **Estaciones de Carga**: Nuevas operaciones de gestión de infraestructura.

### 4. Estaciones de Carga (Nueva Funcionalidad)
Se ha añadido un sistema completo para gestionar la infraestructura de carga:
- **Vista Admin**: Nueva página "Estaciones" donde los administradores pueden añadir estaciones tocando en el mapa, editarlas o eliminarlas.
- **Vista Conductor**: Los conductores ahora tienen acceso al mapa de "Monitoreo" donde pueden visualizar la ubicación y estado de las estaciones (Disponible, Ocupada, Mantenimiento).
- **Tipos soportados**: Carga Rápida (Rayo) e Intercambio de Batería (Batería).

### 3. Página de Historial
Nueva pantalla accesible desde el menú lateral "**Historial**".
> [!NOTE]
> **Acceso Restringido**: Esta opción solo es visible y accesible para usuarios con rol de **Administrador**. Conductores y usuarios normales no verán esta opción en el menú ni podrán acceder por URL.

- **Tabla de Registros**: Muestra fecha, usuario (Admin), acción, categoría y detalles.
- **Filtros**:
    - Por Categoría (ej. ver solo cambios de Conductores).
    - Por Acción (ej. ver solo Eliminaciones).
- **Limpieza**: Botón para borrar el historial (útil para mantenimiento).
- **Diseño**: Integrado con el tema visual de la aplicación.

## Cómo Probarlo

4.  Navega a **Conductores** y crea un nuevo conductor.
5.  Ve a **Rutas** y agrega una nueva parada a una ruta.
6.  Finalmente, abre la página **Historial** en el menú lateral.
7.  Verás todas tus acciones anteriores registradas cronológicamente.

## Mejoras de UI/UX y Estandarización

Además de la funcionalidad de auditoría, se realizaron las siguientes mejoras visuales y de usabilidad:

### 1. Gestión de Sesiones
- **Indicador de Usuario Actual**: Ahora se muestra una etiqueta `(Tú)` junto a tu sesión activa para identificarla fácilmente.
- **Estilos Estándar**: El botón "Actualizar" utiliza el diseño consistente de la aplicación.

### 2. Pantalla de Reportes
- **Botones de Acción**: Se estandarizaron los botones de acción (Ver, Chat, Cerrar) para que utilicen los colores y estilos globales del tema (Amarillo/Negro en modo claro, Oscuro/Dorado en modo oscuro).

### 3. Organización del Menú
- **Reordenamiento Lógico**: El menú lateral se ha reorganizado para agrupar las funciones por áreas:
    1.  **Dashboard/Monitoreo**: Operaciones en tiempo real.
    2.  **Gestión de Flota**: Rutas, Vehículos, Conductores.
    3.  **Operaciones**: Reportes y Soporte.
    4.  **Administración**: Sesiones e Historial.
    5.  **Ajustes**.

### 4. Corrección de Temas (Modo Oscuro/Claro)
- Se han corregido problemas de contraste en filtros y textos para asegurar una legibilidad perfecta en ambos modos.
- Se han eliminado tooltips nativos del navegador molestos en el layout principal.
