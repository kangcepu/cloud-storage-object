import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { CsrfGuard, SessionAuthGuard, SuperadminGuard } from '../auth/auth.guard';
import { AuthUser } from '../types';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('api/users')
@UseGuards(SessionAuthGuard, SuperadminGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ): Promise<{ ok: true; data: AuthUser[] }> {
    return { ok: true, data: await this.users.list({ q, role, status }) };
  }

  @Post()
  @UseGuards(CsrfGuard)
  async create(
    @Body() body: CreateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<{ ok: true; id: number }> {
    return { ok: true, id: await this.users.create(body, actor) };
  }

  @Get(':id')
  async find(@Param('id', ParseIntPipe) id: number): Promise<{ ok: true; data: AuthUser }> {
    return { ok: true, data: await this.users.find(id) };
  }

  @Put(':id')
  @UseGuards(CsrfGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<{ ok: true }> {
    await this.users.update(id, body, actor);
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(CsrfGuard)
  async remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: AuthUser): Promise<{ ok: true }> {
    await this.users.remove(id, actor);
    return { ok: true };
  }

  @Post(':id/reset-password')
  @UseGuards(CsrfGuard)
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResetPasswordDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<{ ok: true }> {
    await this.users.resetPassword(id, body, actor);
    return { ok: true };
  }
}
