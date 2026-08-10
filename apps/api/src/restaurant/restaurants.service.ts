import * as schema from '../db/schema';
import { and, eq, ilike, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';


type Restaurant = typeof schema.restaurants.$inferSelect;

@Injectable()
export class RestaurantsService {
  private readonly logger = new Logger(RestaurantsService.name);

  // TTLs in seconds — single-resource entries live longer than listings
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly LIST_CACHE_TTL = 60; // 1 minute

  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    @Inject('REDIS') private readonly redis: Redis,
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

      // Invalidate caches so the new restaurant is reflected in queries
      await this.invalidateRestaurantCaches(restaurant.id, ownerId);

      return restaurant;
    } catch (err) {
      // Postgres unique violation
      // code 23505 indicates unique constraint violation
      const pgErr = err as { code?: string; constraint?: string; detail?: string };
      if (pgErr?.code === '23505') {
        const constraint = (pgErr.constraint ?? pgErr.detail ?? '').toString();

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
    const key = `restaurant:owner:${ownerId}`;
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Restaurant | null;
    }

    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    const result = restaurant ?? null;
    await this.redis.set(key, JSON.stringify(result), 'EX', this.CACHE_TTL);
    return result;
  }

  async findById(id: string) {
    const key = `restaurant:${id}`;
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Restaurant;
    }

    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.id, id));

    if (!restaurant) throw new NotFoundException('Restaurant not found');
    await this.redis.set(key, JSON.stringify(restaurant), 'EX', this.CACHE_TTL);
    return restaurant;
  }

  async findAll(search?: string) {
    const key = `restaurant:list:${search || 'all'}`;
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as Restaurant[];
    }

    // if search is provided, filter by name OR cuisine type (case-insensitive)
    // only return open restaurants to customers
    let restaurants: Restaurant[];
    if (search) {
      restaurants = await this.db
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
    } else {
      restaurants = await this.db
        .select()
        .from(schema.restaurants)
        .where(eq(schema.restaurants.isOpen, true));
    }

    await this.redis.set(key, JSON.stringify(restaurants), 'EX', this.LIST_CACHE_TTL);
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

    // Invalidate caches so stale data isn't served
    await this.invalidateRestaurantCaches(updated.id, ownerId);

    return updated;
  };

  // Remove all cached entries tied to a restaurant so subsequent reads
  // are rebuilt from the database (used after create/update).
  private async invalidateRestaurantCaches(id: string, ownerId: string) {
    const keysToDelete = [
      `restaurant:${id}`,
      `restaurant:owner:${ownerId}`,
    ];

    // List caches are keyed by search term (and 'all'), so collect them via scan.
    const listKeys = await this.redis.keys('restaurant:list:*');
    if (listKeys.length > 0) {
      keysToDelete.push(...listKeys);
    }

    if (keysToDelete.length > 0) {
      await this.redis.del(...keysToDelete);
    }
  }
};