import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Well } from './well.entitie';

@Entity()
@Index(['well', 'date']) // important for ordering & fast queries
export class ProductionData {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Well, { onDelete: 'CASCADE' })
  well: Well;

  @Column('timestamp')
  date: Date;

  @Column('float', { nullable: true })
  temperature_down?: number;

  @Column('float', { nullable: true })
  chock_size?: number;

  @Column('float', { nullable: true })
  pressure_top?: number;

  @Column('float', { nullable: true })
  temprature_top?: number;

  @Column('float', { nullable: true })
  chocke_pressure?: number;

  @Column('float', { nullable: true })
  oil?: number;

  @Column('float', { nullable: true })
  gas?: number;

  @Column('float', { nullable: true })
  water?: number;

  @Column('float', { nullable: true })
  water_i?: number;

  @Column('varchar', { nullable: true })
  FLOW_KIND?: string;

  @Column('float', { nullable: true })
  hover_open?: number;

  @Column('float', { nullable: true })
  pressure_down?: number;
}
