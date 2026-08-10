import {
  Controller,
  Post,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoggerService } from '../../core/logger/logger.service';
import { Public } from '../../core/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Webhooks')
@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {}

  @Post('clerk')
  @ApiOperation({ summary: 'Handle Clerk Webhook Events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleClerkWebhook(
    @Req() req: Request,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException('Missing svix headers');
    }

    const payload = (req as any).rawBody?.toString('utf8');
    if (!payload) {
      throw new BadRequestException(
        'Missing raw request body required for Svix verification',
      );
    }

    const headers = {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    };

    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      this.logger.error(
        'Webhook secret not configured in environment variables',
        undefined,
        WebhooksController.name,
      );
      throw new BadRequestException('Webhook secret not configured');
    }

    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(payload, headers);
    } catch (err: any) {
      this.logger.error(
        'Webhook signature verification failed',
        err.stack,
        WebhooksController.name,
      );
      throw new BadRequestException('Invalid signature');
    }

    const { id } = evt.data;
    const eventType = evt.type;

    this.logger.log(
      `Webhook received: ${eventType} for user ${id}`,
      WebhooksController.name,
    );

    if (eventType === 'user.created' || eventType === 'user.updated') {
      const email = evt.data.email_addresses?.[0]?.email_address || '';
      const fullName =
        `${evt.data.first_name || ''} ${evt.data.last_name || ''}`.trim();
      const contactNumber = evt.data.phone_numbers?.[0]?.phone_number || null;

      await this.prisma.user.upsert({
        where: { id },
        update: { fullName, email, contactNumber },
        create: { id, fullName, email, contactNumber, location: null },
      });
      this.logger.log(
        `User ${id} successfully synced to Neon database`,
        WebhooksController.name,
      );
    } else if (eventType === 'user.deleted') {
      await this.prisma.user.delete({ where: { id } }).catch(() => {});
      this.logger.log(
        `User ${id} successfully deleted from Neon database`,
        WebhooksController.name,
      );
    }

    return { success: true };
  }
}
