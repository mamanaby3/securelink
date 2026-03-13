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
import { UserRole, UserType, OrganisationRole } from '../dto/register.dto';
import { Organisation } from '../../organisations/entities/organisation.entity';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    firstName?: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    lastName?: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email: string;

    @Column({ type: 'varchar', length: 255 })
    password: string;

    /** Numéro unique par compte (contrainte appliquée via migration UQ_users_phone). */
    @Column({ type: 'varchar', length: 50, nullable: true })
    phone?: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    address?: string;

    @Column({ type: 'date', nullable: true })
    dateOfBirth?: Date;

    @Column({ type: 'varchar', length: 20, nullable: true })
    gender?: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    maritalStatus?: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.CLIENT,
    })
    role: UserRole;

    @Column({
        type: 'enum',
        enum: UserType,
        nullable: true,
    })
    type?: UserType;

    @Column({ type: 'uuid', nullable: true })
    organisationId?: string;

    @Column({
        type: 'enum',
        enum: OrganisationRole,
        nullable: true,
    })
    organisationRole?: OrganisationRole;

    @ManyToOne(() => Organisation, { nullable: true })
    @JoinColumn({ name: 'organisationId' })
    organisation?: Organisation;

    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    @Column({ type: 'boolean', default: false })
    isEmailVerified: boolean;

    @Column({ type: 'timestamp', nullable: true })
    lastLogin?: Date;

    @Column({ type: 'text', nullable: true })
    refreshToken?: string;

    @Column({ type: 'timestamp', nullable: true })
    refreshTokenExpiry?: Date;

    @Column({ type: 'varchar', length: 500, nullable: true })
    profilePicture?: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    passwordSetupToken?: string;

    @Column({ type: 'timestamp', nullable: true })
    passwordSetupTokenExpiry?: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
