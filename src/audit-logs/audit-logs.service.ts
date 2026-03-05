import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, AuditStatus } from './entities/audit-log.entity';

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async create(createLogDto: {
    userId?: string;
    userName?: string;
    action: AuditAction;
    resource: string;
    ipAddress: string;
    status: AuditStatus;
    metadata?: any;
  }): Promise<AuditLog> {
    const log = this.auditLogRepository.create({
      userId: createLogDto.userId,
      userName: createLogDto.userName,
      action: createLogDto.action,
      resource: createLogDto.resource,
      ipAddress: createLogDto.ipAddress,
      status: createLogDto.status,
      metadata: createLogDto.metadata,
    });
    return this.auditLogRepository.save(log);
  }

  async findAll(): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      order: { timestamp: 'DESC' },
      take: 1000, // Limiter à 1000 logs pour les performances
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<AuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('audit_log')
      .where('audit_log.timestamp >= :startDate', { startDate })
      .andWhere('audit_log.timestamp <= :endDate', { endDate })
      .orderBy('audit_log.timestamp', 'DESC')
      .getMany();
  }

  async findByStatus(status: AuditStatus): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { status },
      order: { timestamp: 'DESC' },
      take: 1000,
    });
  }

  async export() {
    // En production, exporter vers CSV/Excel
    return this.findAll();
  }
}



