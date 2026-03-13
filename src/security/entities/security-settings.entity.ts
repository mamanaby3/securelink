import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('security_settings')
export class SecuritySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', default: 15 })
  sessionExpirationMinutes: number; // Durée d'expiration de session en minutes (par défaut 15)

  @Column({ type: 'int', default: 5 })
  maxLoginAttempts: number; // Nombre maximum de tentatives de connexion (par défaut 5)

  @Column({ type: 'int', default: 15 })
  lockoutDurationMinutes: number; // Durée de verrouillage en minutes après échecs (par défaut 15)

  @Column({ type: 'boolean', default: true })
  requireEmailVerification: boolean; // Exiger la vérification d'email

  @Column({ type: 'boolean', default: true })
  requireDocumentsForRegistration: boolean; // Exiger des documents pour compléter l'inscription

  @Column({ type: 'jsonb', default: '[]' })
  requiredDocumentsForRegistration: string[]; // IDs des DocumentType requis pour l'inscription

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}









