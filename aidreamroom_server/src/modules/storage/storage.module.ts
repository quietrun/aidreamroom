import { Module } from '@nestjs/common';

import { LocalStorageService } from './local-storage.service';
import { MinioStorageService } from './minio-storage.service';

@Module({
  providers: [LocalStorageService, MinioStorageService],
  exports: [LocalStorageService, MinioStorageService],
})
export class StorageModule {}
