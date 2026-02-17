import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { ProductionData } from '../entities/production.entitie';
import { Well } from '../entities/well.entitie';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parse/sync';

@Injectable()
export class DataService {
  constructor(
    @InjectRepository(ProductionData)
    private readonly productionRepository: Repository<ProductionData>,
    @InjectRepository(Well)
    private readonly wellRepository: Repository<Well>,
  ) {}

  /**
   * Get production data within a date range, grouped by well name
   * Returns data sorted from latest to newest within the range
   */
  async getDataByDateRange(startDate: Date, endDate: Date) {
    // Ensure startDate is before endDate
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    // Query data within the date range, sorted by date descending (latest first)
    const data = await this.productionRepository.find({
      where: {
        date: Between(startDate, endDate),
      },
      relations: ['well'],
      order: {
        date: 'DESC', // Latest first
      },
    });

    // Group data by well name
    const groupedData = this.groupByWell(data);

    return {
      dateRange: {
        start: startDate,
        end: endDate,
      },
      totalRecords: data.length,
      wellsData: groupedData,
    };
  }

  /**
   * Load CSV files from a directory and insert into database
   */
  async loadCSVData(csvDirectory: string = process.cwd()) {
    const files = fs.readdirSync(csvDirectory).filter((f) => f.endsWith('.csv'));

    for (const file of files) {
      const filePath = path.join(csvDirectory, file);
      await this.parseAndInsertCSV(filePath);
    }

    return {
      message: `Successfully loaded ${files.length} CSV files`,
      filesProcessed: files,
    };
  }

  /**
   * Parse a single CSV file and insert into database
   */
  private async parseAndInsertCSV(filePath: string) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    for (const record of records) {
      const wellName = record.well_name?.trim();
      if (!wellName) continue;

      // Find or create well
      let well = await this.wellRepository.findOne({
        where: { name: wellName },
      });

      if (!well) {
        well = this.wellRepository.create({ name: wellName });
        await this.wellRepository.save(well);
      }

      // Check if record already exists
      const existingRecord = await this.productionRepository.findOne({
        where: {
          well: { id: well.id },
          date: new Date(record.date),
        },
      });

      if (!existingRecord) {
        const productionData = this.productionRepository.create({
          well,
          date: new Date(record.date),
          temperature_down: this.parseFloat(record.temperature_down),
          chock_size: this.parseFloat(record.chock_size),
          pressure_top: this.parseFloat(record.pressure_top),
          temprature_top: this.parseFloat(record.temprature_top),
          chocke_pressure: this.parseFloat(record.chocke_pressure),
          oil: this.parseFloat(record.oil),
          gas: this.parseFloat(record.gas),
          water: this.parseFloat(record.water),
          water_i: this.parseFloat(record.water_i),
          FLOW_KIND: record.FLOW_KIND,
        });

        await this.productionRepository.save(productionData);
      }
    }
  }

  /**
   * Get data for a specific well within date range
   */
  async getWellDataByDateRange(
    wellName: string,
    startDate: Date,
    endDate: Date,
  ) {
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    const well = await this.wellRepository.findOne({
      where: { name: wellName },
    });

    if (!well) {
      return {
        message: `Well '${wellName}' not found`,
        data: [],
      };
    }

    const data = await this.productionRepository.find({
      where: {
        well: { id: well.id },
        date: Between(startDate, endDate),
      },
      order: {
        date: 'DESC', // Latest first
      },
    });

    return {
      wellName,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      recordCount: data.length,
      data,
    };
  }

  /**
   * Get all available well names
   */
  async getAllWells() {
    const wells = await this.wellRepository.find();
    return wells.map((w) => w.name);
  }

  /**
   * Group production data by well name
   */
  private groupByWell(data: ProductionData[]) {
    const grouped: { [key: string]: ProductionData[] } = {};

    for (const record of data) {
      const wellName = record.well.name;
      if (!grouped[wellName]) {
        grouped[wellName] = [];
      }
      grouped[wellName].push(record);
    }

    return grouped;
  }

  /**
   * Safely parse float values from CSV
   */
  private parseFloat(value: any): number | undefined {
    if (!value || value.trim() === '') return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }
}
