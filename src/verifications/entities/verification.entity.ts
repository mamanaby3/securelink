import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Sector } from '../../organisations/dto/create-organisation.dto';
import { User } from '../../auth/entities/user.entity';
import { Request } from '../../requests/entities/request.entity';

export enum VerificationStatus {
  EN_COURS = 'EN_COURS',
  VALIDE = 'VALIDE',
  REJETE = 'REJETE',
  A_VERIFIER = 'A_VERIFIER',
}

@Entity('verifications')
@Index(['clientId'])
@Index(['status'])
export class Verification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  documentId: string;

  @Column({ type: 'varchar', length: 255 })
  documentType: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'clientId' })
  client: User;

  @Column({ type: 'varchar', length: 255 })
  clientName: string;

  @Column({
    type: 'enum',
    enum: Sector,
  })
  sector: Sector;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.EN_COURS,
  })
  status: VerificationStatus;

  @Column({ type: 'int', default: 0 })
  score: number;

  @Column({ type: 'jsonb', nullable: true })
  aiResults?: {
    formatConforme: boolean;
    bonneLisibilite: boolean;
    coherenceInformations: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  humanVerification?: {
    verifiedBy: string;
    verifiedAt: Date;
    comments?: string;
    additionalInfoReasons?: string[]; // Raisons pour demande de complément
  };

  @Column({ type: 'uuid', nullable: true })
  requestId?: string;

  @ManyToOne(() => Request, { nullable: true })
  @JoinColumn({ name: 'requestId' })
  request?: Request;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  validatedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
