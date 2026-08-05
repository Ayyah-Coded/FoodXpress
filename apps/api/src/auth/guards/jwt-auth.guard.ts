import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@food-xpress/types';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';


@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();

    const authHeader = request.headers.authorization;
    if (!authHeader) throw new UnauthorizedException('No token provided');

    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedException('Invalid token format');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}