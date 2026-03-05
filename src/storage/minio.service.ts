import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'secure-forms');

    if (!endpoint || !accessKey || !secretKey) {
      this.logger.warn('MinIO configuration is missing. File storage will not work.');
      return;
    }

    // Extraire le hostname de l'endpoint (enlever https:// ou http://)
    const hostname = endpoint.replace(/^https?:\/\//, '');

    this.minioClient = new Minio.Client({
      endPoint: hostname,
      port: 443,
      useSSL: true,
      accessKey,
      secretKey,
    });

    this.logger.log('MinIO client initialized');
  }

  async onModuleInit() {
    if (!this.minioClient) {
      return;
    }

    // Vérifier que le bucket existe, sinon le créer
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created`);
      } else {
        this.logger.log(`Bucket ${this.bucketName} already exists`);
      }
    } catch (error) {
      this.logger.error(`Error initializing MinIO bucket: ${error.message}`, error.stack);
    }
  }

  /**
   * Upload un fichier vers MinIO
   * @param fileName Nom du fichier dans MinIO
   * @param fileBuffer Buffer du fichier
   * @param contentType Type MIME du fichier
   * @returns Le nom du fichier dans MinIO
   */
  async uploadFile(
    fileName: string,
    fileBuffer: Buffer,
    contentType: string = 'application/pdf',
  ): Promise<string> {
    if (!this.minioClient) {
      throw new Error('MinIO client is not initialized. Please check your configuration.');
    }

    try {
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        fileBuffer,
        fileBuffer.length,
        {
          'Content-Type': contentType,
        },
      );

      this.logger.log(`File ${fileName} uploaded to MinIO bucket ${this.bucketName}`);
      return fileName;
    } catch (error) {
      this.logger.error(`Error uploading file to MinIO: ${error.message}`, error.stack);
      throw new Error(`Failed to upload file to MinIO: ${error.message}`);
    }
  }

  /**
   * Récupère un fichier depuis MinIO
   * @param fileName Nom du fichier dans MinIO
   * @returns Buffer du fichier
   */
  async getFile(fileName: string): Promise<Buffer> {
    if (!this.minioClient) {
      this.logger.error('MinIO client is not initialized. Please check your MINIO_* environment variables.');
      throw new Error('MinIO client is not initialized. Please check your configuration.');
    }

    try {
      const dataStream = await this.minioClient.getObject(this.bucketName, fileName);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        dataStream.on('data', (chunk) => chunks.push(chunk));
        dataStream.on('end', () => resolve(Buffer.concat(chunks)));
        dataStream.on('error', (error) => {
          this.logger.error(`Error reading file stream from MinIO: ${error.message}`, error.stack);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error(`Error getting file from MinIO: ${error.message}`, error.stack);
      throw new Error(`Failed to get file from MinIO: ${error.message}`);
    }
  }

  /**
   * Supprime un fichier depuis MinIO
   * @param fileName Nom du fichier dans MinIO
   */
  async deleteFile(fileName: string): Promise<void> {
    if (!this.minioClient) {
      throw new Error('MinIO client is not initialized. Please check your configuration.');
    }

    try {
      await this.minioClient.removeObject(this.bucketName, fileName);
      this.logger.log(`File ${fileName} deleted from MinIO bucket ${this.bucketName}`);
    } catch (error) {
      this.logger.error(`Error deleting file from MinIO: ${error.message}`, error.stack);
      throw new Error(`Failed to delete file from MinIO: ${error.message}`);
    }
  }

  /**
   * Génère une URL présignée pour accéder au fichier (valide pendant 7 jours par défaut)
   * @param fileName Nom du fichier dans MinIO
   * @param expiry Durée de validité en secondes (défaut: 7 jours)
   * @returns URL présignée
   */
  async getPresignedUrl(fileName: string, expiry: number = 7 * 24 * 60 * 60): Promise<string> {
    if (!this.minioClient) {
      throw new Error('MinIO client is not initialized. Please check your configuration.');
    }

    try {
      const url = await this.minioClient.presignedGetObject(this.bucketName, fileName, expiry);
      return url;
    } catch (error) {
      this.logger.error(`Error generating presigned URL: ${error.message}`, error.stack);
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  /**
   * Vérifie si un fichier existe dans MinIO
   * @param fileName Nom du fichier dans MinIO
   * @returns true si le fichier existe
   */
  async fileExists(fileName: string): Promise<boolean> {
    if (!this.minioClient) {
      this.logger.warn('MinIO client not initialized, cannot check file existence');
      return false;
    }

    try {
      await this.minioClient.statObject(this.bucketName, fileName);
      return true;
    } catch (error) {
      // Si l'erreur est "not found", le fichier n'existe pas
      if (error.code === 'NotFound' || error.message?.includes('not found')) {
        return false;
      }
      // Pour d'autres erreurs, logger et retourner false
      this.logger.error(`Error checking file existence in MinIO: ${error.message}`, error.stack);
      return false;
    }
  }
}

