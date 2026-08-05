export const UserRole = {
  CUSTOMER: "CUSTOMER",
  RESTAURANT_OWNER: 'RESTAURANT_OWNER',
  DRIVER: 'DRIVER'
} as const

export type UserRole = typeof UserRole[keyof typeof UserRole];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
};

export interface HealthCheckResponse {
  status: string;
  timestamp: Date;
};