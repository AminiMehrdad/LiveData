import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Well {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  lat?: string;

  @Column()
  lng?: string;

  @Column()
  drilingcost?: string;

  @CreateDateColumn()
  createdAt: Date;
}
