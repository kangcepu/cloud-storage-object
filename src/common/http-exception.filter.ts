import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const message = this.message(raw, exception, status);
    const mobile = this.isMobilePath(request.path);
    response.status(status).json(mobile ? { success: false, message } : { ok: false, message });
  }

  private message(raw: string | object | null, exception: unknown, status: number): string {
    if (typeof raw === 'string') {
      return raw;
    }
    if (raw && typeof raw === 'object' && 'message' in raw) {
      const value = (raw as { message: string | string[] }).message;
      return Array.isArray(value) ? value.join(', ') : value;
    }
    if (status < 500 && exception instanceof Error) {
      return exception.message;
    }
    return 'Server error.';
  }

  private isMobilePath(path: string): boolean {
    return [
      '/api/login',
      '/api/logout',
      '/api/overview',
      '/api/drive',
      '/api/proxy',
      '/api/raw/prepare',
      '/api/folder',
      '/api/upload',
      '/api/download-zip',
      '/api/public/settings',
    ].includes(path);
  }
}
