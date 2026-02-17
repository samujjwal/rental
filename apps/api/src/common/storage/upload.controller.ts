import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';

type UploadResponse = {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
};

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload a single image' })
  @ApiResponse({ status: 200, description: 'Image uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: any): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Invalid image type');
    }

    const result = await this.storageService.upload({
      file: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: 'images',
    });

    return this.toUploadResponse(result, file.mimetype);
  }

  @Post('images')
  @ApiOperation({ summary: 'Upload multiple images' })
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadImages(
    @UploadedFiles() files: any[],
  ): Promise<UploadResponse[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const uploads = await Promise.all(
      files.map(async (file) => {
        if (!file.mimetype?.startsWith('image/')) {
          throw new BadRequestException('Invalid image type');
        }
        const result = await this.storageService.upload({
          file: file.buffer,
          fileName: file.originalname,
          mimeType: file.mimetype,
          folder: 'images',
        });
        return this.toUploadResponse(result, file.mimetype);
      }),
    );

    return uploads;
  }

  @Post('document')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiResponse({ status: 200, description: 'Document uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: any): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.storageService.upload({
      file: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder: 'documents',
    });

    return this.toUploadResponse(result, file.mimetype);
  }

  private toUploadResponse(
    result: { url: string; key: string; size: number },
    mimeType: string,
  ): UploadResponse {
    return {
      url: result.url,
      key: result.key,
      bucket: this.getBucketName(),
      size: result.size,
      mimeType,
    };
  }

  private getBucketName(): string {
    const r2Account = this.configService.get<string>('R2_ACCOUNT_ID');
    const r2Bucket = this.configService.get<string>('R2_BUCKET_NAME');
    if (r2Account && r2Bucket) {
      return r2Bucket;
    }
    return 'local';
  }
}
