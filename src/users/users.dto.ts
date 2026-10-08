import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(['superadmin', 'user'])
  role: 'superadmin' | 'user';

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['superadmin', 'user'])
  role?: 'superadmin' | 'user';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}
