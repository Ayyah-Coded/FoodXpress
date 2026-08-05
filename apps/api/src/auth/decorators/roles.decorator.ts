import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@food-xpress/types';

export const ROLES_KEY = 'roles';

// usage: @Roles(UserRole.RESTAURANT_OWNER) above any route method
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);