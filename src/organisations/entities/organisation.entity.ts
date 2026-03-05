import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Sector } from '../dto/create-organisation.dto';
import { User } from '../../auth/entities/user.entity';
import { Form } from '../../forms/entities/form.entity';
import { Request } from '../../requests/entities/request.entity';

@Entity('organisations')
@Index(['adminEmail'], { unique: true })
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: Sector,
  })
  sector: Sector;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  adminEmail?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  logo?: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  registrationDate: Date;

  @OneToMany(() => User, (user) => user.organisation)
  users: User[];

  @OneToMany(() => Form, (form) => form.organisation)
  forms: Form[];

  @OneToMany(() => Request, (request) => request.organisation)
  requests: Request[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
