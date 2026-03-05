import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';
import { DocumentType } from './entities/document-type.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
  ) {}

  async create(createDocumentTypeDto: CreateDocumentTypeDto): Promise<DocumentType> {
    const newDoc = this.documentTypeRepository.create({
      ...createDocumentTypeDto,
      hasExpirationDate: createDocumentTypeDto.hasExpirationDate ?? false,
      isForIdentityVerification: createDocumentTypeDto.isForIdentityVerification ?? false,
      isActive: true, // Par défaut, un nouveau type de document est actif
    });

    return await this.documentTypeRepository.save(newDoc);
  }

  async findAll(): Promise<DocumentType[]> {
    return await this.documentTypeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<DocumentType> {
    const doc = await this.documentTypeRepository.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException('Type de document non trouvé');
    }
    return doc;
  }

  async update(id: string, updateDocumentTypeDto: UpdateDocumentTypeDto): Promise<DocumentType> {
    const doc = await this.findOne(id);
    
    Object.assign(doc, updateDocumentTypeDto);
    
    return await this.documentTypeRepository.save(doc);
  }

  async updateStatus(id: string, isActive: boolean): Promise<DocumentType> {
    const doc = await this.findOne(id);
    doc.isActive = isActive;
    return await this.documentTypeRepository.save(doc);
  }

  async remove(id: string): Promise<void> {
    const result = await this.documentTypeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Type de document non trouvé');
    }
  }
}



