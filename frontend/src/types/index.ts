export type UserRole = 'superadmin' | 'user'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  is_active: number | boolean
  must_change_password: number | boolean
  avatar_path: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface BucketPermission {
  view: boolean
  upload: boolean
  rename: boolean
  delete: boolean
  download: boolean
}

export interface Bucket {
  id: number
  bucket_name: string
  display_name: string | null
  description: string | null
  assigned_users?: number
  assigned_user_names?: string | null
  total_files?: number
  total_size?: number
  last_modified?: string | null
  created_at: string
  updated_at: string
}

export interface StorageFolder {
  prefix: string
}

export interface StorageFile {
  key: string
  size: number
  last_modified: string | null
}

export interface DashboardData {
  bucket_count: number
  total_files: number
  total_size: number
  user_count: number | null
  recent_uploads: Array<{
    bucket_name: string
    object_key: string
    size: number
    created_at: string | null
    uploaded_by_name: string | null
  }>
  storage_per_bucket: Array<{
    bucket_name: string
    display_name: string | null
    total_files: number
    total_size: number
  }>
  type_counts: Record<string, number>
  type_sizes: Record<string, number>
  minio_error: string | null
}

export interface ApiErrorBody {
  message?: string | string[]
  error?: string
}
