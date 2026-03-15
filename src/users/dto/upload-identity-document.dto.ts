import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { IdentityDocumentKind } from '../entities/user-identity-document.entity';

export class UploadIdentityDocumentDto {
  @ApiProperty({
    description: 'Slot du document d\'identité (recto, verso ou selfie)',
    enum: IdentityDocumentKind,
    example: 'RECTO',
  })
  @IsNotEmpty({ message: 'kind est requis' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(IdentityDocumentKind, {
    message: 'kind doit être RECTO, VERSO ou SELFIE',
  })
  kind: IdentityDocumentKind;
}
