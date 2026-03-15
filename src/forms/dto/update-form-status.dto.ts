import { IsEnum, IsNotEmpty } from 'class-validator';
import { FormStatus } from '../entities/form.entity';

export class UpdateFormStatusDto {
  @IsNotEmpty({ message: 'Le champ status est obligatoire' })
  @IsEnum(FormStatus, {
    message: 'Le statut doit être ONLINE, OFFLINE ou DRAFT',
  })
  status: FormStatus;
}
