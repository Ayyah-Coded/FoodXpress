import * as schema from '../db/schema';
import { and, eq, ilike, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';


@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
  ) {}

  async create(ownerId: string, dto: CreateRestaurantDto) {
    const [existing] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    if (existing) {
      throw new ForbiddenException('You already have a restaurant');
    }

    try {
      const [restaurant] = await this.db
        .insert(schema.restaurants)
        .values({
          ownerId,
          name: dto.name,
          description: dto.description,
          address: dto.address,
          cuisineType: dto.cuisineType,
          imageUrl: dto.imageUrl,
        })
        .returning();

      return restaurant;
    } catch (err: any) {
      // Postgres unique violation
      // code 23505 indicates unique constraint violation
      if (err?.code === '23505') {
        const constraint = (err?.constraint ?? err?.detail ?? '').toString();

        // Recognize known constraint names (DB-generated or explicitly named)
        const knownOwnerConstraints = [
          'restaurants_owner_id_key',
          'restaurants_owner_id_unique',
          'unique_restaurants_owner_id',
        ];

        if (
          knownOwnerConstraints.includes(constraint) ||
          String(constraint).toLowerCase().includes('owner')
        ) {
          throw new ForbiddenException('You already have a restaurant');
        }
      }

      // rethrow unknown errors
      throw err;
    }
  }

  async findMine(ownerId: string) {
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    return restaurant ?? null;
  }

  async findById(id: string) {
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, id));

    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return restaurant;
  }

  async findAll(search?: string) {
    // if search is provided, filter by name OR cuisine type (case-insensitive)
    // only return open restaurants to customers
    if (search) {
      return this.db
        .select()
        .from(schema.restaurants)
        .where(
          and(
            eq(schema.restaurants.isOpen, true),
            or(
              ilike(schema.restaurants.name, `%${search}%`),
              ilike(schema.restaurants.cuisineType, `%${search}%`),
            ),
          ),
        );
    };

    const restaurants = this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.isOpen, true));

    return restaurants;
  };

  async update(id: string, ownerId: string, dto: UpdateRestaurantDto) {
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, id));

    if (!restaurant) throw new NotFoundException('Restaurant not found');

    if (restaurant.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this restaurant');
    }

    const [updated] = await this.db
      .update(schema.restaurants)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(schema.restaurants.id, id))
      .returning();

    return updated;
  };
};