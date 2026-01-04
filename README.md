# 🚖 Urbano - Gestión Ecomovil

> Plataforma integral para la gestión y monitoreo de transporte urbano ecológico.

![Angular](https://img.shields.io/badge/Angular-18.2-dd0031?style=flat&logo=angular)
![Leaflet](https://img.shields.io/badge/Leaflet-Mapas-199900?style=flat&logo=leaflet)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**Urbano** es una aplicación web moderna desarrollada con **Angular 18** diseñada para administrar flotas de vehículos eléctricos (Ecotaxis), monitorear rutas en tiempo real y gestionar incidencias. El sistema ofrece una experiencia de usuario premium con soporte nativo para temas claro y oscuro.

---

## ✨ Características Principales

### 🗺️ Monitoreo en Tiempo Real
- **Mapa Interactivo**: Visualización de vehículos y rutas utilizando **Leaflet.js**.
- **Seguimiento en Vivo**: Actualización en tiempo real de la posición y estado de los vehículos.
- **Gestión de Rutas**: Herramientas avanzadas para trazar, editar y gestionar paradas de rutas urbanas.

### 🚗 Gestión de Flota
- **Inventario de Vehículos**: CRUD completo de unidades, control de mantenimiento y estados.
- **Directorio de Conductores**: Gestión de perfiles, licencias y asignación de vehículos.

### 🛡️ Seguridad y Auditoría
- **Roles de Usuario**: Acceso diferenciado para Administradores y Conductores.
- **Historial de Auditoría**: Registro inmutable de todas las acciones críticas (Crear, Editar, Eliminar) realizado por los administradores.
- **Gestión de Sesiones**: Monitoreo de usuarios conectados y control de acceso.

### 🎨 Experiencia de Usuario (UI/UX)
- **Tema Dinámico**: Transición fluida entre **Modo Claro** y **Modo Oscuro**.
- **Diseño Responsivo**: Interfaz adaptable a diferentes dispositivos.
- **Estilo Premium**: Componentes visuales modernos, animaciones suaves y paleta de colores cuidada.

### 🔧 Operaciones
- **Sistema de Reportes**: Gestión de incidencias reportadas por conductores.
- **Chat de Soporte**: Canal de comunicación para resolución de problemas.

---

## 🚀 Instalación y Uso

Este proyecto requiere **Node.js** y **Angular CLI**.

1.  **Clonar el repositorio**
    ```bash
    git clone https://github.com/tu-usuario/gestion-ecomovil.git
    cd gestion_ecomovil
    ```

2.  **Instalar dependencias**
    ```bash
    npm install
    ```

3.  **Ejecutar servidor de desarrollo**
    ```bash
    ng serve
    ```
    Navega a `http://localhost:4200/`. La aplicación se recargará automáticamente si cambias algún archivo fuente.

## 🔐 Credenciales de Demo

Para probar todas las funcionalidades administrativas, utiliza las siguientes credenciales por defecto:

*   **Usuario**: `admin`
*   **Contraseña**: `123456`

## 📚 Documentación Técnica

Para una comprensión profunda de la arquitectura, servicios y módulos del sistema, consulta nuestra documentación interna:

*   [📄 Documentación General del Proyecto](./docs/DOCUMENTACION_GENERAL.md): Arquitectura, Servicios Core y Módulos.
*   [📝 Historial de Cambios](./docs/HISTORIAL_CAMBIOS.md): Registro detallado de implementaciones recientes.

## 🛠️ Tecnologías

*   **Frontend**: Angular 18 (Standalone Components)
*   **Mapas**: Leaflet
*   **Estilos**: CSS3 (Variables CSS, Flexbox, Grid)
*   **Iconos**: FontAwesome 6

---

Desarrollado como proyecto académico para la asignatura de Web.
