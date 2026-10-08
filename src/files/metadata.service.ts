import { Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { DatabaseService } from '../common/database.service';

export interface MetadataInput {
  bucket_id: number;
  object_key: string;
  original_name: string | null;
  mime_type: string | null;
  size: number;
  extension: string | null;
  uploaded_by: number | null;
  last_modified: string | null;
}

interface MetadataRow extends RowDataPacket, MetadataInput {}

@Injectable()
export class MetadataService {
  constructor(private readonly database: DatabaseService) {}

  async upsert(input: MetadataInput): Promise<void> {
    const now = this.database.now();
    const update = await this.database.execute(
      'UPDATE files_metadata SET original_name=?,mime_type=?,size=?,extension=?,uploaded_by=?,last_modified=?,updated_at=? WHERE bucket_id=? AND object_key=?',
      [
        input.original_name,
        input.mime_type,
        input.size,
        input.extension,
        input.uploaded_by,
        input.last_modified,
        now,
        input.bucket_id,
        input.object_key,
      ],
    );
    if (update.affectedRows === 0) {
      await this.database.execute(
        'INSERT INTO files_metadata (bucket_id,object_key,original_name,mime_type,size,extension,uploaded_by,last_modified,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [
          input.bucket_id,
          input.object_key,
          input.original_name,
          input.mime_type,
          input.size,
          input.extension,
          input.uploaded_by,
          input.last_modified,
          now,
          now,
        ],
      );
    }
  }

  async rename(bucketId: number, source: string, destination: string): Promise<void> {
    await this.database.execute(
      'UPDATE files_metadata SET object_key=?,updated_at=? WHERE bucket_id=? AND object_key=?',
      [destination, this.database.now(), bucketId, source],
    );
  }

  async copy(bucketId: number, source: string, destination: string, userId: number): Promise<void> {
    const row = await this.database.one<MetadataRow>(
      'SELECT bucket_id,object_key,original_name,mime_type,size,extension,uploaded_by,last_modified FROM files_metadata WHERE bucket_id=? AND object_key=? ORDER BY id DESC LIMIT 1',
      [bucketId, source],
    );
    if (row) {
      await this.upsert({
        ...row,
        object_key: destination,
        uploaded_by: userId,
        last_modified: this.database.now(),
      });
    }
  }

  async movePrefix(bucketId: number, sourcePrefix: string, destinationPrefix: string): Promise<void> {
    const rows = await this.database.query<MetadataRow>(
      'SELECT bucket_id,object_key,original_name,mime_type,size,extension,uploaded_by,last_modified FROM files_metadata WHERE bucket_id=? AND object_key LIKE ? ESCAPE "\\\\"',
      [bucketId, `${this.escapeLike(sourcePrefix)}%`],
    );
    for (const row of rows) {
      await this.rename(
        bucketId,
        row.object_key,
        `${destinationPrefix}${row.object_key.slice(sourcePrefix.length)}`,
      );
    }
  }

  async copyPrefix(
    bucketId: number,
    sourcePrefix: string,
    destinationPrefix: string,
    userId: number,
  ): Promise<void> {
    const rows = await this.database.query<MetadataRow>(
      'SELECT bucket_id,object_key,original_name,mime_type,size,extension,uploaded_by,last_modified FROM files_metadata WHERE bucket_id=? AND object_key LIKE ? ESCAPE "\\\\"',
      [bucketId, `${this.escapeLike(sourcePrefix)}%`],
    );
    for (const row of rows) {
      await this.upsert({
        ...row,
        object_key: `${destinationPrefix}${row.object_key.slice(sourcePrefix.length)}`,
        uploaded_by: userId,
        last_modified: this.database.now(),
      });
    }
  }

  async delete(bucketId: number, key: string, prefix: boolean): Promise<void> {
    if (prefix) {
      await this.database.execute(
        'DELETE FROM files_metadata WHERE bucket_id=? AND object_key LIKE ? ESCAPE "\\\\"',
        [bucketId, `${this.escapeLike(key)}%`],
      );
      return;
    }
    await this.database.execute('DELETE FROM files_metadata WHERE bucket_id=? AND object_key=?', [
      bucketId,
      key,
    ]);
  }

  private escapeLike(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
  }
}
