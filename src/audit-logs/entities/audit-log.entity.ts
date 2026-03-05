import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum AuditAction {
  CONNEXION_REUSSIE = 'CONNEXION_RÉUSSIE',
  CONNEXION_ECHOUEE = 'LA CONNEXION A ÉCHOUÉ',
  VOIR_DOCUMENT = 'VOIR_DOCUMENT',
  POLITIQUE_MISE_A_JOUR = 'POLITIQUE DE MISE À JOUR',
  CREER_DEMANDE = 'CREER_DEMANDE',
  VALIDER_DEMANDE = 'VALIDER_DEMANDE',
  REJETER_DEMANDE = 'REJETER_DEMANDE',
  CREER_FORMULAIRE = 'CREER_FORMULAIRE',
  MODIFIER_FORMULAIRE = 'MODIFIER_FORMULAIRE',
  CREER_UTILISATEUR = 'CREER_UTILISATEUR',
  MODIFIER_UTILISATEUR = 'MODIFIER_UTILISATEUR',
}

export enum AuditStatus {
  SUCCES = 'SUCCES',
  ECHEC = 'ÉCHEC',
}

@Entity('audit_logs')
@Index(['timestamp'])
@Index(['userId'])
@Index(['status'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'uuid', nullable: true })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userName?: string;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'varchar', length: 255 })
  resource: string;

  @Column({ type: 'varchar', length: 50 })
  ipAddress: string;

  @Column({
    type: 'enum',
    enum: AuditStatus,
  })
  status: AuditStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  createdAt: Date;
}
