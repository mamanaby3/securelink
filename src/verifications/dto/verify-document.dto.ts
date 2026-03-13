import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class VerifyDocumentDto {
  @ApiProperty({
    description: 'ID du document à vérifier',
    example: 'doc-123',
  })
  @IsString()
  @IsNotEmpty()
  documentId: string;

  @ApiProperty({
    description: 'ID du client',
    example: 'client-123',
  })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({
    description: 'ID du formulaire associé',
    example: 'form-123',
    required: false,
  })
  @IsString()
  @IsOptional()
  formId?: string;
}













