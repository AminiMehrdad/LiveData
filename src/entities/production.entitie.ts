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
  down_temperature?: number;

  @Column('float', { nullable: true })
  choke_size?: number;

  @Column('float', { nullable: true })
  head_pressure?: number;

  @Column('float', { nullable: true })
  head_tempereture?: number;

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
  flow?: string;

  @Column('float', { nullable: true })
  work_time?: number;

  @Column('float', { nullable: true })
  down_pressure?: number;
}
