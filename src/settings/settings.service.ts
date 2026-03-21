import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSectorDto } from './dto/create-sector.dto';
import { CreateFormTypeDto } from './dto/create-form-type.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { Sector } from './entities/sector.entity';
import { FormType } from './entities/form-type.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Sector)
    private sectorRepository: Repository<Sector>,
    @InjectRepository(FormType)
    private formTypeRepository: Repository<FormType>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  private normalizeName(value: string): string {
    return (value || '').trim().replace(/\s+/g, ' ');
  }

  private assertRoleNameAllowed(name: string): void {
    const normalized = this.normalizeName(name).toUpperCase();
    const blocked = ['ADMIN', 'CLIENT', 'ORGANISATION', 'ORGANIZATION', 'ADMINISTRATEUR SYSTEME'];
    if (blocked.includes(normalized)) {
      throw new BadRequestException('Ce rôle est réservé au système et ne peut pas être créé/modifié ici');
    }
  }

  // Sectors
  async createSector(createSectorDto: CreateSectorDto) {
    const newSector = this.sectorRepository.create({
      name: createSectorDto.name,
      description: createSectorDto.description,
      isActive: true,
    });
    return await this.sectorRepository.save(newSector);
  }

  async findAllSectors() {
    return await this.sectorRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOneSector(id: string) {
    const sector = await this.sectorRepository.findOne({ where: { id } });
    if (!sector) {
      throw new NotFoundException('Secteur non trouvé');
    }
    return sector;
  }

  async updateSector(id: string, updateSectorDto: CreateSectorDto) {
    const sector = await this.findOneSector(id);
    sector.name = updateSectorDto.name;
    if (updateSectorDto.description !== undefined) {
      sector.description = updateSectorDto.description;
    }
    return await this.sectorRepository.save(sector);
  }

  async removeSector(id: string) {
    const sector = await this.findOneSector(id);
    sector.isActive = false;
    await this.sectorRepository.save(sector);
  }

  // Form Types
  async createFormType(createFormTypeDto: CreateFormTypeDto) {
    const newFormType = this.formTypeRepository.create({
      name: createFormTypeDto.name,
      description: createFormTypeDto.description,
      isActive: true,
    });
    return await this.formTypeRepository.save(newFormType);
  }

  async findAllFormTypes() {
    return await this.formTypeRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOneFormType(id: string) {
    const formType = await this.formTypeRepository.findOne({ where: { id } });
    if (!formType) {
      throw new NotFoundException('Type de formulaire non trouvé');
    }
    return formType;
  }

  async updateFormType(id: string, updateFormTypeDto: CreateFormTypeDto) {
    const formType = await this.findOneFormType(id);
    formType.name = updateFormTypeDto.name;
    if (updateFormTypeDto.description !== undefined) {
      formType.description = updateFormTypeDto.description;
    }
    return await this.formTypeRepository.save(formType);
  }

  async removeFormType(id: string) {
    const formType = await this.findOneFormType(id);
    formType.isActive = false;
    await this.formTypeRepository.save(formType);
  }

  // Roles
  async createRole(createRoleDto: CreateRoleDto) {
    this.assertRoleNameAllowed(createRoleDto.name);
    const newRole = this.roleRepository.create({
      name: this.normalizeName(createRoleDto.name),
      description: createRoleDto.description,
      isActive: true,
    });
    return await this.roleRepository.save(newRole);
  }

  async findAllRoles() {
    return await this.roleRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOneRole(id: string) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Rôle non trouvé');
    }
    return role;
  }

  async updateRole(id: string, updateRoleDto: CreateRoleDto) {
    const role = await this.findOneRole(id);
    this.assertRoleNameAllowed(updateRoleDto.name);
    role.name = this.normalizeName(updateRoleDto.name);
    if (updateRoleDto.description !== undefined) {
      role.description = updateRoleDto.description;
    }
    return await this.roleRepository.save(role);
  }

  async removeRole(id: string) {
    const role = await this.findOneRole(id);
    role.isActive = false;
    await this.roleRepository.save(role);
  }
}



