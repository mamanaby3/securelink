import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { FormType } from '../../forms/dto/create-form.dto';
import { Form } from '../../forms/entities/form.entity';
import { User } from '../../auth/entities/user.entity';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Verification } from '../../verifications/entities/verification.entity';

export enum RequestStatus {
  BROUILLON = 'BROUILLON', // Demande en cours de création (non soumise)
  EN_ATTENTE = 'EN_ATTENTE', // Demande soumise et vérifiée, en attente de traitement
  EN_COURS = 'EN_COURS',
  VALIDEE = 'VALIDEE',
  REJETEE = 'REJETEE',
}

export enum RequestTrackingStatus {
  SOUMISE = 'SOUMISE',
  EN_COURS = 'EN_COURS',
  VALIDATION_FINALE = 'VALIDATION_FINALE',
}

@Entity('requests')
@Index(['clientId'])
@Index(['organisationId'])
@Index(['status'])
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: true })
  requestNumber?: string; // Format: DEM-XXX (généré lors de la soumission, null pour les brouillons)

  @Column({ type: 'uuid', nullable: true })
  formId?: string;

  @ManyToOne(() => Form, (form) => form.requests, { nullable: true })
  @JoinColumn({ name: 'formId' })
  form?: Form;

  @Column({ type: 'varchar', length: 255, nullable: true })
  formName?: string;

  @Column({
    type: 'enum',
    enum: FormType,
    nullable: true,
  })
  formType?: FormType;

  @Column({ type: 'uuid' })
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'clientId' })
  client: User;

  @Column({ type: 'varchar', length: 255 })
  clientName: string;

  @Column({ type: 'uuid', nullable: true })
  organisationId?: string;

  @ManyToOne(() => Organisation, (org) => org.requests)
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column({ type: 'varchar', length: 255, nullable: true })
  organisationName?: string;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    default: RequestStatus.BROUILLON,
  })
  status: RequestStatus;

  @Column({ type: 'jsonb', nullable: true })
  beneficiary?: {
    name: string;
    email?: string;
    phone?: string;
    iban?: string;
    reference?: string;
  };

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount?: number;

  @Column({ type: 'jsonb', nullable: true })
  formData?: any;

  @Column({ type: 'jsonb', nullable: true })
  formSchemaSnapshot?: {
    formId: string;
    name: string;
    version: string;
    editableFields?: any[];
  };

  @Column({ type: 'jsonb', nullable: true })
  submittedForm?: {
    pdfUrl?: string;
    version: string;
  };

  @Column({ type: 'jsonb', default: '[]' })
  tracking: Array<{
    status: RequestTrackingStatus;
    date: Date;
    estimatedDate?: Date;
  }>;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date; // Date de soumission finale (après vérification OTP)

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  processedBy?: string; // ID de l'utilisateur qui a traité la demande (AGENT)

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'processedBy' })
  processor?: User;

  @Column({ type: 'uuid', nullable: true })
  validatedBy?: string; // ID de l'utilisateur qui a validé la demande (SUPERVISEUR)

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'validatedBy' })
  validator?: User;

  // Champs pour la vérification OTP après soumission
  @Column({ type: 'varchar', length: 6, nullable: true })
  otpCode?: string; // Code OTP de 6 chiffres

  @Column({ type: 'timestamp', nullable: true })
  otpExpiry?: Date; // Date d'expiration du code OTP

  @Column({ type: 'boolean', default: false })
  otpVerified: boolean; // Indique si le code OTP a été vérifié

  @Column({ type: 'varchar', length: 255, nullable: true })
  verificationEmail?: string; // Email utilisé pour l'envoi de l'OTP (peut être différent de l'email du client)

  @OneToMany(() => Verification, (verification) => verification.request)
  verifications: Verification[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
