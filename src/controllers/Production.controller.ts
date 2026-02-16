import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductionData } from '../entities/production.entitie';
import { Well } from '../entities/well.entitie';

@ApiTags('Production')
@Controller('production')
export class ProductionController {
  constructor(
    @InjectRepository(ProductionData)
    private readonly productionRepo: Repository<ProductionData>,
    @InjectRepository(Well)
    private readonly wellRepo: Repository<Well>,
  ) {}

  /**
   * Get all production records with optional pagination
   */
  @Get()
  @ApiOperation({ summary: 'Get all production data' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Records per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of production records',
  })
  async getAllProduction(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.productionRepo.findAndCount({
      relations: ['well'],
      skip,
      take: limit,
      order: { date: 'DESC' },
    });

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get production records by well ID
   */
  @Get('well/:wellId')
  @ApiOperation({ summary: 'Get production data for a specific well' })
  @ApiParam({
    name: 'wellId',
    required: true,
    type: Number,
    description: 'Well ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Records per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Production records for the well',
  })
  @ApiResponse({
    status: 404,
    description: 'Well not found',
  })
  async getProductionByWell(
    @Param('wellId', ParseIntPipe) wellId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const well = await this.wellRepo.findOne({ where: { id: wellId } });
    if (!well) {
      throw new BadRequestException(`Well with ID ${wellId} not found`);
    }

    const query = this.productionRepo
      .createQueryBuilder('prod')
      .where('prod.wellId = :wellId', { wellId });

    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
      query.andWhere('prod.date >= :startDate', { startDate: start });
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
      query.andWhere('prod.date <= :endDate', { endDate: end });
    }

    const skip = (page - 1) * limit;
    query.orderBy('prod.date', 'DESC').skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    return {
      well,
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get production record by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a production record by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    type: Number,
    description: 'Production record ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Production record details',
  })
  @ApiResponse({
    status: 404,
    description: 'Production record not found',
  })
  async getProductionById(@Param('id', ParseIntPipe) id: number) {
    const record = await this.productionRepo.findOne({
      where: { id },
      relations: ['well'],
    });

    if (!record) {
      throw new BadRequestException(`Production record with ID ${id} not found`);
    }

    return record;
  }

  /**
   * Get summary statistics for a well
   */
  @Get('well/:wellId/stats')
  @ApiOperation({ summary: 'Get production statistics for a well' })
  @ApiParam({
    name: 'wellId',
    required: true,
    type: Number,
    description: 'Well ID',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    description: 'End date (ISO 8601 format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Production statistics',
  })
  async getProductionStats(
    @Param('wellId', ParseIntPipe) wellId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const well = await this.wellRepo.findOne({ where: { id: wellId } });
    if (!well) {
      throw new BadRequestException(`Well with ID ${wellId} not found`);
    }

    const query = this.productionRepo
      .createQueryBuilder('prod')
      .select('COUNT(*)', 'count')
      .addSelect('AVG(prod.temperature_down)', 'avgTemperatureDown')
      .addSelect('AVG(prod.pressure_top)', 'avgPressureTop')
      .addSelect('AVG(prod.oil)', 'avgOil')
      .addSelect('AVG(prod.gas)', 'avgGas')
      .addSelect('AVG(prod.water)', 'avgWater')
      .addSelect('SUM(prod.oil)', 'totalOil')
      .addSelect('SUM(prod.gas)', 'totalGas')
      .addSelect('SUM(prod.water)', 'totalWater')
      .addSelect('MAX(prod.date)', 'latestDate')
      .addSelect('MIN(prod.date)', 'oldestDate')
      .where('prod.wellId = :wellId', { wellId });

    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
      query.andWhere('prod.date >= :startDate', { startDate: start });
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
      query.andWhere('prod.date <= :endDate', { endDate: end });
    }

    const stats = await query.getRawOne();

    return {
      well,
      stats: {
        recordCount: parseInt(stats.count, 10),
        avgTemperatureDown: parseFloat(stats.avgTemperatureDown) || 0,
        avgPressureTop: parseFloat(stats.avgPressureTop) || 0,
        avgOil: parseFloat(stats.avgOil) || 0,
        avgGas: parseFloat(stats.avgGas) || 0,
        avgWater: parseFloat(stats.avgWater) || 0,
        totalOil: parseFloat(stats.totalOil) || 0,
        totalGas: parseFloat(stats.totalGas) || 0,
        totalWater: parseFloat(stats.totalWater) || 0,
        latestDate: stats.latestDate,
        oldestDate: stats.oldestDate,
      },
    };
  }
}
