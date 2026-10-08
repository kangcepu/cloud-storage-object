import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolConnection, ResultSetHeader, RowDataPacket, createPool } from 'mysql2/promise';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    this.pool = createPool({
      host: config.getOrThrow<string>('DB_HOST'),
      port: Number(config.get<string>('DB_PORT', '3306')),
      database: config.getOrThrow<string>('DB_NAME'),
      user: config.getOrThrow<string>('DB_USER'),
      password: config.getOrThrow<string>('DB_PASSWORD'),
      charset: 'utf8mb4',
      connectionLimit: 20,
      waitForConnections: true,
      queueLimit: 0,
      dateStrings: true,
      decimalNumbers: true,
    });
  }

  async query<T extends RowDataPacket>(sql: string, values: any[] = []): Promise<T[]> {
    const [rows] = await this.pool.query<T[]>(sql, values);
    return rows;
  }

  async one<T extends RowDataPacket>(sql: string, values: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, values);
    return rows[0] ?? null;
  }

  async execute(sql: string, values: any[] = []): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, values);
    return result;
  }

  async transaction<T>(handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await handler(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  now(): string {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
