import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsNotEmpty } from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({
    description: 'The URL to create a secure link for',
    example: 'https://example.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;
}

 











