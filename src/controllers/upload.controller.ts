import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UploadCsvDto } from '../dtos/upload-csv.dto';
import { ProductionService } from '../services/production.service';


@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly productionService: ProductionService) {}


  @Get()
  @ApiOperation({ summary: 'get Hellow World' })
  @ApiResponse({
    status: 200,
    description: 'test the get request',
  })
  getHello(): string {
    return 'Hello World!';
  }


  @Post()
  @ApiOperation({ summary: 'Upload a file using Multer' })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload CSV file with well name',
    description: 'Uploads a CSV file and associates it with a wellName',
  })
  @ApiBody({
    type: UploadCsvDto,
  })
  @ApiResponse({
    status: 201,
    description: 'CSV file uploaded successfully',
    schema: {
      example: {
        wellName: 'Well-Alpha-01',
        originalname: 'data.csv',
        size: 10240,
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadCSV(
    @UploadedFile() file: Express.Multer.File,
    @Body('wellName') wellName: string,
  ) {
    // if multer uses disk storage, file.buffer may be undefined; service handles both
    const result = await this.productionService.processCSV(file, wellName);
    return {
      result
    };
  }

  @Delete('/duplicates/well/:wellId')
  @ApiOperation({ summary: 'Remove duplicate records for a well' })
  @ApiParam({
    name: 'wellId',
    description: 'The ID of the well to remove duplicates from',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Duplicates removed successfully',
    schema: {
      example: {
        message: 'Removed 5 duplicate records for well 1',
        removed: 5,
      },
    },
  })
  async removeDuplicates(@Param('wellId') wellId: string) {
    const removed = await this.productionService.removeDuplicatesForWell(
      parseInt(wellId, 10),
    );
    return {
      message: `Removed ${removed} duplicate records for well ${wellId}`,
      removed,
    };
  }
}
