// src/services/file-parser.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';

export interface ParsedTimeseriesData {
  timestamp: Date;
  metric_name: string;
  value: number;
  metadata?: Record<string, any>;
  source: string;
}

@Injectable()
export class FileParserService {
  async parseExcelFile(buffer: Buffer, filename: string): Promise<ParsedTimeseriesData[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,
        dateNF: 'yyyy-mm-dd hh:mm:ss' 
      });

      return this.normalizeData(jsonData, filename);
    } catch (error) {
      throw new BadRequestException(`Failed to parse Excel file: ${error.message}`);
    }
  }

  async parseCsvFile(buffer: Buffer, filename: string): Promise<ParsedTimeseriesData[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer.toString());

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          try {
            const normalized = this.normalizeData(results, filename);
            resolve(normalized);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => reject(error));
    });
  }

  private normalizeData(data: any[], source: string): ParsedTimeseriesData[] {
    return data.map((row, index) => {
      // فرض بر این است که ستون‌ها به صورت زیر هستند:
      // timestamp, metric_name, value, ...other fields
      
      const timestamp = this.parseTimestamp(row.timestamp || row.time || row.date);
      
      if (!timestamp || isNaN(timestamp.getTime())) {
        throw new BadRequestException(
          `Invalid timestamp at row ${index + 1}: ${row.timestamp}`
        );
      }

      const value = parseFloat(row.value);
      if (isNaN(value)) {
        throw new BadRequestException(
          `Invalid value at row ${index + 1}: ${row.value}`
        );
      }

      // استخراج metadata از ستون‌های اضافی
      const metadata: Record<string, any> = {};
      const reservedFields = ['timestamp', 'time', 'date', 'metric_name', 'value'];
      
      Object.keys(row).forEach((key) => {
        if (!reservedFields.includes(key)) {
          metadata[key] = row[key];
        }
      });

      return {
        timestamp,
        metric_name: row.metric_name || row.metric || 'default_metric',
        value,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        source,
      };
    });
  }

  private parseTimestamp(value: any): Date {
    if (value instanceof Date) {
      return value;
    }

    // تلاش برای parse کردن format‌های مختلف
    const date = new Date(value);
    
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Excel serial date number
    if (typeof value === 'number' && value > 25569) {
      return new Date((value - 25569) * 86400 * 1000);
    }

    throw new Error(`Unable to parse timestamp: ${value}`);
  }
}
