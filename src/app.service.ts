import { Injectable } from '@nestjs/common';
import { CreateLinkDto } from './dto/create-link.dto';

@Injectable()
export class AppService {
  private links = [];

  getHello(): string {
    return 'Welcome to Secure Link API!';
  }

  getAllLinks() {
    return this.links;
  }

  createLink(createLinkDto: CreateLinkDto) {
    const newLink = {
      id: Date.now().toString(),
      url: createLinkDto.url,
      secureLink: `https://secure-link.com/${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.links.push(newLink);
    return newLink;
  }

  getLinkById(id: string) {
    const link = this.links.find((l) => l.id === id);
    if (!link) {
      throw new Error('Link not found');
    }
    return link;
  }
}










