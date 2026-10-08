import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { randomBytes } from 'node:crypto';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './auth.dto';
import { CsrfGuard, SessionAuthGuard } from './auth.guard';
import { AuthUser } from '../types';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('csrf')
  csrf(@Req() request: Request): { ok: true; csrf: string } {
    request.session.csrfToken ??= randomBytes(32).toString('hex');
    return { ok: true, csrf: request.session.csrfToken };
  }

  @Post('login')
  @UseGuards(CsrfGuard)
  async login(@Body() body: LoginDto, @Req() request: Request): Promise<{ ok: true; user: AuthUser }> {
    return { ok: true, user: await this.auth.login(body.email, body.password, request) };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  async logout(@Req() request: Request): Promise<{ ok: true }> {
    await this.auth.logout(request);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: AuthUser): { ok: true; user: AuthUser } {
    return { ok: true, user };
  }

  @Post('change-password')
  @UseGuards(SessionAuthGuard, CsrfGuard)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    await this.auth.changePassword(user, body.current_password, body.new_password, request);
    return { ok: true };
  }
}
