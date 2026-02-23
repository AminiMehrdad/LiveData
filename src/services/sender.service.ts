import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

@Injectable()
export class SenderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SenderService.name);

  // Start Replay date
  private readonly START_DATE = new Date('2015-01-01T00:00:00.000Z');

  // Stop Sending Replay in this Time
  private readonly STOP_DATE = new Date('2016-09-18T00:00:00.000Z');

  private readonly LAST_DATE_KEY = 'replay:last_date';
  private readonly INTERVAL_MS = 10_000; // In each 10's send the new data

  private intervalRef: NodeJS.Timeout | null = null;
  private isStopped = false;
  private isProcessing = false; // do not allow overlapping ticks

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly dataSource: DataSource,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async onModuleInit() {
    this.logger.log('SenderService initializing...');
    await this.initializeStartDate();
    this.startInterval();
  }

  async onModuleDestroy() {
    this.logger.log('SenderService shutting down...');
    this.stopInterval();
  }

  // ─── Core Logic ───────────────────────────────────────────────────────────

  /**
   * اگر Redis هیچ تاریخی ذخیره نداشت، از START_DATE شروع می‌کنیم.
   * اگر قبلاً متوقف شده بود (تاریخ >= STOP_DATE)، دیگر شروع نمی‌کنیم.
   */
  private async initializeStartDate(): Promise<void> {
    const storedDateStr = await this.redis.get(this.LAST_DATE_KEY);

    if (!storedDateStr) {
      this.logger.log(
        `No stored date found. Starting from ${this.START_DATE.toISOString()}`,
      );
      await this.redis.set(this.LAST_DATE_KEY, this.START_DATE.toISOString());
      return;
    }

    const storedDate = new Date(storedDateStr);

    if (storedDate >= this.STOP_DATE) {
      this.logger.log(
        `Stored date (${storedDate.toISOString()}) is already past STOP_DATE. Replay is complete.`,
      );
      this.isStopped = true;
    } else {
      this.logger.log(
        `Resuming replay from stored date: ${storedDate.toISOString()}`,
      );
    }
  }

  private startInterval(): void {
    if (this.isStopped) {
      this.logger.log('Replay already completed. Interval will not start.');
      return;
    }

    this.logger.log(
      `Starting replay interval every ${this.INTERVAL_MS}ms...`,
    );

    this.intervalRef = setInterval(async () => {
      await this.tick();
    }, this.INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
      this.logger.log('Interval stopped.');
    }
  }

  /**
   * tick reach each data from data set and send to rabbitMq
   * send corrent date one date next
   */
  private async tick(): Promise<void> {
    // اگر tick قبلی هنوز تمام نشده، این را رد می‌کنیم
    if (this.isProcessing) {
      this.logger.warn('Previous tick still processing. Skipping this tick.');
      return;
    }

    if (this.isStopped) {
      this.stopInterval();
      return;
    }

    this.isProcessing = true;

    try {
      const currentDate = await this.getCurrentDateFromRedis();

      // بررسی شرط توقف
      if (currentDate >= this.STOP_DATE) {
        this.logger.log(
          `Reached STOP_DATE (${this.STOP_DATE.toISOString()}). Stopping replay.`,
        );
        this.isStopped = true;
        this.stopInterval();
        return;
      }

      this.logger.debug(`Processing date: ${currentDate.toISOString()}`);

      // دریافت داده از DB
      const data = await this.getDataByDate(currentDate);


      if (!data || Object.keys(data).length === 0) {
        this.logger.debug(
          `No data found for ${currentDate.toISOString()}. Advancing to next day.`,
        );
      } else {
        // ارسال به RabbitMQ
        await this.publishToQueue(currentDate, data);
      }

      // پیشروی به روز بعد و ذخیره در Redis
      await this.advanceToNextDay(currentDate);
    } catch (error) {
      this.logger.error(`Error during tick: ${error.message}`, error.stack);
      // interval ادامه پیدا می‌کند — خطا باعث توقف کامل نمی‌شود
    } finally {
      this.isProcessing = false;
    }
  }

  // ─── Redis Helpers ────────────────────────────────────────────────────────

  private async getCurrentDateFromRedis(): Promise<Date> {
    const storedDateStr = await this.redis.get(this.LAST_DATE_KEY);

    if (!storedDateStr) {
      // fallback اگر Redis خالی بود
      await this.redis.set(this.LAST_DATE_KEY, this.START_DATE.toISOString());
      return new Date(this.START_DATE);
    }

    return new Date(storedDateStr);
  }

  private async advanceToNextDay(currentDate: Date): Promise<void> {
    const nextDate = new Date(currentDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    nextDate.setUTCHours(0, 0, 0, 0);

    await this.redis.set(this.LAST_DATE_KEY, nextDate.toISOString());

    this.logger.debug(
      `Advanced to next date: ${nextDate.toISOString()}`,
    );
  }

  // ─── RabbitMQ Publisher ───────────────────────────────────────────────────

  private async publishToQueue(date: Date, data: Record<string, unknown>): Promise<void> {
    const message = {
      timestamp: new Date().toISOString(),
      replayDate: date.toISOString(),
      payload: data,
    };

    await this.amqpConnection.publish(
      'production_data_exchange', // exchange name
      'production.data.daily',    // routing key
      message,
      {
        persistent: true, // پیام روی disk ذخیره می‌شود
        contentType: 'application/json',
      },
    );

    this.logger.log(
      `Published data for ${date.toISOString()} to RabbitMQ. Wells: ${Object.keys(data).length}`,
    );
  }

  // ─── Database Query ───────────────────────────────────────────────────────

  async getDataByDate(date: Date): Promise<Record<string, unknown>> {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);


    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);


    const result = await this.dataSource.query(
      `
      SELECT
        jsonb_object_agg(
          w.well_name,
          jsonb_build_object(
            'well_id', w.id,
            'records', records.data
          )
        ) AS result
      FROM well w
      JOIN (
        SELECT
          pd."wellId",
          jsonb_agg(
            jsonb_build_object(
              'date',              pd.date,
              'down_temperature',  pd.down_temperature,
              'choke_size',        pd.choke_size,
              'head_pressure',     pd.head_pressure,
              'head_tempereture',  pd.head_tempereture,
              'chocke_pressure',   pd.chocke_pressure,
              'oil',               pd.oil,
              'gas',               pd.gas,
              'water',             pd.water,
              'water_i',           pd.water_i,
              'flow',              pd.flow,
              'work_time',         pd.work_time,
              'down_pressure',     pd.down_pressure
            )
            ORDER BY pd.date
          ) AS data
        FROM production_data pd
        WHERE pd.date >= $1
          AND pd.date <  $2
        GROUP BY pd."wellId"
      ) records ON records."wellId" = w.id
      `,
      [start, end],
    );

    return result[0]?.result ?? {};
  }
}

