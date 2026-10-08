import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateBucketDto {
  @IsString()
  bucket_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class UpdateBucketDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class DeleteBucketDto {
  @IsString()
  confirm: string;

  @IsOptional()
  @IsString()
  _csrf?: string;
}

export class AssignBucketDto {
  @IsInt()
  @Min(1)
  user_id: number;

  @IsObject()
  permissions: {
    view?: boolean;
    upload?: boolean;
    rename?: boolean;
    delete?: boolean;
    download?: boolean;
  };

  @IsOptional()
  @IsString()
  _csrf?: string;
}
