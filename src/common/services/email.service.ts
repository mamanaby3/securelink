import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('EMAIL_PORT', 587);
    const user = this.configService.get<string>('EMAIL_USER');
    const password = this.configService.get<string>('EMAIL_PASSWORD');

    if (!user || !password) {
      this.logger.warn('EMAIL_USER ou EMAIL_PASSWORD non configurés. L\'envoi d\'emails sera désactivé.');
      return;
    }

    // Configuration pour Gmail
    // Port 587 : STARTTLS (secure: false, requireTLS: true)
    // Port 465 : SSL/TLS direct (secure: true)
    const isSecurePort = port === 465;
    
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecurePort, // true pour 465, false pour 587
      auth: {
        user,
        pass: password,
      },
      // Configuration TLS
      tls: {
        rejectUnauthorized: false, // Accepter les certificats (pour développement)
      },
      // Pour le port 587, utiliser STARTTLS
      ...(!isSecurePort && {
        requireTLS: true,
        connectionTimeout: 5000, // Timeout de connexion
      }),
    });

    // Vérifier la connexion
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('Connexion SMTP vérifiée avec succès');
    } catch (error) {
      this.logger.error('Erreur de connexion SMTP:', error);
    }
  }

  async sendOtpEmail(to: string, otp: string, userName?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      console.log(`[DEV] Code OTP pour ${to}: ${otp}`);
      return;
    }

    const subject = 'Code de réinitialisation de mot de passe - Secure Link';
    const html = this.getOtpEmailTemplate(otp, userName);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Votre code de réinitialisation de mot de passe est : ${otp}. Ce code expire dans 10 minutes.`,
      });

      this.logger.log(`Email OTP envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email OTP à ${to}:`, error);
      // En cas d'erreur, logger le code pour le développement
      console.log(`[DEV] Code OTP pour ${to}: ${otp}`);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }
  }

  async sendRequestOtpEmail(to: string, otp: string, requestNumber: string, userName?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      console.log(`[DEV] Code OTP de demande pour ${to}: ${otp}`);
      return;
    }

    const subject = `Code de vérification - Demande ${requestNumber} - Secure Link`;
    const html = this.getRequestOtpEmailTemplate(otp, requestNumber, userName);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Votre code de vérification pour la demande ${requestNumber} est : ${otp}. Ce code expire dans 10 minutes.`,
      });

      this.logger.log(`Email OTP de demande envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email OTP de demande à ${to}:`, error);
      console.log(`[DEV] Code OTP de demande pour ${to}: ${otp}`);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }
  }

  async sendPasswordResetEmail(to: string, userName: string, temporaryPassword: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      console.log(`[DEV] Mot de passe temporaire pour ${to}: ${temporaryPassword}`);
      return;
    }

    const subject = 'Votre mot de passe temporaire - Secure Link';
    const html = this.getTemporaryPasswordEmailTemplate(userName, temporaryPassword);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre mot de passe temporaire est : ${temporaryPassword}\n\nVeuillez changer ce mot de passe lors de votre première connexion.`,
      });

      this.logger.log(`Email de mot de passe temporaire envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
      console.log(`[DEV] Mot de passe temporaire pour ${to}: ${temporaryPassword}`);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }
  }

  private getOtpEmailTemplate(otp: string, userName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code de réinitialisation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Secure Link</h1>
    
    <h2>Réinitialisation de mot de passe</h2>
    
    ${userName ? `<p>Bonjour <strong>${userName}</strong>,</p>` : '<p>Bonjour,</p>'}
    
    <p>Vous avez demandé la réinitialisation de votre mot de passe. Utilisez le code suivant pour continuer :</p>
    
    <div style="padding: 20px; text-align: center; margin: 30px 0; border: 1px solid #000;">
        <p style="margin: 0; font-size: 14px;">Code OTP</p>
        <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; font-family: monospace;">${otp}</p>
    </div>
    
    <p><strong>Ce code expire dans 10 minutes.</strong></p>
    
    <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email. Votre mot de passe restera inchangé.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  async sendOrganisationAdminWelcomeEmail(
    to: string,
    userName: string,
    organisationName: string,
    sector: string,
    temporaryPassword: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      console.log(`[DEV] Détails de connexion pour ${to}: Email: ${to}, Mot de passe: ${temporaryPassword}`);
      return;
    }

    const subject = `Bienvenue - Votre compte administrateur pour ${organisationName} - Secure Link`;
    const html = this.getOrganisationAdminWelcomeTemplate(userName, organisationName, sector, temporaryPassword, to);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre organisation "${organisationName}" a été créée avec succès sur Secure Link.\n\nDétails de connexion :\nEmail : ${to}\nMot de passe temporaire : ${temporaryPassword}\n\nVeuillez changer ce mot de passe lors de votre première connexion.\n\nSecteur : ${sector}\n\nBienvenue sur Secure Link !`,
      });

      this.logger.log(`Email de bienvenue organisation envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
      console.log(`[DEV] Détails de connexion pour ${to}: Email: ${to}, Mot de passe: ${temporaryPassword}`);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }
  }

  private getTemporaryPasswordEmailTemplate(userName: string, temporaryPassword: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mot de passe temporaire</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Secure Link</h1>
    
    <h2>Bienvenue sur Secure Link</h2>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p>Votre compte a été créé avec succès. Voici votre mot de passe temporaire :</p>
    
    <div style="padding: 20px; text-align: center; margin: 30px 0; border: 1px solid #000;">
        <p style="margin: 0; font-size: 14px;">Mot de passe temporaire</p>
        <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; font-family: monospace;">${temporaryPassword}</p>
    </div>
    
    <p><strong>Pour votre sécurité, veuillez changer ce mot de passe lors de votre première connexion.</strong></p>
    
    <p><strong>Conseil de sécurité :</strong> Ne partagez jamais votre mot de passe avec qui que ce soit.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  // ========== MÉTHODES DE NOTIFICATIONS ==========

  async sendDocumentValidatedEmail(to: string, userName: string, documentType: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      return;
    }

    const subject = `Document validé - ${documentType} - Secure Link`;
    const html = this.getDocumentValidatedTemplate(userName, documentType);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre document "${documentType}" a été validé avec succès.\n\nVous pouvez maintenant utiliser ce document pour vos demandes.`,
      });

      this.logger.log(`Email de document validé envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }

  async sendDocumentRejectedEmail(to: string, userName: string, documentType: string, reason?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      return;
    }

    const subject = `Document rejeté - ${documentType} - Secure Link`;
    const html = this.getDocumentRejectedTemplate(userName, documentType, reason);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre document "${documentType}" a été rejeté.${reason ? `\n\nRaison : ${reason}` : ''}\n\nVeuillez télécharger un nouveau document.`,
      });

      this.logger.log(`Email de document rejeté envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }

  async sendRequestValidatedEmail(to: string, userName: string, requestNumber: string, requestType?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      return;
    }

    const subject = `Demande validée - ${requestNumber} - Secure Link`;
    const html = this.getRequestValidatedTemplate(userName, requestNumber, requestType);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre demande ${requestNumber}${requestType ? ` (${requestType})` : ''} a été validée avec succès.\n\nNous traiterons votre demande dans les plus brefs délais.`,
      });

      this.logger.log(`Email de demande validée envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }

  async sendRequestRejectedEmail(to: string, userName: string, requestNumber: string, reason: string, requestType?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      return;
    }

    const subject = `Demande rejetée - ${requestNumber} - Secure Link`;
    const html = this.getRequestRejectedTemplate(userName, requestNumber, reason, requestType);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre demande ${requestNumber}${requestType ? ` (${requestType})` : ''} a été rejetée.\n\nRaison : ${reason}\n\nPour plus d'informations, veuillez nous contacter.`,
      });

      this.logger.log(`Email de demande rejetée envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }

  async sendDocumentExpiringEmail(to: string, userName: string, documentType: string, daysUntilExpiration: number): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      return;
    }

    const subject = `⚠️ Document expirant bientôt - ${documentType} - Secure Link`;
    const html = this.getDocumentExpiringTemplate(userName, documentType, daysUntilExpiration);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre document "${documentType}" expire dans ${daysUntilExpiration} jour${daysUntilExpiration > 1 ? 's' : ''}.\n\nVeuillez le renouveler dès maintenant pour éviter toute interruption de service.`,
      });

      this.logger.log(`Email de document expirant envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }

  async sendDocumentExpiredEmail(to: string, userName: string, documentType: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      return;
    }

    const subject = `Document expiré - ${documentType} - Secure Link`;
    const html = this.getDocumentExpiredTemplate(userName, documentType);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nVotre document "${documentType}" a expiré.\n\nVeuillez télécharger un nouveau document dès maintenant pour éviter toute interruption de service.`,
      });

      this.logger.log(`Email de document expiré envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }

  async sendAdditionalDocumentsRequestEmail(to: string, userName: string, requestNumber: string, documents: string[], message?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      return;
    }

    const subject = `Documents supplémentaires requis - ${requestNumber} - Secure Link`;
    const html = this.getAdditionalDocumentsRequestTemplate(userName, requestNumber, documents, message);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `Bonjour ${userName},\n\nDes documents supplémentaires sont requis pour votre demande ${requestNumber}.\n\nDocuments requis :\n${documents.map(d => `- ${d}`).join('\n')}${message ? `\n\nMessage : ${message}` : ''}\n\nVeuillez télécharger ces documents dans les plus brefs délais.`,
      });

      this.logger.log(`Email de demande de documents supplémentaires envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
    }
  }

  // ========== TEMPLATES HTML ==========

  private getDocumentValidatedTemplate(userName: string, documentType: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document validé</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Document validé</h1>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p><strong>Votre document "${documentType}" a été validé avec succès !</strong></p>
    
    <p>Vous pouvez maintenant utiliser ce document pour vos demandes sur la plateforme Secure Link.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  private getDocumentRejectedTemplate(userName: string, documentType: string, reason?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document rejeté</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Document rejeté</h1>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p><strong>Votre document "${documentType}" a été rejeté.</strong></p>
    
    ${reason ? `<p><strong>Raison :</strong> ${reason}</p>` : ''}
    
    <p>Veuillez télécharger un nouveau document conforme aux exigences.</p>
    
    <p><strong>Conseil :</strong> Assurez-vous que le document est lisible, non expiré et conforme aux exigences.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  private getRequestValidatedTemplate(userName: string, requestNumber: string, requestType?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demande validée</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Demande validée</h1>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p><strong>Votre demande ${requestNumber}${requestType ? ` (${requestType})` : ''} a été validée avec succès !</strong></p>
    
    <p>Nous traiterons votre demande dans les plus brefs délais. Vous recevrez une notification une fois le traitement terminé.</p>
    
    <p><strong>Numéro de demande :</strong> ${requestNumber}</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  private getRequestRejectedTemplate(userName: string, requestNumber: string, reason: string, requestType?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demande rejetée</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Demande rejetée</h1>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p><strong>Votre demande ${requestNumber}${requestType ? ` (${requestType})` : ''} a été rejetée.</strong></p>
    
    <p><strong>Raison du rejet :</strong></p>
    <p>${reason}</p>
    
    <p>Pour plus d'informations ou pour soumettre une nouvelle demande, veuillez nous contacter.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  private getDocumentExpiringTemplate(userName: string, documentType: string, daysUntilExpiration: number): string {
    const isUrgent = daysUntilExpiration <= 7;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document expirant</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Document expirant</h1>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p><strong>Votre document "${documentType}" expire dans ${daysUntilExpiration} jour${daysUntilExpiration > 1 ? 's' : ''} !</strong></p>
    
    <p>Pour éviter toute interruption de service, veuillez renouveler ce document dès maintenant.</p>
    
    <p><strong>Type de document :</strong> ${documentType}</p>
    <p><strong>Jours restants :</strong> ${daysUntilExpiration} jour${daysUntilExpiration > 1 ? 's' : ''}</p>
    
    ${isUrgent ? '<p><strong>Action urgente requise !</strong></p>' : ''}
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  private getAdditionalDocumentsRequestTemplate(userName: string, requestNumber: string, documents: string[], message?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documents supplémentaires requis</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Documents requis</h1>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p><strong>Des documents supplémentaires sont requis pour votre demande ${requestNumber}.</strong></p>
    
    <p>Pour continuer le traitement de votre demande, veuillez télécharger les documents suivants :</p>
    
    <p><strong>Documents requis :</strong></p>
    <ul>
        ${documents.map(doc => `<li>${doc}</li>`).join('')}
    </ul>
    
    ${message ? `<p><strong>Message :</strong><br>${message}</p>` : ''}
    
    <p>Veuillez télécharger ces documents dans les plus brefs délais pour éviter tout retard dans le traitement de votre demande.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  private getOrganisationAdminWelcomeTemplate(
    userName: string,
    organisationName: string,
    sector: string,
    temporaryPassword: string,
    email: string,
  ): string {
    const sectorLabels: Record<string, string> = {
      BANQUE: 'Banque',
      NOTAIRE: 'Notaire',
      ASSURANCE: 'Assurance',
      HUISSIER: 'Huissier',
    };

    const sectorLabel = sectorLabels[sector] || sector;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenue - Compte administrateur</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Bienvenue sur Secure Link</h1>
    
    <h2>Votre organisation a été créée !</h2>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p>Votre organisation <strong>"${organisationName}"</strong> a été créée avec succès sur la plateforme Secure Link.</p>
    
    <p><strong>Informations de votre organisation :</strong></p>
    <p><strong>Nom :</strong> ${organisationName}</p>
    <p><strong>Secteur :</strong> ${sectorLabel}</p>
    
    <p><strong>Vos identifiants de connexion</strong></p>
    <div style="padding: 15px; margin: 20px 0; border: 1px solid #000;">
        <p><strong>Email :</strong> <span style="font-family: monospace;">${email}</span></p>
        <p><strong>Mot de passe temporaire :</strong> <span style="font-family: monospace; font-weight: bold; font-size: 16px;">${temporaryPassword}</span></p>
    </div>
    
    <p><strong>Important :</strong> Pour votre sécurité, veuillez changer ce mot de passe lors de votre première connexion.</p>
    
    <p><strong>Prochaines étapes :</strong></p>
    <p>1. Connectez-vous avec vos identifiants</p>
    <p>2. Changez votre mot de passe</p>
    <p>3. Commencez à gérer votre organisation</p>
    
    <p><strong>Rôle :</strong> Vous êtes administrateur de votre organisation avec tous les droits de gestion.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.<br>
        Si vous avez des questions, contactez le support Secure Link.
    </p>
</body>
</html>
    `;
  }

  private getRequestOtpEmailTemplate(otp: string, requestNumber: string, userName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code de vérification de demande</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Secure Link</h1>
    
    <h2>Vérification de votre demande</h2>
    
    ${userName ? `<p>Bonjour <strong>${userName}</strong>,</p>` : '<p>Bonjour,</p>'}
    
    <p>Votre demande <strong>${requestNumber}</strong> a été soumise avec succès. Pour finaliser la soumission, veuillez utiliser le code de vérification suivant :</p>
    
    <div style="padding: 20px; text-align: center; margin: 30px 0; border: 1px solid #000;">
        <p style="margin: 0; font-size: 14px;">Code de vérification</p>
        <p style="margin: 10px 0 0 0; font-size: 36px; font-weight: bold; font-family: monospace; letter-spacing: 8px;">${otp}</p>
    </div>
    
    <p><strong>Ce code expire dans 10 minutes.</strong></p>
    
    <p>Si vous n'avez pas soumis cette demande, veuillez ignorer cet email ou contacter le support.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement par Secure Link. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  private getDocumentExpiredTemplate(userName: string, documentType: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document expiré</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Document expiré</h1>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p><strong>Votre document "${documentType}" a expiré.</strong></p>
    
    <p>Votre document n'est plus valide et ne peut plus être utilisé pour vos demandes. Pour éviter toute interruption de service, veuillez télécharger un nouveau document dès maintenant.</p>
    
    <p><strong>Action requise :</strong> Connectez-vous à votre compte et téléchargez un nouveau document de type "${documentType}".</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }

  async sendPasswordSetupEmail(
    to: string,
    userName: string,
    setupLink: string,
    setupLinkMobile?: string | null,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      console.log(`[DEV] Lien de création de mot de passe pour ${to}: ${setupLink}`);
      if (setupLinkMobile) console.log(`[DEV] Lien mobile (deeplink) pour ${to}: ${setupLinkMobile}`);
      return;
    }

    const subject = 'Créez votre mot de passe - Secure Link';
    const html = this.getPasswordSetupEmailTemplate(userName, setupLink, setupLinkMobile ?? undefined);

    const textParts = [
      `Bonjour ${userName},`,
      '',
      'Votre inscription sur Secure Link a été validée. Pour finaliser votre compte, veuillez créer votre mot de passe :',
      '',
      'Sur ordinateur (navigateur) :',
      setupLink,
      '',
    ];
    if (setupLinkMobile) {
      textParts.push('Sur l\'app mobile (deeplink) :');
      textParts.push(setupLinkMobile);
      textParts.push('');
    }
    textParts.push('Ce lien expire dans 24 heures.', '', "Si vous n'avez pas demandé cette inscription, veuillez ignorer cet email.");
    const text = textParts.join('\n');

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text,
      });

      this.logger.log(`Email de création de mot de passe envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${to}:`, error);
      console.log(`[DEV] Lien de création de mot de passe pour ${to}: ${setupLink}`);
      if (setupLinkMobile) console.log(`[DEV] Lien mobile pour ${to}: ${setupLinkMobile}`);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }
  }

  async sendRegistrationOtpEmail(to: string, otp: string, userName?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter email non initialisé. Email non envoyé.');
      console.log(`[DEV] Code OTP d'inscription pour ${to}: ${otp}`);
      return;
    }

    const subject = 'Code de vérification - Inscription Secure Link';
    const html = this.getRegistrationOtpEmailTemplate(otp, userName);

    try {
      const info = await this.transporter.sendMail({
        from: `"Secure Link" <${this.configService.get<string>('EMAIL_USER')}>`,
        to,
        subject,
        html,
        text: `${userName ? `Bonjour ${userName},\n\n` : 'Bonjour,\n\n'}Votre code de vérification pour finaliser votre inscription sur Secure Link est : ${otp}\n\nCe code expire dans 10 minutes.`,
      });

      this.logger.log(`Email OTP d'inscription envoyé à ${to}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email OTP à ${to}:`, error);
      console.log(`[DEV] Code OTP d'inscription pour ${to}: ${otp}`);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }
  }

  private getPasswordSetupEmailTemplate(
    userName: string,
    setupLink: string,
    setupLinkMobile?: string,
  ): string {
    const mobileSection = setupLinkMobile
      ? `
    <p><strong>Sur l'app mobile</strong>, utilisez ce lien (ouvre l'app Secure Link) :</p>
    <p style="word-break: break-all; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #000;">${setupLinkMobile}</p>
`
      : '';
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Créez votre mot de passe</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Secure Link</h1>
    
    <h2>Créez votre mot de passe</h2>
    
    <p>Bonjour <strong>${userName}</strong>,</p>
    
    <p>Votre inscription sur Secure Link a été validée avec succès. Pour finaliser votre compte, créez votre mot de passe :</p>
    
    <p><strong>Sur ordinateur (navigateur)</strong> :</p>
    <div style="text-align: center; margin: 20px 0;">
        <a href="${setupLink}" style="display: inline-block; padding: 15px 30px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Créer mon mot de passe</a>
    </div>
    <p style="word-break: break-all; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #000;">${setupLink}</p>
    ${mobileSection}
    <p><strong>Ce lien expire dans 24 heures.</strong></p>
    
    <p>Si vous n'avez pas demandé cette inscription, veuillez ignorer cet email.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.<br>
        Si vous avez des questions, contactez le support Secure Link.
    </p>
</body>
</html>
    `;
  }

  private getRegistrationOtpEmailTemplate(otp: string, userName?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code de vérification - Inscription</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #000; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h1>Secure Link</h1>
    
    <h2>Code de vérification</h2>
    
    ${userName ? `<p>Bonjour <strong>${userName}</strong>,</p>` : '<p>Bonjour,</p>'}
    
    <p>Pour finaliser votre inscription sur Secure Link, veuillez utiliser le code de vérification suivant :</p>
    
    <div style="padding: 20px; text-align: center; margin: 30px 0; border: 1px solid #000;">
        <p style="margin: 0; font-size: 14px;">Code de vérification</p>
        <p style="margin: 10px 0 0 0; font-size: 36px; font-weight: bold; font-family: monospace; letter-spacing: 8px;">${otp}</p>
    </div>
    
    <p><strong>Ce code expire dans 10 minutes.</strong></p>
    
    <p>Si vous n'avez pas demandé cette inscription, veuillez ignorer cet email.</p>
    
    <hr style="border: none; border-top: 1px solid #000; margin: 30px 0;">
    
    <p style="font-size: 12px; text-align: center; margin: 0;">
        Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
    </p>
</body>
</html>
    `;
  }
}

