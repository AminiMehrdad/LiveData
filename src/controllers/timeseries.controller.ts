// src/controllers/timeseries.controller.ts
import {
  Controller,
  Post,
  Get,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileParserService } from '../services/file-parser.service';
import { RabbitMQProducerService } from '../services/rabbitmq-producer.service';
import { TimeseriesQueryService } from '../services/timeseries-query.service';

@Controller('api/timeseries')
export class TimeseriesController {
  constructor(
    private fileParserService: FileParserService,
    private producerService: RabbitMQProducerService,
    private queryService: TimeseriesQueryService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only CSV and Excel files are allowed');
    }

    let parsedData;

    if (file.mimetype === 'text/csv') {
      parsedData = await this.fileParserService.parseCsvFile(
        file.buffer,
        file.originalname,
      );
    } else {
      parsedData = await this.fileParserService.parseExcelFile(
        file.buffer,
        file.originalname,
      );
    }

    // ارسال به RabbitMQ
    await this.producerService.sendDataBatch(parsedData);

    return {
      message: 'File uploaded and queued for processing',
      recordCount: parsedData.length,
      filename: file.originalname,
    };
  }

  @Get('query')
  async queryData(
    @Query('metric') metric: string,
    @Query('start') startDate: string,
    @Query('end') endDate: string,
    @Query('interval') interval: string = '1 hour',
  ) {
    if (!metric || !startDate || !endDate) {
      throw new BadRequestException('metric, start, and end parameters are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    return this.queryService.getAggregatedData(metric, start, end, interval);
  }

  @Get('latest')
  async getLatestData(@Query('metric') metric: string, @Query('limit') limit: string = '100') {
    return this.queryService.getLatestData(metric, parseInt(limit));
  }

  @Get('stats')
  async getStatistics(
    @Query('metric') metric: string,
    @Query('start') startDate: string,
    @Query('end') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.queryService.getStatistics(metric, start, end);
  }
}
