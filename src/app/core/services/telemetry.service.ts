import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TelemetryData {
  vehiculoId: string | number;
  lat: number;
  lng: number;
  velocidad?: number;
  bateria?: number;
  timestamp?: string;
  estado?: string;
}

/**
 * TelemetryService – conecta con EMQX vía WebSocket usando el protocolo MQTT nativo.
 *
 * EMQX expone el puerto 1884 para WebSocket MQTT (subprotocolo 'mqtt').
 * El WebSocket crudo NO basta; hay que enviar el frame MQTT CONNECT manualmente
 * o usar la librería mqtt.js. Aquí se implementa el handshake mínimo con
 * WebSocket nativo para no agregar dependencias externas, aprovechando el
 * soporte de subprotocolo 'mqtt' que EMQX acepta automáticamente.
 *
 * NOTA: Para GPS en tiempo real (Fase 3) se completará la suscripción a tópicos.
 * Por ahora el servicio establece la conexión y expone el estado isConnected$.
 */
@Injectable({
  providedIn: 'root'
})
export class TelemetryService implements OnDestroy {
  private readonly MQTT_WS_URL = environment.mqttUrl;

  // Credenciales del usuario MQTT "web-admin" creado por emqx-init
  private readonly MQTT_CLIENT_ID = `web-admin-${Math.random().toString(16).slice(2, 8)}`;
  private readonly MQTT_USERNAME  = 'web-admin';
  private readonly MQTT_PASSWORD  = 'webadmin123';
  private readonly MQTT_TOPIC     = 'vehiculos/+/telemetria/+';
  private readonly KEEP_ALIVE     = 60; // segundos

  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private isDestroyed = false;

  private isConnectedSubject = new BehaviorSubject<boolean>(false);
  public isConnected$ = this.isConnectedSubject.asObservable();

  private telemetryDataSubject = new BehaviorSubject<TelemetryData | null>(null);
  public telemetry$ = this.telemetryDataSubject.asObservable();

  private lastPositions = new Map<string | number, TelemetryData>();
  private positionsSubject = new BehaviorSubject<Map<string | number, TelemetryData>>(new Map());
  public positions$ = this.positionsSubject.asObservable();

  constructor() {
    this.connect();
  }

  // ─────────────────────────────────────────────────────────────
  // Conexión y reconexión
  // ─────────────────────────────────────────────────────────────

