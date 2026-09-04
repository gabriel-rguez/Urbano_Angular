export const environment = {
  production: false,
  // Traefik expone el API Gateway en el puerto 80 del host.
  // El puerto 8080 es el dashboard de Traefik (NO el gateway).
  gatewayUrl: 'http://localhost',
  apiUrl: 'http://localhost/admin',
  authUrl: 'http://localhost/auth',
  telemetriaUrl: 'http://localhost/telemetria',
  // EMQX expone WebSockets MQTT en el puerto 1884
  mqttUrl: 'ws://localhost:1884/mqtt'
};

