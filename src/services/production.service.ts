import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { ProductionData } from '../entities/production.entitie';
import { Well } from '../entities/well.entitie';
import * as fs from 'fs';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    @InjectRepository(ProductionData)
    private readonly productionRepo: Repository<ProductionData>,
    @InjectRepository(Well)
    private readonly wellRepo: Repository<Well>,
  ) {}

  async processCSV(file: Express.Multer.File, wellName?: string) {
    const rows: any[] = [];

    const stream = file.buffer
      ? Readable.from([file.buffer])
      : fs.createReadStream(file.path);

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve())
        .on('error', (err) => reject(err));
    });

    if (!rows.length) return { count: 0 };

    // Normalize production field map to match entity property names
    const productionFieldMap: Record<string, string> = {
      temperature_down: 'temperature_down',
      chock_size: 'chock_size',
      pressure_top: 'pressure_top',
      temprature_top: 'temprature_top',
      chocke_pressure: 'chocke_pressure',
      oil: 'oil',
      gas: 'gas',
      water: 'water',
      water_i: 'water_i',
      flow_kind: 'FLOW_KIND',
      flowkind: 'FLOW_KIND',
      hover_open: 'hover_open',
      pressure_down: 'pressure_down',
      date: 'date',
    };

    // prepare or find well
    let well: Well | null = null;
    if (wellName) {
      well = await this.wellRepo.findOne({ where: { name: wellName } });
      if (!well) {
        well = this.wellRepo.create({ name: wellName });
        well = await this.wellRepo.save(well);
      }
    }

    const toSave: ProductionData[] = [];

    for (const row of rows) {
      // find wellName in row if not provided
      if (!well) {
        const possibleName = row.well || row.Well || row.wellName || row.WELL || row['well name'];
        if (possibleName) {
          const name = String(possibleName).trim();
          well = await this.wellRepo.findOne({ where: { name } });
          if (!well) {
            well = this.wellRepo.create({ name });
            well = await this.wellRepo.save(well);
          }
        }
      }

      const prod = this.productionRepo.create();
      if (well) prod.well = well;


      for (const key of Object.keys(row)) {
        const rawKey = key.trim();
        const k = rawKey.toLowerCase().replace(/\s+/g, '_');
        if (k === 'date' || k === 'time' || k === 'recordedat' || k === 'recorded_at') {
          const d = new Date(row[key]);
          if (!isNaN(d.getTime())) prod.date = d;
          continue;
        }

        const mapped = productionFieldMap[k];
        if (mapped) {
          const val = row[key];
          if (mapped === 'FLOW_KIND') {
            prod[mapped] = String(val);
          } else {
            const num = parseFloat(String(val).replace(/,/g, ''));
            if (!isNaN(num)) prod[mapped] = num;
          }
        } else {
          // also try to map numeric columns that match property names directly
          const prop = k;
          if (prop in prod) {
            const num = parseFloat(String(row[key]).replace(/,/g, ''));
            if (!isNaN(num)) prod[prop] = num;
          }
        }
      }

      // ensure date exists
      if (!prod.date) {
        // try common column names
        const possibleDate = row.Date || row.date || row.RecordedAt || row.recordedAt;
        if (possibleDate) {
          const d = new Date(possibleDate);
          if (!isNaN(d.getTime())) prod.date = d;
        }
      }

      toSave.push(prod);
    }

    // Check for duplicates before saving: keep only records with unique (well + date) combinations
    const uniqueRecords = await this.deduplicateRecords(toSave, well);

    // save all unique records
    const saved = await this.productionRepo.save(uniqueRecords as any);

    // Optionally update well properties from CSV first row if columns exist
    const first = rows[0];
    const wellUpdate: Partial<Well> = {};
    if (first.lat || first.Lat || first.latitude) wellUpdate.lat = String(first.lat || first.Lat || first.latitude);
    if (first.lng || first.Lng || first.longitude) wellUpdate.lng = String(first.lng || first.Lng || first.longitude);
    if (first.drilingcost || first.drillingcost || first.driling_cost) wellUpdate.drilingcost = String(first.drilingcost || first.drillingcost || first.driling_cost);
    if (Object.keys(wellUpdate).length && well) {
      this.wellRepo.merge(well, wellUpdate);
      await this.wellRepo.save(well);
    }

    this.logger.log(`Imported ${saved.length} production rows`);
    return { count: saved.length };
  }

  /**
   * Deduplicate records based on well + date combination
   * If a record with same well + date exists in DB, skip it
   * Returns only new unique records to save
   */
  private async deduplicateRecords(
    records: ProductionData[],
    well?: Well | null,
  ): Promise<ProductionData[]> {
    const newRecords: ProductionData[] = [];
    const seenDates = new Set<string>();

    for (const record of records) {
      if (!record.date) continue;

      const recordWell = record.well || well;
      if (!recordWell) {
        newRecords.push(record);
        continue;
      }

      // Create a unique key: wellId + date
      const dateKey = record.date.toISOString();
      const uniqueKey = `${recordWell.id}_${dateKey}`;

      // Skip if we already have this date in current batch
      if (seenDates.has(uniqueKey)) {
        this.logger.warn(
          `Skipping duplicate record for well ${recordWell.name} at ${dateKey}`,
        );
        continue;
      }

      // Check if this record already exists in the database
      const existing = await this.productionRepo.findOne({
        where: {
          well: { id: recordWell.id },
          date: record.date,
        },
      });

      if (!existing) {
        seenDates.add(uniqueKey);
        newRecords.push(record);
      } else {
        this.logger.warn(
          `Record already exists for well ${recordWell.name} at ${dateKey}, skipping`,
        );
      }
    }

    this.logger.log(
      `Deduplicated from ${records.length} to ${newRecords.length} records`,
    );
    return newRecords;
  }

  /**
   * Remove all duplicate records for a specific well
   * Keeps the latest record for each date, deletes older ones
   */
  async removeDuplicatesForWell(wellId: number): Promise<number> {
    // Get all production data for this well, ordered by date and ID (to identify latest)
    const allRecords = await this.productionRepo.find({
      where: { well: { id: wellId } },
      order: { date: 'ASC', id: 'DESC' },
    });

    const dateMap = new Map<string, number[]>();

    // Group records by date
    for (const record of allRecords) {
      const dateKey = record.date.toISOString();
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(record.id);
    }

    // Find IDs to delete (keep only the first/latest ID for each date)
    const idsToDelete: number[] = [];
    for (const [, ids] of dateMap) {
      if (ids.length > 1) {
        // Keep the first (latest), delete the rest
        idsToDelete.push(...ids.slice(1));
      }
    }

    if (idsToDelete.length === 0) {
      this.logger.log(`No duplicates found for well ${wellId}`);
      return 0;
    }

    // Delete duplicate records
    await this.productionRepo.delete(idsToDelete);
    this.logger.log(
      `Removed ${idsToDelete.length} duplicate records for well ${wellId}`,
    );
    return idsToDelete.length;
  }

  async getProductionData(wellId: number, startDate?: Date, endDate?: Date) {
    const where: any = { well: { id: wellId } };
    if (startDate) where.date = where.date || {};
    if (startDate) where.date['$gte'] = startDate;
    if (endDate) where.date = where.date || {};
    if (endDate) where.date['$lte'] = endDate;

    return this.productionRepo.find({
      where,
      order: { date: 'ASC' },
    });
  }
}
