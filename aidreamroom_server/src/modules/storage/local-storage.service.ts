import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';

type ParsedBase64Image = {
  buffer: Buffer;
  extension: string;
};

@Injectable()
export class LocalStorageService {
  private readonly uploadDir: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = resolve(
      this.configService.get<string>('app.localUploadDir', 'uploads'),
    );
    this.publicBaseUrl = this.configService.get<string>('app.localPublicBaseUrl', '');
  }

  async uploadBase64Image(fileName: string, base64Payload: string) {
    const image = this.parseBase64Image(base64Payload);
    const safeName = this.withExtension(fileName, image.extension);
    const relativePath = join('images', safeName);
    const absolutePath = join(this.uploadDir, relativePath);

    await mkdir(join(this.uploadDir, 'images'), { recursive: true });
    await writeFile(absolutePath, image.buffer);

    return this.buildPublicUrl(relativePath);
  }

  buildPublicUrl(relativePath: string) {
    const normalizedPath = relativePath.split('\\').join('/');
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/uploads/${normalizedPath}`;
    }

    const port = this.configService.get<number>('app.port', 8380);
    return `http://localhost:${port}/uploads/${normalizedPath}`;
  }

  parseBase64Image(base64Payload: string): ParsedBase64Image {
    const trimmed = String(base64Payload || '').trim();
    const match = trimmed.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/s);
    const extension = this.normalizeExtension(match?.[1] ?? '');
    const raw = match ? match[2] : trimmed;
    const buffer = Buffer.from(raw, 'base64');

    return {
      buffer,
      extension: extension || this.detectExtension(buffer),
    };
  }

  private withExtension(fileName: string, extension: string) {
    if (extname(fileName)) {
      return fileName;
    }

    return `${fileName}.${extension}`;
  }

  private normalizeExtension(value: string) {
    const normalized = value.toLowerCase().replace('jpeg', 'jpg');
    if (['jpg', 'png', 'webp', 'gif', 'avif'].includes(normalized)) {
      return normalized;
    }

    return '';
  }

  private detectExtension(buffer: Buffer) {
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return 'png';
    }
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
      return 'jpg';
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF') {
      return 'webp';
    }
    if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
      return 'gif';
    }

    return 'png';
  }
}
