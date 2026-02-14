// src/services/timeseries-query.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeseriesData } from '../entities/timeseries-data.entity';

@Injectable()
export class TimeseriesQueryService {
  constructor(
    @InjectRepository(TimeseriesData)
    private timeseriesRepository: Repository<TimeseriesData>,
  ) {}

  async getAggregatedData(
    metricName: string,
    start: Date,
    end: Date,
    interval: string,
  ): Promise<any[]> {
    // استفاده از time_bucket function از TimescaleDB
    const query = `
      SELECT 
        time_bucket($1, timestamp) AS bucket,
        AVG(value) as avg_value,
        MAX(value) as max_value,
        MIN(value) as min_value,
        COUNT(*) as count,
        STDDEV(value) as stddev_value
      FROM timeseries_data
      WHERE 
        metric_name = $2
        AND timestamp >= $3
        AND timestamp <= $4
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    return this.timeseriesRepository.query(query, [
      interval,
      metricName,
      start,
      end,
    ]);
  }

  async getLatestData(metricName: string, limit: number): Promise<TimeseriesData[]> {
    const query = this.timeseriesRepository
      .createQueryBuilder('td')
      .where('td.metric_name = :metricName', { metricName })
      .orderBy('td.timestamp', 'DESC')
      .limit(limit);

    return query.getMany();
  }

  async getStatistics(metricName: string, start: Date, end: Date): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        AVG(value) as average,
        MAX(value) as maximum,
        MIN(value) as minimum,
        STDDEV(value) as standard_deviation,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as percentile_95
      FROM timeseries_data
      WHERE 
        metric_name = $1
        AND timestamp >= $2
        AND timestamp <= $3
    `;

    const result = await this.timeseriesRepository.query(query, [
      metricName,
      start,
      end,
    ]);

    return result[0];
  }

  // استفاده از Continuous Aggregate برای query های سریع‌تر
  async getDailyAggregates(metricName: string, start: Date, end: Date): Promise<any[]> {
    const query = `
      SELECT 
        bucket,
        avg_value,
        max_value,
        min_value,
        count
      FROM timeseries_data_daily
      WHERE 
        metric_name = $1
        AND bucket >= $2
        AND bucket <= $3
      ORDER BY bucket ASC
    `;

    return this.timeseriesRepository.query(query, [metricName, start, end]);
  }
}
