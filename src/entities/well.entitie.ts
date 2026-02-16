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

  @Column({ nullable: true })
  lat?: string;

  @Column({ nullable: true })
  lng?: string;

  @Column({ nullable: true })
  drilingcost?: string;

  @CreateDateColumn()
  createdAt: Date;
}
