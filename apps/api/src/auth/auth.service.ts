import { eq } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import * as bcrypt from 'bcrypt';
import * as schema from '../db/schema';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '@food-xpress/types';
import { RegisterDto } from './dto/register.dto';



@Injectable()
export class AuthService {
  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let user: schema.User | undefined;
    try {
      const [inserted] = await this.db
        .insert(schema.users)
        .values({
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          password: hashedPassword,
          role: dto.role,
        })
        .returning();

      user = inserted;
    } catch (error) {
      const err = error as { code?: string };
      if (err?.code === '23505') {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }

    return {
      user: this.sanitizeUser(user),
      token: this.generateToken(user),
    };
  }

  async login(dto: LoginDto) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, dto.email));

    if (!user) throw new UnauthorizedException('Invalid Credentials');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) throw new UnauthorizedException('Invalid Credentials');

    return {
      user: this.sanitizeUser(user),
      token: this.generateToken(user),
    };
  }

  private generateToken(user: schema.User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: schema.User) {
    const { password, ...safeUser } = user;
    void password;
    return safeUser;
  }
}