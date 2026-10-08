import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { lookup } from 'mime-types';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get('branding/:name')
  branding(@Param('name') name: string, @Res() response: Response): void {
    const path = this.media.resolve('branding', name);
    response.setHeader('Content-Type', String(lookup(path) || 'application/octet-stream'));
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.sendFile(path);
  }

  @Get('avatar/:name')
  avatar(@Param('name') name: string, @Res() response: Response): void {
    const path = this.media.resolve('avatars', name);
    response.setHeader('Content-Type', String(lookup(path) || 'application/octet-stream'));
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    response.sendFile(path);
  }
}
