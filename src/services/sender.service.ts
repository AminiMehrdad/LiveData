import { Injectable, Inject } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

@Injectable()
export class SenderService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly dataSource: DataSource,
  ) { }

  async saveCurrentDate() {
    const dateString = await this.redis.get('replay:last_date');
    let currentDate: Date;

    if (dateString && new Date('2016-09-18') > new Date(dateString)) {
      currentDate = new Date(dateString);

      await this.redis.set('replay:last_date', currentDate.toString());
      return currentDate;
    }
    currentDate = new Date('2015-01-01');
    const nextDate = new Date(currentDate.getTime() + 1);

    await this.redis.set('replay:last_date', nextDate.toString());
    return nextDate;
  }

  // private currentDate = new Date('2014-01-01');

  @Interval(10000)
  async sendData() {
    const currentDate = await this.saveCurrentDate();


    const data = await this.getDataByDate(currentDate);

    if (Object.keys(data).length === 0) {
      return;
    }


  }

  async getDataByDate(date: Date) {
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
            'date', pd.date,
            'down_temperature', pd.down_temperature,
            'choke_size', pd.choke_size,
            'head_pressure', pd.head_pressure,
            'head_tempereture', pd.head_tempereture,
            'chocke_pressure', pd.chocke_pressure,
            'oil', pd.oil,
            'gas', pd.gas,
            'water', pd.water,
            'water_i', pd.water_i,
            'flow', pd.flow,
            'work_time', pd.work_time,
            'down_pressure', pd.down_pressure
          )
          ORDER BY pd.date
        ) AS data
      FROM production_data pd
      WHERE pd.date >= $1
        AND pd.date <  $2
      GROUP BY pd."wellId"
    ) records
    ON records."wellId" = w.id
    `,
      [start, end],
    );

    return result[0]?.result ?? {};
  }

  
}
