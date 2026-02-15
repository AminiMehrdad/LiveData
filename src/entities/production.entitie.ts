import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Well } from './well.entitie';

@Entity()
@Index(['well', 'recordedAt']) // important for ordering & fast queries
export class ProductionData {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Well, { onDelete: 'CASCADE' })
  well: Well;

  @Column('timestamp')
  date: Date;

  @Column('float')
  temperature_down?: number;

  @Column('float')
  chock_size?: number;

  @Column('float')
  pressure_top?: number;

  @Column('float')
  temprature_top?: number;

  @Column('float')
  chocke_pressure?: number;

  @Column('float')
  oil?: number;

  @Column('float')
  gas?: number;

  @Column('float')
  water?: number;

  @Column('float')
  water_i?: number;

  @Column('string')
  FLOW_KIND?: string;

  @Column('float')
  hover_open?: number;

  @Column('float', { nullable: true })
  pressure_down?: number;
}
