import { Injectable } from '@nestjs/common';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

@Injectable()
export class CsvReaderService {
  read<T>(filePath: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const records: T[] = [];

      createReadStream(filePath)
        .pipe(parse({ columns: true, trim: true }))
        .on('data', (row) => records.push(row))
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }
}