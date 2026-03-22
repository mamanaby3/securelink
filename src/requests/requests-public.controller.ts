import { Controller, Get, Query, Res, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequestsService } from './requests.service';

/**
 * Routes sans JWT : lien signé dans l’e-mail client (redirection vers secure-pdf).
 */
@ApiTags('Clients')
@Controller('requests')
export class RequestsPublicController {
  constructor(private readonly requestsService: RequestsService) {}

  @Get('client-pdf-editor')
  @ApiOperation({
    summary: 'Redirection vers l’éditeur PDF (lien e-mail client)',
    description:
      'Vérifie le jeton `t` (7 j) puis redirige vers secure-pdf avec les PDFs à jour et un jeton d’upload longue durée.',
  })
  @ApiQuery({ name: 't', required: true, description: 'Jeton JWT (e-mail « finaliser la demande »)' })
  async redirectToPdfEditor(@Query('t') token: string, @Res() res: Response): Promise<void> {
    const t = (token || '').trim();
    if (!t) {
      throw new BadRequestException('Paramètre t manquant');
    }
    const url = await this.requestsService.resolveClientPdfEditorRedirect(t);
    res.redirect(HttpStatus.FOUND, url);
  }
}
