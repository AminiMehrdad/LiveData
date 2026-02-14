import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('timeseries_data')
@Index(['timestamp', 'metric_name'])
export class TimeseriesData {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz', nullable: false })
  @Index()
  timestamp: Date;

  @Column({ type: 'varchar', length: 100 })
  metric_name: string;

  @Column({ type: 'double precision' })
  value: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
