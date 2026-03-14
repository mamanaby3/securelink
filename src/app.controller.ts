import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';
import { CreateLinkDto } from './dto/create-link.dto';

@ApiTags('links')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check (pour proxy / load balancer)' })
  @ApiResponse({ status: 200, description: 'API is up' })
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get()
  @ApiOperation({ summary: 'Get welcome message' })
  @ApiResponse({ status: 200, description: 'Returns a welcome message' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('links')
  @ApiOperation({ summary: 'Get all links' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns all links',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          url: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getAllLinks() {
    return this.appService.getAllLinks();
  }

  @Post('links')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new secure link' })
  @ApiBody({ type: CreateLinkDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Link created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        secureLink: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  createLink(@Body() createLinkDto: CreateLinkDto) {
    return this.appService.createLink(createLinkDto);
  }

  @Get('links/:id')
  @ApiOperation({ summary: 'Get a link by ID' })
  @ApiParam({ name: 'id', description: 'Link ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the link',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        url: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Link not found' })
  getLinkById(@Param('id') id: string) {
    return this.appService.getLinkById(id);
  }
}













