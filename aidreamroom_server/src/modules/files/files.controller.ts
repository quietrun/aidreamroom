import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';

import { generateUuid } from '../../common/utils/id.util';
import { MinioStorageService } from '../storage/minio-storage.service';

class UploadDto {
  @IsString()
  @IsNotEmpty()
  file!: string;
}

@Controller()
export class FilesController {
  constructor(private readonly minioStorageService: MinioStorageService) {}

  @Get()
  index() {
    return {
      title: 'AI Dreamroom Nest Server',
      status: 'ok',
    };
  }

  @Post('upload')
  async upload(@Body() body: UploadDto) {
    const fileName = generateUuid();
    const url = await this.minioStorageService.uploadBase64Image(fileName, body.file);
    return {
      result: 0,
      url,
    };
  }
}
