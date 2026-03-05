import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole, UserType, OrganisationRole } from '../../auth/dto/register.dto';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsEnum(UserType)
  @IsOptional()
  type?: UserType;

  @ApiProperty({ required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({
    description: 'Rôle de l\'utilisateur au niveau organisation',
    enum: OrganisationRole,
    required: false,
  })
  @IsEnum(OrganisationRole)
  @IsOptional()
  organisationRole?: OrganisationRole;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  organisationId?: string;
}



