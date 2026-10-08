import { IsArray, IsOptional, IsString } from 'class-validator';

export class MobileFolderDto {
  @IsOptional()
  @IsString()
  prefix?: string;

  @IsString()
  name: string;
}

export class DownloadZipDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keys?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  folders?: string[];

  @IsOptional()
  @IsString()
  base_prefix?: string;
}

export class PrepareRawDto {
  @IsString()
  key: string;
}
