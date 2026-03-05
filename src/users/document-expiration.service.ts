import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserDocument, DocumentStatus, DocumentType } from './entities/user-document.entity';
import { User } from '../auth/entities/user.entity';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class DocumentExpirationService {
  private readonly logger = new Logger(DocumentExpirationService.name);

  constructor(
    @InjectRepository(UserDocument)
    private userDocumentRepository: Repository<UserDocument>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
  ) {}

  /**
   * Tâche cron qui s'exécute tous les jours à minuit pour vérifier et marquer les documents expirés
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredDocuments(): Promise<void> {
    this.logger.log('Début de la vérification des documents expirés...');

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Début de la journée

    // Récupérer tous les documents valides qui ont une date d'expiration passée ou égale à aujourd'hui
    const expiredDocuments = await this.userDocumentRepository.find({
      where: {
        status: DocumentStatus.VALIDE,
        expirationDate: LessThanOrEqual(today),
      },
      relations: ['user'],
    });

    if (expiredDocuments.length === 0) {
      this.logger.log('Aucun document expiré trouvé.');
      return;
    }

    this.logger.log(`${expiredDocuments.length} document(s) expiré(s) trouvé(s).`);

    let successCount = 0;
    let errorCount = 0;

    for (const doc of expiredDocuments) {
      try {
        // Marquer le document comme rejeté avec la raison d'expiration
        doc.status = DocumentStatus.REJETE;
        doc.rejectionReason = 'Document expiré. Veuillez télécharger un nouveau document.';
        doc.isVerified = false;

        await this.userDocumentRepository.save(doc);

        // Envoyer un email de notification à l'utilisateur
        if (doc.user) {
          try {
            await this.emailService.sendDocumentExpiredEmail(
              doc.user.email,
              doc.user.name,
              this.getDocumentLabel(doc.type),
            );
          } catch (emailError) {
            this.logger.error(
              `Erreur lors de l'envoi de l'email d'expiration pour le document ${doc.id}:`,
              emailError,
            );
            // Ne pas faire échouer le processus si l'email échoue
          }
        }

        successCount++;
        this.logger.log(`Document ${doc.id} (${doc.type}) marqué comme expiré pour l'utilisateur ${doc.userId}`);
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Erreur lors du traitement du document expiré ${doc.id}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Vérification terminée : ${successCount} document(s) traité(s) avec succès, ${errorCount} erreur(s).`,
    );
  }

  /**
   * Méthode utilitaire pour obtenir le label d'un type de document
   */
  private getDocumentLabel(type: DocumentType): string {
    const labels: Record<DocumentType, string> = {
      [DocumentType.CARTE_IDENTITE]: 'Carte d\'identité',
      [DocumentType.CERTIFICAT_NATIONALITE]: 'Certificat de nationalité',
      [DocumentType.EXTRAIT_NAISSANCE]: 'Extrait de naissance',
      [DocumentType.AUTRE]: 'Document',
    };
    return labels[type] || type;
  }
}

