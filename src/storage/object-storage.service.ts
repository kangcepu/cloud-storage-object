import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';
import { SettingsService } from '../settings/settings.service';
import { StorageObject } from '../types';

interface MinioConfig {
  endpoint: string;
  publicEndpoint: string;
  accessKey: string;
  secretKey: string;
  region: string;
  useSsl: boolean;
  pathStyle: boolean;
}

@Injectable()
export class ObjectStorageService {
  private internalCache: { signature: string; client: S3Client } | null = null;
  private publicCache: { signature: string; client: S3Client } | null = null;

  constructor(private readonly settings: SettingsService) {}

  async testConnection(): Promise<{
    ok: true;
    buckets: Array<{ Name?: string; CreationDate?: Date }>;
    client: string;
  }> {
    const response = await this.internalClient().then((client) => client.send(new ListBucketsCommand({})));
    return { ok: true, buckets: response.Buckets ?? [], client: 'aws-sdk-v3' };
  }

  async listBuckets(): Promise<Array<{ Name?: string; CreationDate?: Date }>> {
    const response = await this.internalClient().then((client) => client.send(new ListBucketsCommand({})));
    return response.Buckets ?? [];
  }

  async createBucket(bucket: string): Promise<void> {
    await this.internalClient().then((client) => client.send(new CreateBucketCommand({ Bucket: bucket })));
  }

  async deleteBucket(bucket: string): Promise<void> {
    await this.internalClient().then((client) => client.send(new DeleteBucketCommand({ Bucket: bucket })));
  }

  async listObjects(
    bucket: string,
    prefix: string,
    continuationToken?: string,
    maxKeys = 1000,
  ): Promise<{
    objects: StorageObject[];
    prefixes: string[];
    truncated: boolean;
    nextContinuationToken: string | null;
  }> {
    const response = await this.internalClient().then((client) =>
      client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          Delimiter: '/',
          MaxKeys: Math.max(1, Math.min(maxKeys, 1000)),
          ContinuationToken: continuationToken || undefined,
        }),
      ),
    );
    return {
      objects: (response.Contents ?? []).flatMap((item) =>
        item.Key
          ? [{ key: item.Key, size: Number(item.Size ?? 0), lastModified: item.LastModified ?? null }]
          : [],
      ),
      prefixes: (response.CommonPrefixes ?? []).flatMap((item) => (item.Prefix ? [item.Prefix] : [])),
      truncated: Boolean(response.IsTruncated),
      nextContinuationToken: response.NextContinuationToken ?? null,
    };
  }

  async *iterateObjects(bucket: string, prefix: string): AsyncGenerator<StorageObject> {
    let continuationToken: string | undefined;
    do {
      const response = await this.internalClient().then((client) =>
        client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: 1000,
            ContinuationToken: continuationToken,
          }),
        ),
      );
      for (const item of response.Contents ?? []) {
        if (item.Key) {
          yield { key: item.Key, size: Number(item.Size ?? 0), lastModified: item.LastModified ?? null };
        }
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
  }

  async putObject(
    bucket: string,
    key: string,
    body: string | Buffer | Readable,
    contentType?: string,
    length?: number,
  ): Promise<void> {
    await this.internalClient().then((client) =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: length,
        }),
      ),
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.internalClient().then((client) =>
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    );
  }

  async copyObject(bucket: string, sourceKey: string, destinationKey: string): Promise<void> {
    const source = `/${bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`;
    await this.internalClient().then((client) =>
      client.send(new CopyObjectCommand({ Bucket: bucket, Key: destinationKey, CopySource: source })),
    );
  }

  async moveObject(bucket: string, sourceKey: string, destinationKey: string): Promise<void> {
    await this.copyObject(bucket, sourceKey, destinationKey);
    await this.deleteObject(bucket, sourceKey);
  }

  async statObject(
    bucket: string,
    key: string,
  ): Promise<{ exists: boolean; size: number; lastModified: Date | null }> {
    try {
      const response = await this.internalClient().then((client) =>
        client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
      );
      return {
        exists: true,
        size: Number(response.ContentLength ?? 0),
        lastModified: response.LastModified ?? null,
      };
    } catch {
      return { exists: false, size: 0, lastModified: null };
    }
  }

  async signedUrl(
    bucket: string,
    key: string,
    expires: number,
    disposition: 'inline' | 'attachment',
  ): Promise<string> {
    const client = await this.publicClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: disposition }),
      { expiresIn: expires },
    );
  }

  async objectStream(
    bucket: string,
    key: string,
    range?: string,
  ): Promise<{
    stream: Readable;
    contentType?: string;
    contentLength?: number;
    contentRange?: string;
    acceptRanges?: string;
    etag?: string;
    lastModified?: Date;
  }> {
    const response = await this.internalClient().then((client) =>
      client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range })),
    );
    if (!response.Body) {
      throw new BadRequestException('Object body kosong.');
    }
    const stream = response.Body as Readable;
    return {
      stream,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
      acceptRanges: response.AcceptRanges,
      etag: response.ETag,
      lastModified: response.LastModified,
    };
  }

  private async config(): Promise<MinioConfig> {
    const values = await this.settings.getGroup('minio');
    const endpoint = values.endpoint ?? '';
    const accessKey = values.access_key ?? '';
    const secretKey = values.secret_key ?? '';
    if (!endpoint || !accessKey || !secretKey) {
      throw new BadRequestException('MinIO belum dikonfigurasi.');
    }
    const useSsl = values.use_ssl === '1';
    return {
      endpoint: this.normalizeScheme(endpoint, useSsl),
      publicEndpoint: this.normalizeScheme(
        process.env.MINIO_PUBLIC_ENDPOINT || values.public_endpoint || endpoint,
        useSsl,
      ),
      accessKey,
      secretKey,
      region: values.region || 'us-east-1',
      useSsl,
      pathStyle: values.path_style_endpoint !== '0',
    };
  }

  private async internalClient(): Promise<S3Client> {
    const config = await this.config();
    const signature = this.signature(config.endpoint, config);
    if (this.internalCache?.signature !== signature) {
      this.internalCache?.client.destroy();
      this.internalCache = { signature, client: this.client(config.endpoint, config) };
    }
    return this.internalCache.client;
  }

  private async publicClient(): Promise<S3Client> {
    const config = await this.config();
    const signature = this.signature(config.publicEndpoint, config);
    if (this.publicCache?.signature !== signature) {
      this.publicCache?.client.destroy();
      this.publicCache = { signature, client: this.client(config.publicEndpoint, config) };
    }
    return this.publicCache.client;
  }

  private client(endpoint: string, config: MinioConfig): S3Client {
    return new S3Client({
      endpoint,
      region: config.region,
      forcePathStyle: config.pathStyle,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
  }

  private normalizeScheme(endpoint: string, useSsl: boolean): string {
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      return `${useSsl ? 'https' : 'http'}://${endpoint}`;
    }
    if (useSsl && endpoint.startsWith('http://')) {
      return `https://${endpoint.slice(7)}`;
    }
    if (!useSsl && endpoint.startsWith('https://')) {
      return `http://${endpoint.slice(8)}`;
    }
    return endpoint;
  }

  private signature(endpoint: string, config: MinioConfig): string {
    return JSON.stringify([endpoint, config.accessKey, config.secretKey, config.region, config.pathStyle]);
  }
}