  connect() {
    if (this.isDestroyed) return;
    try {
      // 'mqtt' como subprotocolo WebSocket es requerido por EMQX
      this.socket = new WebSocket(this.MQTT_WS_URL, ['mqtt']);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        this.sendMqttConnect();
      };

      this.socket.onmessage = (event: MessageEvent) => {
        this.handleMqttFrame(event.data as ArrayBuffer);
      };

      this.socket.onerror = () => {
        this.isConnectedSubject.next(false);
      };

      this.socket.onclose = () => {
        this.isConnectedSubject.next(false);
        console.log('[TelemetryService] WebSocket MQTT cerrado. Reconectando en 10s...');
        this.scheduleReconnect(10000);
      };
    } catch (e) {
      console.warn('[TelemetryService] No se pudo establecer conexión WebSocket:', e);
      this.isConnectedSubject.next(false);
      this.scheduleReconnect(10000);
    }
  }

  private scheduleReconnect(delayMs: number) {
    if (this.isDestroyed) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delayMs);
  }

  // ─────────────────────────────────────────────────────────────
  // Construcción manual de frames MQTT v3.1.1
  // ─────────────────────────────────────────────────────────────

  /**
   * Envía el frame MQTT CONNECT al broker.
   * Esto es necesario porque EMQX requiere el handshake MQTT completo
   * aunque la capa de transporte sea WebSocket.
   */
  private sendMqttConnect() {
    const clientIdBytes  = this.encodeUtf8(this.MQTT_CLIENT_ID);
    const usernameBytes  = this.encodeUtf8(this.MQTT_USERNAME);
    const passwordBytes  = this.encodeUtf8(this.MQTT_PASSWORD);
    const protocolBytes  = this.encodeUtf8('MQTT');

    // Flags: cleansession=1, username=1, password=1
    const connectFlags = 0b11000010;

    // Variable header (10 bytes para MQTT 3.1.1)
    const variableHeader = [
      0x00, protocolBytes.length, ...protocolBytes, // Protocol Name length + "MQTT"
      0x04,           // Protocol Level (4 = v3.1.1)
      connectFlags,   // Connect Flags
      0x00, this.KEEP_ALIVE // Keep Alive (2 bytes MSB/LSB)
    ];

    // Payload: clientId + username + password (cada uno precedido por su longitud en 2 bytes)
    const payload = [
      ...this.mqttString(clientIdBytes),
      ...this.mqttString(usernameBytes),
      ...this.mqttString(passwordBytes)
    ];

    const remainingLength = variableHeader.length + payload.length;
    const frame = new Uint8Array([
      0x10, // CONNECT packet type (1 << 4)
      ...this.encodeRemainingLength(remainingLength),
      ...variableHeader,
      ...payload
    ]);

    this.socket?.send(frame.buffer);
  }

  /**
   * Envía el frame MQTT SUBSCRIBE para el tópico de telemetría.
   * QoS 0 (at most once) es suficiente para coordenadas GPS en tiempo real.
   */
  private sendMqttSubscribe() {
    const topicBytes = this.encodeUtf8(this.MQTT_TOPIC);
    const packetId   = [0x00, 0x01]; // Packet Identifier

    const payload = [
      ...packetId,
      ...this.mqttString(topicBytes),
      0x00 // QoS 0
    ];

    const frame = new Uint8Array([
      0x82, // SUBSCRIBE packet type (8 << 4 | 0x02)
      ...this.encodeRemainingLength(payload.length),
      ...payload
    ]);

    this.socket?.send(frame.buffer);
    console.log(`[TelemetryService] Suscrito al tópico: ${this.MQTT_TOPIC}`);
  }

  // ─────────────────────────────────────────────────────────────
  // Procesamiento de frames entrantes
  // ─────────────────────────────────────────────────────────────

  private handleMqttFrame(buffer: ArrayBuffer) {
    const data = new Uint8Array(buffer);
    if (data.length < 2) return;

    const packetType = (data[0] >> 4) & 0x0F;

    switch (packetType) {
      case 2: // CONNACK
        this.handleConnack(data);
        break;
      case 3: // PUBLISH
        this.handlePublish(data);
        break;
      case 9: // SUBACK
        console.log('[TelemetryService] SUBACK recibido — suscripción confirmada');
        break;
      case 13: // PINGRESP
        break;
    }
  }

  private handleConnack(data: Uint8Array) {
    const returnCode = data[3]; // 0 = Connection Accepted
    if (returnCode === 0) {
      console.log('[TelemetryService] Conectado exitosamente a EMQX MQTT');
      this.isConnectedSubject.next(true);
      // Una vez conectado, suscribirse al tópico de telemetría
      this.sendMqttSubscribe();
    } else {
      const errors: Record<number, string> = {
        1: 'Versión de protocolo inaceptable',
        2: 'Identificador rechazado',
        3: 'Servidor no disponible',
        4: 'Usuario o contraseña incorrectos',
        5: 'No autorizado'
      };
      console.error(`[TelemetryService] CONNACK error (${returnCode}): ${errors[returnCode] || 'Error desconocido'}`);
      this.isConnectedSubject.next(false);
    }
  }

  private handlePublish(data: Uint8Array) {
    try {
      let offset = 1;
      // Decodificar Remaining Length
      let multiplier = 1, remainingLength = 0, byte;
      do {
        byte = data[offset++];
        remainingLength += (byte & 0x7F) * multiplier;
        multiplier *= 128;
      } while (byte & 0x80);

      // Topic Length
      const topicLen = (data[offset] << 8) | data[offset + 1];
      offset += 2;
      const topic = new TextDecoder().decode(data.slice(offset, offset + topicLen));
      offset += topicLen;

      // QoS flags
      const qos = (data[0] & 0x06) >> 1;
      if (qos > 0) offset += 2; // Packet ID

      // Payload = JSON de telemetría
      const payloadBytes = data.slice(offset);
      const json = new TextDecoder().decode(payloadBytes);
      const raw = JSON.parse(json);
      const vehiculoId = this.normalizeVehicleIdentifier(raw, topic);
      const lat = Number(raw.lat ?? raw.latitude ?? raw.latitud ?? 0);
      const lng = Number(raw.lng ?? raw.longitude ?? raw.lon ?? raw.longitud ?? 0);

      if (vehiculoId == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const telemetry: TelemetryData = {
        vehiculoId,
        lat,
        lng,
        velocidad: raw.velocidad ?? raw.speed,
        bateria: raw.bateria ?? raw.batteryLevel,
        timestamp: raw.timestamp,
        estado: raw.estado ?? raw.status
      };
      this.telemetryDataSubject.next(telemetry);
      if (lat !== 0 && lng !== 0) {
        this.lastPositions.set(vehiculoId, telemetry);
        this.positionsSubject.next(new Map(this.lastPositions));
      }
    } catch {
      // Ignorar frames malformados
    }
  }

  private normalizeVehicleIdentifier(raw: any, topic?: string): string | number | null {
    const topicParts = topic ? topic.split('/').filter(Boolean) : [];
    const topicVehicleId = topicParts.length >= 3 ? topicParts[1] : null;
    const candidates = [
      raw?.vehiculoId,
      raw?.vehicleId,
      raw?.imeiDispositivoGps,
      raw?.imei_dispositivo_gps,
      raw?.deviceId,
      raw?.gpsDeviceId,
      topicVehicleId
    ];

    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined || candidate === '') {
        continue;
      }

      const value = String(candidate).trim();
      if (!value) {
        continue;
      }

      const asNumber = Number(value);
      if (/^\d+$/.test(value) && Number.isFinite(asNumber)) {
        return asNumber;
      }

      return value;
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Utilidades de codificación MQTT
  // ─────────────────────────────────────────────────────────────

  private encodeUtf8(str: string): number[] {
    return Array.from(new TextEncoder().encode(str));
  }

  private mqttString(bytes: number[]): number[] {
    return [(bytes.length >> 8) & 0xFF, bytes.length & 0xFF, ...bytes];
  }

  private encodeRemainingLength(length: number): number[] {
    const result: number[] = [];
    do {
      let byte = length % 128;
      length = Math.floor(length / 128);
      if (length > 0) byte |= 0x80;
      result.push(byte);
    } while (length > 0);
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Ciclo de vida
  // ─────────────────────────────────────────────────────────────

  disconnect() {
    this.isDestroyed = true;
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnectedSubject.next(false);
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
