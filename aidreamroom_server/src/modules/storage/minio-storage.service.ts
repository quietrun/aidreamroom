import { Client } from 'minio';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MinioStorageService {
  private readonly client: Client;
  private readonly bucketName: string;
  private readonly imageBucketName: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('app.minioBucket', 'aidreamroom');
    this.imageBucketName = this.configService.get<string>('app.minioImageBucket', 'images');
    this.publicBaseUrl = this.configService.get<string>('app.minioPublicBaseUrl', '');
    this.client = new Client({
      endPoint: this.configService.get<string>('app.minioEndPoint', '127.0.0.1'),
      port: this.configService.get<number>('app.minioPort', 9000),
      useSSL: this.configService.get<boolean>('app.minioUseSsl', false),
      accessKey: this.configService.get<string>('app.minioAccessKey', ''),
      secretKey: this.configService.get<string>('app.minioSecretKey', ''),
    });
  }

  async uploadBase64Image(fileName: string, base64Payload: string) {
    const normalized = base64Payload.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(normalized, 'base64');
    await this.client.putObject(this.imageBucketName, fileName, buffer);

    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${fileName}`;
    }

    const protocol = this.configService.get<boolean>('app.minioUseSsl', false)
      ? 'https'
      : 'http';
    const host = this.configService.get<string>('app.minioEndPoint', '127.0.0.1');
    const port = this.configService.get<number>('app.minioPort', 9000);
    return `${protocol}://${host}:${port}/${this.imageBucketName}/${fileName}`;
  }

  async saveJson(path: string, payload: unknown) {
    await this.client.putObject(this.bucketName, path, JSON.stringify(payload));
  }

  async readText(path: string) {
    const stream = await this.client.getObject(this.bucketName, path);
    return await new Promise<string>((resolve) => {
      let value = '';
      stream.on('data', (chunk) => {
        value += chunk;
      });
      stream.on('end', () => resolve(value));
      stream.on('error', () => resolve(''));
    });
  }

  async tryReadJson<T>(path: string): Promise<T | null> {
    try {
      const text = await this.readText(path);
      return text ? (JSON.parse(text) as T) : null;
    } catch {
      return null;
    }
  }

  async getPresignedUrl(path: string) {
    return this.client.presignedGetObject(this.bucketName, path);
  }
}
