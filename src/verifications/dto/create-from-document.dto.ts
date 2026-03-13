import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Sector } from '../../organisations/dto/create-organisation.dto';
import { DocumentType } from '../../users/entities/user-document.entity';

export class CreateFromDocumentDto {
  @ApiProperty({
    description: 'ID du document (UserDocument)',
    example: 'doc-uuid',
  })
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @ApiProperty({
    description: 'ID du client',
    example: 'client-uuid',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'Nom du client',
    example: 'Mamadou Sy',
  })
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @ApiProperty({
    description: 'Type de document',
    enum: DocumentType,
    example: DocumentType.CARTE_IDENTITE,
  })
  @IsString()
  @IsNotEmpty()
  documentType: DocumentType;

  @ApiProperty({
    description: 'Secteur',
    enum: Sector,
    example: Sector.BANQUE,
  })
  @IsString()
  @IsNotEmpty()
  sector: Sector;
}







