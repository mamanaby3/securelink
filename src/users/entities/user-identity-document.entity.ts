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

/** Slot fixe pour la vérification d'identité (recto CNI, verso CNI, selfie). Ne fait pas partie des document_types. */
export enum IdentityDocumentKind {
  RECTO = 'RECTO',
  VERSO = 'VERSO',
  SELFIE = 'SELFIE',
}

@Entity('user_identity_documents')
@Index(['userId', 'kind'], { unique: true })
export class UserIdentityDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: IdentityDocumentKind,
  })
  kind: IdentityDocumentKind;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 500 })
  filePath: string;

  @Column({ type: 'varchar', length: 50 })
  fileSize: string;

  @Column({ type: 'varchar', length: 50 })
  mimeType: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
