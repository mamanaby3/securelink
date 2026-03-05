import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecuritySettings } from './entities/security-settings.entity';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';

@Injectable()
export class SecurityService implements OnModuleInit {
  constructor(
    @InjectRepository(SecuritySettings)
    private securitySettingsRepository: Repository<SecuritySettings>,
  ) {}

  async onModuleInit() {
    // Initialiser les paramètres par défaut s'ils n'existent pas
    // Cette méthode est appelée après que tous les modules soient chargés
    await this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    const settings = await this.securitySettingsRepository.findOne({
      where: {},
    });

    if (!settings) {
      const defaultSettings = this.securitySettingsRepository.create({
        sessionExpirationMinutes: 15,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15,
        requireEmailVerification: true,
        requireDocumentsForRegistration: true,
        requiredDocumentsForRegistration: [],
      });
      await this.securitySettingsRepository.save(defaultSettings);
    }
  }

  async getSettings(): Promise<SecuritySettings> {
    let settings = await this.securitySettingsRepository.findOne({
      where: {},
    });

    if (!settings) {
      settings = this.securitySettingsRepository.create({
        sessionExpirationMinutes: 15,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15,
        requireEmailVerification: true,
        requireDocumentsForRegistration: true,
        requiredDocumentsForRegistration: [],
      });
      settings = await this.securitySettingsRepository.save(settings);
    }

    return settings;
  }

  async updateSettings(updateDto: UpdateSecuritySettingsDto): Promise<SecuritySettings> {
    let settings = await this.securitySettingsRepository.findOne({
      where: {},
    });

    if (!settings) {
      settings = this.securitySettingsRepository.create({
        sessionExpirationMinutes: 15,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 15,
        requireEmailVerification: true,
        requireDocumentsForRegistration: true,
        requiredDocumentsForRegistration: [],
      });
    }

    if (updateDto.sessionExpirationMinutes !== undefined) {
      settings.sessionExpirationMinutes = updateDto.sessionExpirationMinutes;
    }

    if (updateDto.maxLoginAttempts !== undefined) {
      settings.maxLoginAttempts = updateDto.maxLoginAttempts;
    }

    if (updateDto.lockoutDurationMinutes !== undefined) {
      settings.lockoutDurationMinutes = updateDto.lockoutDurationMinutes;
    }

    if (updateDto.requireEmailVerification !== undefined) {
      settings.requireEmailVerification = updateDto.requireEmailVerification;
    }

    if (updateDto.requireDocumentsForRegistration !== undefined) {
      settings.requireDocumentsForRegistration = updateDto.requireDocumentsForRegistration;
    }

    if (updateDto.requiredDocumentsForRegistration !== undefined) {
      settings.requiredDocumentsForRegistration = updateDto.requiredDocumentsForRegistration;
    }

    return await this.securitySettingsRepository.save(settings);
  }

  /**
   * Récupère la durée d'expiration de session en millisecondes
   */
  async getSessionExpirationMs(): Promise<number> {
    const settings = await this.getSettings();
    return settings.sessionExpirationMinutes * 60 * 1000;
  }
}
