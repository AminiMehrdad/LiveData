import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { get } from 'http';

@Controller('upload')
export class UploadController {
  @Get()
  getHello(): string {
    return 'Hello World!';
  }
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSV(
    @UploadedFile() file: Express.Multer.File,
    @Body('wellName') wellName: string,
  ) {
    console.log(wellName);

    // return this.productionService.processCSV(file, wellName);
  }
}
