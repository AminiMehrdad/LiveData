import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimeseriesHypertable1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
  
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

    // تبدیل جدول به Hypertable
    await queryRunner.query(`
      SELECT create_hypertable(
        'timeseries_data', 
        'timestamp',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );
    `);

    // تنظیم Compression Policy
    await queryRunner.query(`
      ALTER TABLE timeseries_data SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'metric_name',
        timescaledb.compress_orderby = 'timestamp DESC'
      );
    `);

    // فعال‌سازی compression برای داده‌های قدیمی‌تر از 7 روز
    await queryRunner.query(`
      SELECT add_compression_policy(
        'timeseries_data', 
        INTERVAL '7 days'
      );
    `);

    // سیاست حذف خودکار داده‌های قدیمی‌تر از 90 روز
    await queryRunner.query(`
      SELECT add_retention_policy(
        'timeseries_data', 
        INTERVAL '90 days'
      );
    `);

    // ایجاد Continuous Aggregate برای آگرگیشن‌های روزانه
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW timeseries_data_daily
      WITH (timescaledb.continuous) AS
      SELECT 
        time_bucket('1 day', timestamp) AS bucket,
        metric_name,
        AVG(value) as avg_value,
        MAX(value) as max_value,
        MIN(value) as min_value,
        COUNT(*) as count
      FROM timeseries_data
      GROUP BY bucket, metric_name
      WITH NO DATA;
    `);

    // تنظیم Refresh Policy برای continuous aggregate
    await queryRunner.query(`
      SELECT add_continuous_aggregate_policy(
        'timeseries_data_daily',
        start_offset => INTERVAL '3 days',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS timeseries_data_daily;`);
    await queryRunner.query(`SELECT remove_retention_policy('timeseries_data');`);
    await queryRunner.query(`SELECT remove_compression_policy('timeseries_data');`);
    // Hypertable را نمی‌توان به راحتی برگرداند
  }
}
