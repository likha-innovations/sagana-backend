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
import { verifyToken } from '@clerk/backend';
import { MqttService } from '../../infrastructure/mqtt/mqtt.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

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

  constructor(
    private readonly mqttService: MqttService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log(
      'Socket.IO Telemetry Gateway initialized on namespace [/telemetry]',
    );
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization as string) ||
        '';
      const token = authHeader.replace(/^Bearer\s+/i, '');

      if (!token) {
        this.logger.warn(
          `Rejecting unauthenticated socket connection: ${client.id}`,
        );
        client.disconnect(true);
        return;
      }

      // Allow dev tokens in development mode with explicit opt-in flag for easy socket testing
      const isDevAuthAllowed =
        process.env.NODE_ENV === 'development' &&
        process.env.ENABLE_DEV_AUTH_BYPASS === 'true';

      if (isDevAuthAllowed && token.startsWith('dev_')) {
        const devIdentifier = token.replace(/^dev_/, '');
        let devUser = await this.prisma.user.findFirst({
          where:
            devIdentifier === 'operator' || devIdentifier === 'admin'
              ? { role: devIdentifier }
              : { OR: [{ id: devIdentifier }, { email: devIdentifier }] },
          select: { id: true, barangayId: true },
        });
        if (!devUser) {
          devUser = await this.prisma.user.findFirst({
            select: { id: true, barangayId: true },
          });
        }
        if (devUser?.barangayId) {
          const room = `barangay:${devUser.barangayId}`;
          await client.join(room);
          client.data.userId = devUser.id;
          client.data.barangayId = devUser.barangayId;
          this.logger.log(
            `Client connected with dev token: ${client.id} (User: ${devUser.id}, Room: ${room}, Total: ${this.getClientCount()})`,
          );
          return;
        }
      }

      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user?.barangayId) {
        this.logger.warn(
          `Socket ${client.id} authenticated for user ${payload.sub} but has no barangay assigned. Disconnecting.`,
        );
        client.disconnect(true);
        return;
      }

      // Join the isolated barangay room
      const room = `barangay:${user.barangayId}`;
      await client.join(room);
      client.data.userId = user.id;
      client.data.barangayId = user.barangayId;

      this.logger.log(
        `Client connected: ${client.id} (User: ${user.id}, Room: ${room}, Total: ${this.getClientCount()})`,
      );
    } catch (err) {
      this.logger.warn(
        `Socket authentication failed for client ${client.id}: ${err instanceof Error ? err.message : err}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `Client disconnected: ${client.id} (Total: ${this.getClientCount()})`,
    );
  }

  private getClientCount(): number {
    return this.server?.sockets?.sockets?.size || 0;
  }

  // Helper to emit to a specific barangay room or fallback to broadcast if barangayId is missing
  private emitToBarangay(
    barangayId: string | undefined,
    event: string,
    data: unknown,
  ) {
    if (!this.server) return;
    if (barangayId) {
      this.server.to(`barangay:${barangayId}`).emit(event, data);
    } else {
      this.server.emit(event, data);
    }
  }

  // Emits device online/offline status changes to barangay room
  broadcastStatus(data: {
    machineId: string;
    macAddress: string;
    status: string;
    barangayId?: string;
  }) {
    if (!this.server) return;
    this.emitToBarangay(data.barangayId, 'status', data);
    this.logger.log(
      `📤 [Socket.IO Emitted] Event 'status' to room [${data.barangayId ? `barangay:${data.barangayId}` : 'all'}]: ` +
        JSON.stringify(data),
    );
  }

  // Emits newly registered machine to all mobile clients in the same barangay
  broadcastMachineAdded(data: {
    machineId: string;
    name: string;
    macAddress: string;
    barangayId: string;
    wifiSsid: string | null;
    status: string;
    createdAt: string;
  }) {
    if (!this.server) return;
    this.emitToBarangay(data.barangayId, 'machine_added', data);
    this.logger.log(
      `📤 [Socket.IO Emitted] Event 'machine_added' to room [barangay:${data.barangayId}]: ` +
        JSON.stringify(data),
    );
  }

  // Emits machine metadata updates to all mobile clients in the same barangay
  broadcastMachineUpdated(data: {
    machineId: string;
    name?: string;
    barangayId?: string;
  }) {
    if (!this.server) return;
    this.emitToBarangay(data.barangayId, 'machine_updated', data);
    this.logger.log(
      `📤 [Socket.IO Emitted] Event 'machine_updated' to room [${data.barangayId ? `barangay:${data.barangayId}` : 'all'}]: ` +
        JSON.stringify(data),
    );
  }

  // Emits machine removal to all mobile clients in the same barangay
  broadcastMachineRemoved(data: { machineId: string; barangayId?: string }) {
    if (!this.server) return;
    this.emitToBarangay(data.barangayId, 'machine_removed', data);
    this.logger.log(
      `📤 [Socket.IO Emitted] Event 'machine_removed' to room [${data.barangayId ? `barangay:${data.barangayId}` : 'all'}]: ` +
        JSON.stringify(data),
    );
  }

  // Emits real-time telemetry stream received from EMQX to target barangay room
  broadcastTelemetry(data: unknown) {
    if (!this.server) return;
    const barangayId =
      typeof data === 'object' && data !== null && 'barangayId' in data
        ? (data as { barangayId?: string }).barangayId
        : undefined;

    this.emitToBarangay(barangayId, 'telemetry', data);

    const payloadStr =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data)
        : String(data);
    this.logger.log(
      `📤 [Socket.IO Emitted] Event 'telemetry' to room [${barangayId ? `barangay:${barangayId}` : 'all'}]: ${payloadStr}`,
    );
  }

  // Emits discrete automation log event (blower, sprinkler, e-stop) to target barangay room
  broadcastAutomationLog(data: unknown) {
    if (!this.server) return;
    const barangayId =
      typeof data === 'object' && data !== null && 'barangayId' in data
        ? (data as { barangayId?: string }).barangayId
        : undefined;

    this.emitToBarangay(barangayId, 'automation_log', data);

    const payloadStr =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data)
        : String(data);
    this.logger.log(
      `📤 [Socket.IO Emitted] Event 'automation_log' to room [${barangayId ? `barangay:${barangayId}` : 'all'}]: ${payloadStr}`,
    );
  }

  // Emits in-app alert notification to target barangay room
  broadcastNotification(barangayId: string, data: unknown) {
    if (!this.server) return;
    this.emitToBarangay(barangayId, 'notification', data);
    const payloadStr =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data)
        : String(data);
    this.logger.log(
      `📤 [Socket.IO Emitted] Event 'notification' to room [${barangayId ? `barangay:${barangayId}` : 'all'}]: ${payloadStr}`,
    );
  }

  // Handles explicit room join from mobile client for barangay isolation
  @SubscribeMessage('join_barangay')
  async handleJoinBarangay(
    @MessageBody() data: { barangayId?: string } | string,
    @ConnectedSocket() client: Socket,
  ) {
    const requestedBarangayId =
      typeof data === 'string' ? data : data?.barangayId;
    const targetBarangayId =
      (client.data?.barangayId as string | undefined) || requestedBarangayId;

    if (targetBarangayId) {
      await client.join(`barangay:${targetBarangayId}`);
      this.logger.log(
        `Client ${client.id} joined room: barangay:${targetBarangayId}`,
      );
      return { status: 'joined', room: `barangay:${targetBarangayId}` };
    }
    return { status: 'ignored' };
  }

  // Receives custom command from mobile client and dispatches it to the target device's MQTT topic
  @SubscribeMessage('command')
  async handleCommand(
    @MessageBody() data: { macAddress: string; [key: string]: unknown },
    @ConnectedSocket() client: Socket,
  ) {
    const payloadStr =
      typeof data === 'object' && data !== null
        ? JSON.stringify(data)
        : String(data);
    this.logger.log(
      `📥 [Socket.IO Received] Event 'command' from client ${client.id}: ${payloadStr}`,
    );
    const topic = `sagana/devices/${data.macAddress}/commands`;
    await this.mqttService.publish(topic, data);
    return {
      status: 'published',
      topic,
      timestamp: new Date().toISOString(),
    };
  }
}
