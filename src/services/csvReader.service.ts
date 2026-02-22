import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import * as fs from 'fs';
import { parse } from 'csv-parse';
import { Repository } from 'typeorm';
import { ProductionData } from '../entities/production.entitie';
import { Well } from '../entities/well.entitie';
import { InjectRepository } from '@nestjs/typeorm';
import * as path from 'path';

@Injectable()
export class CsvBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CsvBootstrapService.name);

  constructor(
    @InjectRepository(ProductionData)
    private readonly productionRepo: Repository<ProductionData>,

    @InjectRepository(Well)
    private readonly wellRepo: Repository<Well>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('Application bootstrap started. Loading CSV files...');

    const dirPath = path.join(process.cwd(), '\\src\\Datas');

    let files: string[];
    try {
      files = await fs.promises.readdir(dirPath);
    } catch (err) {
      this.logger.error(`Failed to read directory: ${dirPath}`, err);
      return;
    }

    const csvFiles = files.filter((f) => f.endsWith('.csv'));

    // 1. First import Wells.csv so foreign keys exist before production data
    const wellsFile = csvFiles.find((f) => f === 'Wells.csv');
    const lenth_wellfile = await this.wellRepo.count();
    lenth_wellfile === 0
      ? await this.importCsvToDb(path.join(dirPath, wellsFile ?? 'Wells.csv'))
      : this.logger.warn('Wells data already exists. Skipping wells import.');

    // 2. Import all production files (those starting with "9")
    const productionFiles = csvFiles.filter((f) => f.startsWith('9'));

    const lenth_data = await this.productionRepo.count();

    lenth_data === 0
      ? productionFiles.map(async (file) => {
          await this.importCsvToDb(path.join(dirPath, file));
          this.logger.log('All CSV files imported successfully.');
        })
      : this.logger.warn(
          'Production data already exists. Skipping production import.',
        );
  }

  private async importCsvToDb(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any> = [];
      const fileName = path.basename(filePath);

      fs.createReadStream(filePath)
        .pipe(
          parse({
            columns: true, // ← uses first row as header → named objects
            trim: true, // ← trims whitespace from values & headers
          }),
        )
        .on('data', (row: Record<string, any>) => {
          row = {
            ...row,
            well: row.well_name ? { id: parseInt(row.well_name) } : null, // ← convert to object for ManyToOne relation
            date: row.date ? new Date(row.date) : null,
            work_time: row.work_time ? parseFloat(row.work_time) : null,
            down_pressure: row.down_pressure
              ? parseFloat(row.down_pressure)
              : null,
            down_temperature: row.down_temperature
              ? parseFloat(row.down_temperature)
              : null,
            choke_size: row.choke_size ? parseFloat(row.choke_size) : null,
            head_pressure: row.head_pressure
              ? parseFloat(row.head_pressure)
              : null,
            head_tempereture: row.head_tempereture
              ? parseFloat(row.head_tempereture)
              : null,
            chocke_pressure: row.chocke_pressure
              ? parseFloat(row.chocke_pressure)
              : null,
            oil: row.oil ? parseFloat(row.oil) : null,
            gas: row.gas ? parseFloat(row.gas) : null,
            water: row.water ? parseFloat(row.water) : null,
            water_i: row.water_i ? parseFloat(row.water_i) : null,
          };
          rows.push(row);
        })
        .on('end', async () => {
          try {
            if (rows.length === 0) {
              this.logger.warn(`No data rows found in ${fileName}`);
              return resolve();
            }

            if (fileName === 'Wells.csv') {
              await this.wellRepo
                .createQueryBuilder()
                .insert()
                .into(Well)
                .values(rows) // ← now passing named objects, not raw arrays
                .orIgnore()
                .execute();

              this.logger.log(
                `Imported ${rows.length} well records from ${fileName}`,
              );
            } else {
              await this.productionRepo
                .createQueryBuilder()
                .insert()
                .into(ProductionData)
                .values(rows)
                .orIgnore()
                .execute();

              this.logger.log(
                `Imported ${rows.length} production records from ${fileName}`,
              );
            }

            resolve();
          } catch (err) {
            this.logger.error(`Failed to import ${fileName}`, err);
            reject(err);
          }
        })
        .on('error', (err) => {
          this.logger.error(`Stream error for ${fileName}`, err);
          reject(err);
        });
    });
  }
}
