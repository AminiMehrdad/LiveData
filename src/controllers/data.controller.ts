import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { DataService } from '../services/data.service';

@Controller('data')
export class DataController {
  constructor(private readonly dataService: DataService) {}

  /**
   * Load all CSV files from the project root into the database
   * POST /data/load-csv
   */
  @Post('load-csv')
  async loadCSVData() {
    return await this.dataService.loadCSVData();
  }

  /**
   * Get all production data within a date range, grouped by well
   * GET /data/by-date-range?startDate=2014-04-07&endDate=2014-04-30
   */
  @Get('by-date-range')
  async getDataByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      return {
        error: 'Both startDate and endDate query parameters are required',
        example: '/data/by-date-range?startDate=2014-04-07&endDate=2014-04-30',
      };
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          error: 'Invalid date format. Use YYYY-MM-DD',
          example: '/data/by-date-range?startDate=2014-04-07&endDate=2014-04-30',
        };
      }

      return await this.dataService.getDataByDateRange(start, end);
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  /**
   * Get data for a specific well within date range
   * GET /data/well?wellName=NO%2015/9-F-1%20C&startDate=2014-04-07&endDate=2014-04-30
   */
  @Get('well')
  async getWellData(
    @Query('wellName') wellName: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!wellName || !startDate || !endDate) {
      return {
        error:
          'wellName, startDate, and endDate query parameters are required',
        example:
          '/data/well?wellName=NO%2015/9-F-1%20C&startDate=2014-04-07&endDate=2014-04-30',
      };
    }

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return {
          error: 'Invalid date format. Use YYYY-MM-DD',
          example:
            '/data/well?wellName=NO%2015/9-F-1%20C&startDate=2014-04-07&endDate=2014-04-30',
        };
      }

      return await this.dataService.getWellDataByDateRange(wellName, start, end);
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  /**
   * Get all available well names
   * GET /data/wells
   */
  @Get('wells')
  async getAllWells() {
    const wells = await this.dataService.getAllWells();
    return {
      totalWells: wells.length,
      wells,
    };
  }
}
