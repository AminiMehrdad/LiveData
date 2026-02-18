import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionData } from '../entities/production.entitie';
import { CsvReaderService } from './csvReader.service';

@Injectable()
export class ProductionDataSeeder
  implements OnApplicationBootstrap {

  constructor(
    @InjectRepository(ProductionData)
    private readonly repo: Repository<ProductionData>,
    private readonly csvReader: CsvReaderService,
  ) {}

  async onApplicationBootstrap() {
    const rows = await this.csvReader.read<any>('data/examples.csv');

    if (!rows.length) return;

    await this.repo
      .createQueryBuilder()
      .insert()
      .into(ProductionData)
      .values(rows)
      .orIgnore() // ← KEY PART
      .execute();
  }
}
