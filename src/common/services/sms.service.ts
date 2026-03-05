import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly smsUrl: string;
  private readonly accountId: string;
  private readonly password: string;
  private readonly sender: string;

  constructor(private configService: ConfigService) {
    this.smsUrl = this.configService.get<string>('LAM_SMS_URL');
    this.accountId = this.configService.get<string>('LAM_SMS_ACCOUNT_ID');
    this.password = this.configService.get<string>('LAM_SMS_PASSWORD');
    this.sender = this.configService.get<string>('LAM_SMS_SENDER');

    if (!this.smsUrl || !this.accountId || !this.password || !this.sender) {
      this.logger.warn('Configuration SMS manquante. L\'envoi de SMS ne fonctionnera pas.');
    }
  }

  /**
   * Envoie un SMS via LAM SMS
   * @param phoneNumber Numéro de téléphone du destinataire
   * @param message Message à envoyer
   */
  async sendSms(phoneNumber: string, message: string): Promise<void> {
    if (!this.smsUrl || !this.accountId || !this.password || !this.sender) {
      this.logger.warn('Configuration SMS manquante. SMS non envoyé.');
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`[DEV] SMS qui aurait été envoyé à ${phoneNumber}: ${message}`);
      }
      return;
    }

    // Nettoyer le numéro de téléphone (enlever les espaces, +, etc.)
    const cleanPhoneNumber = phoneNumber.replace(/[\s\+\-\(\)]/g, '');

    const requestBody = {
      accountid: this.accountId,
      password: this.password,
      sender: this.sender,
      text: message,
      to: cleanPhoneNumber,
    };

    try {
      const response = await axios.post(this.smsUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.logger.log(`📤 SMS envoyé à ${phoneNumber}. Réponse: ${JSON.stringify(response.data)}`);
    } catch (error) {
      this.logger.error(`❌ Erreur lors de l'envoi du SMS à ${phoneNumber}:`, error.message);
      if (process.env.NODE_ENV === 'development') {
        this.logger.log(`[DEV] SMS qui aurait été envoyé à ${phoneNumber}: ${message}`);
      }
      // Ne pas faire échouer la requête si l'envoi SMS échoue
    }
  }

  /**
   * Envoie un code OTP par SMS
   * @param phoneNumber Numéro de téléphone du destinataire
   * @param otpCode Code OTP à envoyer
   * @param requestNumber Numéro de demande (optionnel)
   */
  async sendOtpSms(phoneNumber: string, otpCode: string, requestNumber?: string): Promise<void> {
    let message = `Votre code de vérification Secure Link est : ${otpCode}`;
    
    if (requestNumber) {
      message = `Votre code de vérification pour la demande ${requestNumber} est : ${otpCode}. Ce code expire dans 10 minutes.`;
    } else {
      message = `Votre code de vérification Secure Link est : ${otpCode}. Ce code expire dans 10 minutes.`;
    }

    await this.sendSms(phoneNumber, message);
  }
}



