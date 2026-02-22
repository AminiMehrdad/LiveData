import { Injectable, Inject } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import Redis from 'ioredis';

@Injectable()
export class SenderService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

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
    

    await this.redis.set('replay:last_date', this.currentDate.toString());
    const dateString = await this.redis.get('replay:last_date');
    const lastDate = new Date(dateString || this.currentDate.toString());
  }
}
