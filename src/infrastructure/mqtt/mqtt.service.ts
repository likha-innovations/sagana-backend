import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';

export type MqttMessageHandler = (topic: string, payload: Buffer) => void;

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private client: mqtt.MqttClient | null = null;
  private readonly logger = new Logger(MqttService.name);
  private readonly messageHandlers: MqttMessageHandler[] = [];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.disconnect();
  }

  private connect() {
    const host = this.configService.get<string>('MQTT_HOST', 'localhost');
    const port = this.configService.get<number>('MQTT_PORT', 8883);
    const protocol = this.configService.get<string>('MQTT_PROTOCOL', 'mqtts');
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');
    const baseClientId = this.configService.get<string>(
      'MQTT_CLIENT_ID',
      'sagana_backend',
    );
    const clientId = `${baseClientId}_${Math.random().toString(16).substring(2, 8)}`;

    const brokerUrl = `${protocol}://${host}:${port}`;
    this.logger.log(
      `Connecting to MQTT broker at ${brokerUrl} (client: ${clientId})...`,
    );

    this.client = mqtt.connect(brokerUrl, {
      clientId,
      username,
      password,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
      rejectUnauthorized: protocol === 'mqtts' || protocol === 'wss',
    });

    this.client.on('connect', () => {
      this.logger.log('Connected successfully to MQTT Broker');
      this.subscribeDefaultTopics();
    });

    this.client.on('error', (err) => {
      this.logger.error(`MQTT connection error: ${err.message}`, err.stack);
    });

    this.client.on('reconnect', () => {
      this.logger.warn('Reconnecting to MQTT broker...');
    });

    this.client.on('close', () => {
      this.logger.warn('MQTT connection closed.');
    });

    this.client.on('message', (topic, payload) => {
      // Direct ping-pong test listener
      if (topic === 'sagana/ping') {
        const messageStr = payload.toString();
        this.logger.log(
          `Test MQTT message received on 'sagana/ping': ${messageStr}`,
        );
        void this.publish('sagana/pong', {
          status: 'ok',
          received: messageStr,
          timestamp: new Date().toISOString(),
        });
      }

      for (const handler of this.messageHandlers) {
        try {
          handler(topic, payload);
        } catch (error) {
          this.logger.error(
            `Error in message handler for topic ${topic}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    });
  }

  private subscribeDefaultTopics() {
    const topics = [
      'sagana/ping',
      'sagana/devices/+/telemetry',
      'sagana/devices/+/status',
    ];

    for (const topic of topics) {
      this.subscribe(topic);
    }
  }

  subscribe(topic: string, qos: mqtt.IClientSubscribeOptions['qos'] = 1) {
    if (!this.client) {
      this.logger.warn(
        `Cannot subscribe to ${topic}: MQTT client not initialized`,
      );
      return;
    }

    this.client.subscribe(topic, { qos }, (err) => {
      if (err) {
        this.logger.error(
          `Failed to subscribe to topic ${topic}: ${err.message}`,
        );
      } else {
        this.logger.log(`Subscribed to topic: ${topic}`);
      }
    });
  }

  publish(
    topic: string,
    message: string | object,
    qos: mqtt.IClientPublishOptions['qos'] = 1,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.client.connected) {
        const error = new Error('MQTT client is not connected');
        this.logger.error(error.message);
        return reject(error);
      }

      const payload =
        typeof message === 'object' ? JSON.stringify(message) : message;

      this.client.publish(topic, payload, { qos }, (err) => {
        if (err) {
          this.logger.error(`Failed to publish to ${topic}: ${err.message}`);
          return reject(err);
        }
        resolve();
      });
    });
  }

  onMessage(handler: MqttMessageHandler) {
    this.messageHandlers.push(handler);
  }

  disconnect() {
    if (this.client) {
      this.client.end(true, () => {
        this.logger.log('Disconnected from MQTT Broker');
      });
      this.client = null;
    }
  }

  getClient(): mqtt.MqttClient | null {
    return this.client;
  }
}
