import {
  Injectable,
  OnApplicationBootstrap,
  Logger,
} from '@nestjs/common';
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

    const dirPath = "D:\OilProjectDashbord\live_data\src\Datas"

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
    if (wellsFile) {
      await this.importCsvToDb(path.join(dirPath, wellsFile));
    } else {
      this.logger.warn('Wells.csv not found. Skipping well import.');
    }

    // 2. Import all production files (those starting with "9")
    const productionFiles = csvFiles.filter((f) => f.startsWith('9'));

    for (const file of productionFiles) {
      await this.importCsvToDb(path.join(dirPath, file));
    }

    this.logger.log('All CSV files imported successfully.');
  }

  private async importCsvToDb(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = [];
      const fileName = path.basename(filePath);

      fs.createReadStream(filePath)
        .pipe(
          parse({
            columns: true,       // ← uses first row as header → named objects
            trim: true,          // ← trims whitespace from values & headers
          }),
        )
        .on('data', (row: Record<string, any>) => {
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
                .values(rows)   // ← now passing named objects, not raw arrays
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
