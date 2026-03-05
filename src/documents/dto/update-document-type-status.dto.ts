import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateDocumentTypeStatusDto {
  @ApiProperty({
    description: 'Statut actif/inactif du type de document',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}

