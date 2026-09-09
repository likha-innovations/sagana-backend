import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/telemetry',
})
export class TelemetryGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TelemetryGateway.name);

  constructor(private readonly mqttService: MqttService) {}

  afterInit() {
    this.logger.log(
      'Socket.IO Telemetry Gateway initialized on namespace [/telemetry]',
    );
  }

  handleConnection(client: Socket) {
    this.logger.log(
      `Client connected: ${client.id} (Total: ${this.getClientCount()})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected: ${client.id} (Total: ${this.getClientCount()})`,
    );
  }

  private getClientCount(): number {
    return this.server?.sockets?.sockets?.size || 0;
  }

  // Emits real-time telemetry stream received from HiveMQ to all mobile clients
  broadcastTelemetry(data: unknown) {
    if (!this.server) return;
    const payloadStr =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data)
        : String(data);
    this.server.emit('telemetry', data);
    this.logger.log(`📤 [Socket.IO Emitted] Event 'telemetry': ${payloadStr}`);
  }

  // Receives custom command from mobile client and dispatches it directly to HiveMQ topic
  @SubscribeMessage('command')
  async handleCommand(
    @MessageBody() data: unknown,
    @ConnectedSocket() client: Socket,
  ) {
    const payloadStr =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data)
        : String(data);
    this.logger.log(
      `📥 [Socket.IO Received] Event 'command' from client ${client.id}: ${payloadStr}`,
    );
    await this.mqttService.publish('sagana/commands', data as object);
    return {
      status: 'published',
      topic: 'sagana/commands',
      timestamp: new Date().toISOString(),
    };
  }
}
