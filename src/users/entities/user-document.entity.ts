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
import { User } from '../../auth/entities/user.entity';

export enum DocumentType {
  CARTE_IDENTITE = 'CARTE_IDENTITE',
  CERTIFICAT_NATIONALITE = 'CERTIFICAT_NATIONALITE',
  EXTRAIT_NAISSANCE = 'EXTRAIT_NAISSANCE',
  AUTRE = 'AUTRE',
}

export enum DocumentStatus {
  EN_ATTENTE = 'EN_ATTENTE',
  VALIDE = 'VALIDE',
  REJETE = 'REJETE',
  EN_VERIFICATION = 'EN_VERIFICATION',
}

@Entity('user_documents')
@Index(['userId', 'documentTypeId'], { unique: true })
export class UserDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  type: DocumentType;

  @Column({ type: 'uuid', nullable: true })
  documentTypeId?: string; // ID du DocumentType créé par l'admin

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 50 })
  fileSize: string;

  @Column({ type: 'varchar', length: 50 })
  mimeType: string;

  @Column({ type: 'date', nullable: true })
  issueDate?: Date;

  @Column({ type: 'date', nullable: true })
  expirationDate?: Date;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.EN_ATTENTE,
  })
  status: DocumentStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}



