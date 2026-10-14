import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();
      const rawMsg =
        typeof exResponse === 'string'
          ? exResponse
          : (exResponse as { message?: unknown }).message || exception.message;

      if (Array.isArray(rawMsg)) {
        message = rawMsg
          .map((m) =>
            typeof m === 'object' && m !== null
              ? (m as { message?: string }).message || JSON.stringify(m)
              : typeof m === 'string'
                ? m
                : JSON.stringify(m),
          )
          .join(', ');
      } else if (typeof rawMsg === 'object' && rawMsg !== null) {
        message =
          (rawMsg as { message?: string }).message || JSON.stringify(rawMsg);
      } else if (typeof rawMsg === 'string') {
        message = rawMsg;
      } else {
        message = JSON.stringify(rawMsg) ?? exception.message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(
        `Prisma query error [${exception.code}]: ${exception.message}`,
      );
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'A record with this value already exists';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `Database request error (${exception.code})`;
      }
    } else {
      const err = exception as Error;
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      this.logger.error(err.message, err.stack);
    }

    // Clean log: method, path, status, message. No stack trace.
    this.logger.error(
      `[${request.method} ${request.url}] ${status} - ${message}`,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
