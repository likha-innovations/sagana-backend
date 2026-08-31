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

  /**
   * Socket.IO Ping-Pong handler
   * When mobile/web emits 'ping', replies with 'pong'
   */
  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.logger.log(
      `🏓 [Socket.IO] Received 'ping' from client ${client.id}: ${payload}`,
    );

    const response = {
      status: 'ok',
      source: 'socket.io-server',
      received: data,
      timestamp: new Date().toISOString(),
    };

    client.emit('pong', response);
    return response;
  }

  /**
   * Broadcast MQTT Ping/Pong event to all connected mobile/web frontends
   */
  broadcastMqttPingPong(
    type: 'ping' | 'pong',
    data: { topic: string; message: string; timestamp: string },
  ) {
    if (this.server) {
      this.server.emit(`mqtt:${type}`, data);
      this.logger.log(
        `📢 [Socket.IO Broadcast] Emitted 'mqtt:${type}' to all mobile clients`,
      );
    }
  }
}
