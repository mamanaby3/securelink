import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IpAddress = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    
    // 1. Vérifier X-Forwarded-For (pour les proxies/load balancers)
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = forwarded.split(',').map(ip => ip.trim());
      // Prendre la première IP (celle du client original)
      const clientIp = ips[0];
      // Ignorer ::1 et 127.0.0.1 si on a d'autres IPs
      if (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
        return clientIp;
      }
      // Si on a plusieurs IPs, prendre la première non-localhost
      for (const ip of ips) {
        if (ip && ip !== '::1' && ip !== '127.0.0.1') {
          return ip;
        }
      }
    }
    
    // 2. Vérifier X-Real-IP (nginx et autres proxies)
    const realIp = request.headers['x-real-ip'];
    if (realIp && realIp !== '::1' && realIp !== '127.0.0.1') {
      return realIp;
    }
    
    // 3. Vérifier CF-Connecting-IP (Cloudflare)
    const cfIp = request.headers['cf-connecting-ip'];
    if (cfIp && cfIp !== '::1' && cfIp !== '127.0.0.1') {
      return cfIp;
    }
    
    // 4. Utiliser request.ip (configuré par Express trust proxy)
    if (request.ip && request.ip !== '::1' && request.ip !== '127.0.0.1') {
      return request.ip;
    }
    
    // 5. Utiliser connection.remoteAddress
    const remoteAddress = request.connection?.remoteAddress || request.socket?.remoteAddress;
    if (remoteAddress) {
      // Normaliser ::1 et ::ffff:127.0.0.1 vers 127.0.0.1
      if (remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1') {
        return '127.0.0.1';
      }
      // Enlever le préfixe ::ffff: pour les adresses IPv4 mappées en IPv6
      if (remoteAddress.startsWith('::ffff:')) {
        return remoteAddress.replace('::ffff:', '');
      }
      return remoteAddress;
    }
    
    // 6. Fallback
    return 'unknown';
  },
);


