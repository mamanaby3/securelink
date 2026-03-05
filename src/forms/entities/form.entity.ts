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
import { Sector } from '../../organisations/dto/create-organisation.dto';
import { FormType } from '../dto/create-form.dto';
import { Organisation } from '../../organisations/entities/organisation.entity';
import { Request } from '../../requests/entities/request.entity';

export enum FormStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  DRAFT = 'DRAFT',
}

@Entity('forms')
@Index(['organisationId'])
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: Sector,
  })
  sector: Sector;

  @Column({
    type: 'enum',
    enum: FormType,
  })
  formType: FormType;

  @Column({ type: 'uuid' })
  organisationId: string;

  @ManyToOne(() => Organisation, (org) => org.forms)
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @Column({ type: 'text', nullable: true })
  pdfTemplate?: string; // URL du template PDF (optionnel, le fichier est stocké sur disque via pdfFilePath)

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfFilePath?: string; // Chemin du fichier PDF stocké sur le serveur

  @Column({ type: 'varchar', length: 255, nullable: true })
  pdfFileName?: string; // Nom original du fichier PDF

  @Column({ type: 'jsonb', nullable: true })
  editableFields?: any[]; // Champs modifiables

  @Column({ type: 'jsonb', default: '[]' })
  requiredDocuments: string[]; // IDs des documents requis

  @Column({
    type: 'enum',
    enum: FormStatus,
    default: FormStatus.DRAFT,
  })
  status: FormStatus; // ONLINE/OFFLINE/DRAFT - Géré par l'organisation

  @Column({
    type: 'boolean',
    default: false,
  })
  isActive: boolean; // Actif/Inactif - Géré par l'admin

  @OneToMany(() => Request, (request) => request.form)
  requests: Request[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
