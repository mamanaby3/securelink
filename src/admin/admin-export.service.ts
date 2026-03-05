import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';
import { Request, RequestStatus } from '../requests/entities/request.entity';
import { User } from '../auth/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Form } from '../forms/entities/form.entity';
import { UserDocument } from '../users/entities/user-document.entity';
import { UserRole } from '../auth/dto/register.dto';

@Injectable()
export class AdminExportService {
  constructor(
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organisation)
    private organisationRepository: Repository<Organisation>,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(UserDocument)
    private userDocumentRepository: Repository<UserDocument>,
  ) {}

  /**
   * Exporte les statistiques du dashboard en Excel
   */
  async exportDashboardToExcel(period?: 'month' | 'week' | 'all'): Promise<Buffer> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Tableau de bord');

    // Récupérer les dates selon la période
    const { startDate, endDate } = this.getDateRange(period);

    // Statistiques des demandes
    const requestStats = await this.getRequestStatistics(startDate, endDate);
    
    // Statistiques des utilisateurs
    const userStats = await this.getUserStatistics(startDate, endDate);
    
    // Statistiques des organisations
    const orgStats = await this.getOrganisationStatistics(startDate, endDate);

    // En-tête
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'SECURE LINK - Tableau de bord';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell('A2').value = `Période: ${this.getPeriodLabel(period)}`;
    worksheet.getCell('A2').font = { size: 12 };
    worksheet.getCell('A2').alignment = { horizontal: 'left' };

    // Section Statistiques des demandes
    let currentRow = 4;
    worksheet.getCell(`A${currentRow}`).value = 'STATISTIQUES DES DEMANDES';
    worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Total de demandes';
    worksheet.getCell(`B${currentRow}`).value = requestStats.total;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'En attente';
    worksheet.getCell(`B${currentRow}`).value = requestStats.pending;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'En cours';
    worksheet.getCell(`B${currentRow}`).value = requestStats.inProgress;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Validées';
    worksheet.getCell(`B${currentRow}`).value = requestStats.validated;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Rejetées';
    worksheet.getCell(`B${currentRow}`).value = requestStats.rejected;
    currentRow += 2;

    // Section Statistiques des utilisateurs
    worksheet.getCell(`A${currentRow}`).value = 'STATISTIQUES DES UTILISATEURS';
    worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Total utilisateurs';
    worksheet.getCell(`B${currentRow}`).value = userStats.total;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Clients';
    worksheet.getCell(`B${currentRow}`).value = userStats.clients;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Organisations';
    worksheet.getCell(`B${currentRow}`).value = userStats.organisations;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Utilisateurs actifs';
    worksheet.getCell(`B${currentRow}`).value = userStats.active;
    currentRow += 2;

    // Section Statistiques des organisations
    worksheet.getCell(`A${currentRow}`).value = 'STATISTIQUES DES ORGANISATIONS';
    worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Total organisations';
    worksheet.getCell(`B${currentRow}`).value = orgStats.total;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Organisations actives';
    worksheet.getCell(`B${currentRow}`).value = orgStats.active;
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = 'Organisations inactives';
    worksheet.getCell(`B${currentRow}`).value = orgStats.inactive;
    currentRow += 2;

    // Tableau des demandes récentes
    worksheet.getCell(`A${currentRow}`).value = 'DEMANDES RÉCENTES';
    worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
    currentRow++;

    const recentRequests = await this.getRecentRequests(startDate, endDate, 20);
    
    // En-têtes du tableau
    worksheet.getCell(`A${currentRow}`).value = 'N° Demande';
    worksheet.getCell(`B${currentRow}`).value = 'Client';
    worksheet.getCell(`C${currentRow}`).value = 'Type';
    worksheet.getCell(`D${currentRow}`).value = 'Date';
    worksheet.getCell(`E${currentRow}`).value = 'Statut';
    
    // Style des en-têtes
    ['A', 'B', 'C', 'D', 'E'].forEach(col => {
      const cell = worksheet.getCell(`${col}${currentRow}`);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667EEA' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });
    currentRow++;

    // Données
    recentRequests.forEach((req) => {
      worksheet.getCell(`A${currentRow}`).value = req.requestNumber || 'N/A';
      worksheet.getCell(`B${currentRow}`).value = req.clientName;
      worksheet.getCell(`C${currentRow}`).value = req.formName || 'N/A';
      worksheet.getCell(`D${currentRow}`).value = new Date(req.submittedAt || req.createdAt).toLocaleDateString('fr-FR');
      worksheet.getCell(`E${currentRow}`).value = req.status;
      currentRow++;
    });

    // Ajuster la largeur des colonnes
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    // Générer le buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exporte les statistiques du dashboard en PDF
   */
  async exportDashboardToPDF(period?: 'month' | 'week' | 'all'): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Récupérer les données
        const { startDate, endDate } = this.getDateRange(period);
        const requestStats = await this.getRequestStatistics(startDate, endDate);
        const userStats = await this.getUserStatistics(startDate, endDate);
        const orgStats = await this.getOrganisationStatistics(startDate, endDate);
        const recentRequests = await this.getRecentRequests(startDate, endDate, 10);

        // En-tête
        doc.fontSize(20).text('SECURE LINK', { align: 'center' });
        doc.moveDown();
        doc.fontSize(16).text('Tableau de bord', { align: 'center' });
        doc.fontSize(12).text(`Période: ${this.getPeriodLabel(period)}`, { align: 'center' });
        doc.moveDown(2);

        // Statistiques des demandes
        doc.fontSize(14).text('STATISTIQUES DES DEMANDES', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`Total de demandes: ${requestStats.total}`);
        doc.text(`En attente: ${requestStats.pending}`);
        doc.text(`En cours: ${requestStats.inProgress}`);
        doc.text(`Validées: ${requestStats.validated}`);
        doc.text(`Rejetées: ${requestStats.rejected}`);
        doc.moveDown();

        // Statistiques des utilisateurs
        doc.fontSize(14).text('STATISTIQUES DES UTILISATEURS', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`Total utilisateurs: ${userStats.total}`);
        doc.text(`Clients: ${userStats.clients}`);
        doc.text(`Organisations: ${userStats.organisations}`);
        doc.text(`Utilisateurs actifs: ${userStats.active}`);
        doc.moveDown();

        // Statistiques des organisations
        doc.fontSize(14).text('STATISTIQUES DES ORGANISATIONS', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        doc.text(`Total organisations: ${orgStats.total}`);
        doc.text(`Organisations actives: ${orgStats.active}`);
        doc.text(`Organisations inactives: ${orgStats.inactive}`);
        doc.moveDown();

        // Demandes récentes
        doc.fontSize(14).text('DEMANDES RÉCENTES', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);

        recentRequests.forEach((req, index) => {
          doc.text(
            `${req.requestNumber || 'N/A'} - ${req.clientName} - ${req.formName || 'N/A'} - ${req.status}`,
            { indent: 20 },
          );
          if (index < recentRequests.length - 1) {
            doc.moveDown(0.3);
          }
        });

        // Pied de page
        doc.fontSize(8).text(
          `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
          { align: 'center' },
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Exporte les demandes en Excel
   */
  async exportRequestsToExcel(
    status?: RequestStatus,
    startDate?: Date,
    endDate?: Date,
  ): Promise<Buffer> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Demandes');

    // Récupérer les demandes
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.client', 'client')
      .leftJoinAndSelect('request.organisation', 'organisation')
      .leftJoinAndSelect('request.form', 'form')
      .where(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('request.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const requests = await queryBuilder.orderBy('request.createdAt', 'DESC').getMany();

    // En-tête
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'LISTE DES DEMANDES';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // En-têtes du tableau
    const headerRow = 3;
    worksheet.getCell(`A${headerRow}`).value = 'N° Demande';
    worksheet.getCell(`B${headerRow}`).value = 'Client';
    worksheet.getCell(`C${headerRow}`).value = 'Organisation';
    worksheet.getCell(`D${headerRow}`).value = 'Type';
    worksheet.getCell(`E${headerRow}`).value = 'Date';
    worksheet.getCell(`F${headerRow}`).value = 'Statut';

    // Style des en-têtes
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = worksheet.getCell(`${col}${headerRow}`);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667EEA' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    // Données
    let currentRow = headerRow + 1;
    requests.forEach((req) => {
      worksheet.getCell(`A${currentRow}`).value = req.requestNumber || 'N/A';
      worksheet.getCell(`B${currentRow}`).value = req.client?.name || req.client?.email || req.clientName || 'N/A';
      worksheet.getCell(`C${currentRow}`).value = req.organisation?.name || req.organisationName || 'N/A';
      worksheet.getCell(`D${currentRow}`).value = req.form?.name || req.formName || 'N/A';
      worksheet.getCell(`E${currentRow}`).value = new Date(req.submittedAt || req.createdAt).toLocaleDateString('fr-FR');
      worksheet.getCell(`F${currentRow}`).value = req.status;
      currentRow++;
    });

    // Ajuster la largeur des colonnes
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exporte les utilisateurs en Excel
   */
  async exportUsersToExcel(role?: UserRole): Promise<Buffer> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Utilisateurs');

    const queryBuilder = this.userRepository.createQueryBuilder('user');
    if (role) {
      queryBuilder.where('user.role = :role', { role });
    }

    const users = await queryBuilder.orderBy('user.createdAt', 'DESC').getMany();

    // En-tête
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = 'LISTE DES UTILISATEURS';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // En-têtes
    const headerRow = 3;
    worksheet.getCell(`A${headerRow}`).value = 'Nom';
    worksheet.getCell(`B${headerRow}`).value = 'Email';
    worksheet.getCell(`C${headerRow}`).value = 'Rôle';
    worksheet.getCell(`D${headerRow}`).value = 'Statut';
    worksheet.getCell(`E${headerRow}`).value = 'Date création';

    ['A', 'B', 'C', 'D', 'E'].forEach((col) => {
      const cell = worksheet.getCell(`${col}${headerRow}`);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667EEA' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    // Données
    let currentRow = headerRow + 1;
    users.forEach((user) => {
      worksheet.getCell(`A${currentRow}`).value = user.name || `${user.firstName} ${user.lastName}`;
      worksheet.getCell(`B${currentRow}`).value = user.email;
      worksheet.getCell(`C${currentRow}`).value = user.role;
      worksheet.getCell(`D${currentRow}`).value = user.isActive ? 'Actif' : 'Inactif';
      worksheet.getCell(`E${currentRow}`).value = new Date(user.createdAt).toLocaleDateString('fr-FR');
      currentRow++;
    });

    worksheet.columns.forEach((column) => {
      column.width = 25;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Exporte les organisations en Excel
   */
  async exportOrganisationsToExcel(): Promise<Buffer> {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Organisations');

    const organisations = await this.organisationRepository.find({
      order: { createdAt: 'DESC' },
    });

    // En-tête
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'LISTE DES ORGANISATIONS';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // En-têtes
    const headerRow = 3;
    worksheet.getCell(`A${headerRow}`).value = 'Nom';
    worksheet.getCell(`B${headerRow}`).value = 'Secteur';
    worksheet.getCell(`C${headerRow}`).value = 'Email Admin';
    worksheet.getCell(`D${headerRow}`).value = 'Statut';

    ['A', 'B', 'C', 'D'].forEach((col) => {
      const cell = worksheet.getCell(`${col}${headerRow}`);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF667EEA' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    // Données
    let currentRow = headerRow + 1;
    organisations.forEach((org) => {
      worksheet.getCell(`A${currentRow}`).value = org.name;
      worksheet.getCell(`B${currentRow}`).value = org.sector;
      worksheet.getCell(`C${currentRow}`).value = org.adminEmail || 'N/A';
      worksheet.getCell(`D${currentRow}`).value = org.isActive ? 'Actif' : 'Inactif';
      currentRow++;
    });

    worksheet.columns.forEach((column) => {
      column.width = 25;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // Méthodes privées utilitaires
  private getDateRange(period?: 'month' | 'week' | 'all'): { startDate?: Date; endDate?: Date } {
    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'week') {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Lundi
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    return { startDate, endDate };
  }

  private getPeriodLabel(period?: 'month' | 'week' | 'all'): string {
    if (period === 'month') return 'Ce mois';
    if (period === 'week') return 'Cette semaine';
    return 'Toutes les périodes';
  }

  private async getRequestStatistics(startDate?: Date, endDate?: Date) {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .where(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );

    if (startDate && endDate) {
      queryBuilder.andWhere('request.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const [total, pending, inProgress, validated, rejected] = await Promise.all([
      queryBuilder.getCount(),
      this.requestRepository.count({
        where: {
          status: RequestStatus.EN_ATTENTE,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
      this.requestRepository.count({
        where: {
          status: RequestStatus.EN_COURS,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
      this.requestRepository.count({
        where: {
          status: RequestStatus.VALIDEE,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
      this.requestRepository.count({
        where: {
          status: RequestStatus.REJETEE,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
    ]);

    return { total, pending, inProgress, validated, rejected };
  }

  private async getUserStatistics(startDate?: Date, endDate?: Date) {
    const baseWhere = startDate && endDate
      ? { createdAt: Between(startDate, endDate) }
      : {};

    const [total, clients, organisations, active] = await Promise.all([
      this.userRepository.count({ where: baseWhere }),
      this.userRepository.count({ 
        where: { 
          role: UserRole.CLIENT,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
      this.userRepository.count({ 
        where: { 
          role: UserRole.ORGANISATION,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
      this.userRepository.count({ 
        where: { 
          isActive: true,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
    ]);

    return { total, clients, organisations, active };
  }

  private async getOrganisationStatistics(startDate?: Date, endDate?: Date) {
    const baseWhere = startDate && endDate
      ? { createdAt: Between(startDate, endDate) }
      : {};

    const [total, active, inactive] = await Promise.all([
      this.organisationRepository.count({ where: baseWhere }),
      this.organisationRepository.count({ 
        where: { 
          isActive: true,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
      this.organisationRepository.count({ 
        where: { 
          isActive: false,
          ...(startDate && endDate ? { createdAt: Between(startDate, endDate) } : {}),
        },
      }),
    ]);

    return { total, active, inactive };
  }

  private async getRecentRequests(startDate?: Date, endDate?: Date, limit: number = 10) {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.client', 'client')
      .leftJoinAndSelect('request.form', 'form')
      .where(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );

    if (startDate && endDate) {
      queryBuilder.andWhere('request.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const requests = await queryBuilder
      .orderBy('request.submittedAt', 'DESC')
      .addOrderBy('request.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    // Mapper les résultats pour inclure les noms
    return requests.map((req) => ({
      ...req,
      clientName: req.client?.name || req.client?.email || 'N/A',
      formName: req.form?.name || req.formName || 'N/A',
    }));
  }
}

