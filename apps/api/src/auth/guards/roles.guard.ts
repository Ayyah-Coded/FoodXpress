import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { JwtPayload, UserRole } from '@food-xpress/types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user: JwtPayload }>();

    return requiredRoles.includes(user.role as UserRole);
  }
}