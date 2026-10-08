export type UserRole = 'superadmin' | 'user';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  is_active: number;
  must_change_password: number;
  avatar_path: string | null;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BucketPermission {
  view: boolean;
  upload: boolean;
  rename: boolean;
  delete: boolean;
  download: boolean;
}

export interface BucketRecord {
  id: number;
  bucket_name: string;
  display_name: string | null;
  description: string | null;
  created_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface StorageObject {
  key: string;
  size: number;
  lastModified: Date | null;
}

export interface RequestWithUser extends Express.Request {
  user: AuthUser;
}
