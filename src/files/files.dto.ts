import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateFolderDto {
  @IsOptional()
  @IsString()
  parent?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class ObjectTransferDto {
  @IsString()
  from: string;

  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class DeleteObjectDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class ProxyQueryDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsIn(['inline', 'attachment'])
  disposition?: 'inline' | 'attachment';
}
