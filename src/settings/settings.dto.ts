import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAppSettingsDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  login_title?: string;

  @IsOptional()
  @IsString()
  footer_text?: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class UpdateMinioSettingsDto {
  @IsString()
  endpoint: string;

  @IsOptional()
  @IsString()
  public_endpoint?: string;

  @IsString()
  access_key: string;

  @IsOptional()
  @IsString()
  secret_key?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsBoolean()
  use_ssl?: boolean;

  @IsOptional()
  @IsBoolean()
  path_style_endpoint?: boolean;

  @IsOptional()
  @IsIn(['proxy', 'direct'])
  delivery_mode?: 'proxy' | 'direct';

  @IsOptional()
  @IsString()
  default_bucket?: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}
