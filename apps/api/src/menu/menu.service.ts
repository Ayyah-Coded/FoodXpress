import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';


type MenuCategory = typeof schema.menuCategories.$inferSelect;
type MenuItem = typeof schema.menuItems.$inferSelect;


@Injectable()
export class MenuService {
  private readonly logger = new Logger(MenuService.name);

  // TTL in seconds — menu data is read-heavy and changes rarely
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @Inject('DB') private db: NodePgDatabase<typeof schema>,
    @Inject('REDIS') private readonly redis: Redis,
  ) {}

  private async getRestaurantByOwner(ownerId: string) {
    const [restaurant] = await this.db
      .select()
      .from(schema.restaurants)
      .where(eq(schema.restaurants.ownerId, ownerId));

    if (!restaurant) throw new NotFoundException('Create a restaurant first');

    return restaurant;
  };

  // CATEGORIES
  async createCategory(ownerId: string, dto: CreateCategoryDto) {
    const restaurant = await this.getRestaurantByOwner(ownerId);

    if (!restaurant) throw new NotFoundException('Create a restaurant first');

    const [category] = await this.db
      .insert(schema.menuCategories)
      .values({ restaurantId: restaurant.id, name: dto.name })
      .returning();

    await this.invalidateMenuCaches(restaurant.id);

    return category;
  };

  async getCategories(restaurantId: string): Promise<MenuCategory[]> {
    const key = `menu:categories:${restaurantId}`;

    // Redis failures are treated as cache misses: log and fall through to the
    // database rather than rejecting the request.
    let cached: string | null = null;
    try {
      cached = await this.redis.get(key);
    } catch (err) {
      this.logger.warn(
        `Cache read failed for ${key}, treating as cache miss: ${(err as Error).message}`,
      );
    }

    if (cached) {
      return JSON.parse(cached) as MenuCategory[];
    }

    const categories = await this.db
      .select()
      .from(schema.menuCategories)
      .where(eq(schema.menuCategories.restaurantId, restaurantId));

    // A failed cache write is also non-fatal: the DB result is valid, so return
    // it and let the next read rebuild the cache.
    try {
      await this.redis.set(
        key,
        JSON.stringify(categories),
        'EX',
        this.CACHE_TTL,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to warm cache for ${key}: ${(err as Error).message}`,
      );
    }

    return categories;
  };

  async updateCategory(id: string, ownerId: string, dto: UpdateCategoryDto) {
    const restaurant = await this.getRestaurantByOwner(ownerId);

    const [category] = await this.db
      .select()
      .from(schema.menuCategories)
      .where(eq(schema.menuCategories.id, id));

    if (!category) throw new NotFoundException('Category not found');

    if (category.restaurantId !== restaurant.id) {
      throw new ForbiddenException(
        'This category does not belong to your restaurant',
      );
    }

    const [updated] = await this.db
      .update(schema.menuCategories)
      .set({ name: dto.name })
      .where(eq(schema.menuCategories.id, id))
      .returning();

    await this.invalidateMenuCaches(restaurant.id);

    return updated;
  };

  async deleteCategory(id: string, ownerId: string) {
    const restaurant = await this.getRestaurantByOwner(ownerId);

    const [category] = await this.db
      .select()
      .from(schema.menuCategories)
      .where(eq(schema.menuCategories.id, id));

    if (!category) throw new NotFoundException('Category not found');

    if (category.restaurantId !== restaurant.id) {
      throw new ForbiddenException(
        'This category does not belong to your restaurant',
      );
    }

    // cascade delete will remove all items in this category automatically
    await this.db
      .delete(schema.menuCategories)
      .where(eq(schema.menuCategories.id, id));

    await this.invalidateMenuCaches(restaurant.id);

    return { message: 'Category deleted' };
  };

  // MENU ITEMS

  async createItem(ownerId: string, dto: CreateMenuItemDto) {
    const restaurant = await this.getRestaurantByOwner(ownerId);

    const [category] = await this.db
      .select()
      .from(schema.menuCategories)
      .where(eq(schema.menuCategories.id, dto.categoryId));

    if (!category) throw new NotFoundException('Category not found');

    if (category.restaurantId !== restaurant.id) {
      throw new ForbiddenException(
        'This category does not belong to your restaurant',
      );
    }

    const [item] = await this.db
      .insert(schema.menuItems)
      .values({
        restaurantId: restaurant.id,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
      })
      .returning();

    await this.invalidateMenuCaches(restaurant.id);

    return item;
  };

  async getItemsByRestaurant(restaurantId: string): Promise<MenuItem[]> {
    // returns all items for a restaurant — frontend groups them by category
    const key = `menu:items:${restaurantId}`;

    // Redis failures are treated as cache misses: log and fall through to the
    // database rather than rejecting the request.
    let cached: string | null = null;
    try {
      cached = await this.redis.get(key);
    } catch (err) {
      this.logger.warn(
        `Cache read failed for ${key}, treating as cache miss: ${(err as Error).message}`,
      );
    }

    if (cached) {
      return JSON.parse(cached) as MenuItem[];
    }

    const items = await this.db
      .select()
      .from(schema.menuItems)
      .where(eq(schema.menuItems.restaurantId, restaurantId));

    // A failed cache write is also non-fatal: the DB result is valid, so return
    // it and let the next read rebuild the cache.
    try {
      await this.redis.set(
        key,
        JSON.stringify(items),
        'EX',
        this.CACHE_TTL,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to warm cache for ${key}: ${(err as Error).message}`,
      );
    }

    return items;
  };

  async updateItem(id: string, ownerId: string, dto: UpdateMenuItemDto) {
    const restaurant = await this.getRestaurantByOwner(ownerId);

    const [item] = await this.db
      .select()
      .from(schema.menuItems)
      .where(eq(schema.menuItems.id, id));

    if (!item) throw new NotFoundException('Menu item not found');

    if (item.restaurantId !== restaurant.id) {
      throw new ForbiddenException(
        'This item does not belong to your restaurant',
      );
    }

    if (dto.categoryId !== undefined) {
      const [category] = await this.db
        .select()
        .from(schema.menuCategories)
        .where(eq(schema.menuCategories.id, dto.categoryId));

      if (!category) throw new NotFoundException('Category not found');

      if (category.restaurantId !== restaurant.id) {
        throw new ForbiddenException(
          'This category does not belong to your restaurant',
        );
      }
    }

    const [updated] = await this.db
      .update(schema.menuItems)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(schema.menuItems.id, id))
      .returning();

    await this.invalidateMenuCaches(restaurant.id);

    return updated;
  };

  async deleteItem(id: string, ownerId: string) {
    const restaurant = await this.getRestaurantByOwner(ownerId);

    const [item] = await this.db
      .select()
      .from(schema.menuItems)
      .where(eq(schema.menuItems.id, id));

    if (!item) throw new NotFoundException('Menu item not found');

    if (item.restaurantId !== restaurant.id) {
      throw new ForbiddenException(
        'This item does not belong to your restaurant',
      );
    }

    await this.db.delete(schema.menuItems).where(eq(schema.menuItems.id, id));

    await this.invalidateMenuCaches(restaurant.id);

    return { message: 'Item deleted' };
  };

  private readonly CACHE_INVALIDATE_MAX_RETRIES = 3;
  private readonly CACHE_INVALIDATE_RETRY_DELAY_MS = 100;


  private async invalidateMenuCaches(restaurantId: string): Promise<void> {
    const keys = [
      `menu:categories:${restaurantId}`,
      `menu:items:${restaurantId}`,
    ];

    for (let attempt = 1; attempt <= this.CACHE_INVALIDATE_MAX_RETRIES; attempt++) {
      try {
        await this.redis.del(...keys);
        return;
      } catch (err) {
        const isLastAttempt = attempt === this.CACHE_INVALIDATE_MAX_RETRIES;
        this.logger.warn(
          `Failed to invalidate menu caches for restaurant ${restaurantId} ` +
          `(attempt ${attempt}/${this.CACHE_INVALIDATE_MAX_RETRIES}): ${(err as Error).message}`,
        );
        if (isLastAttempt) break;
        await new Promise((resolve) =>
          setTimeout(resolve, this.CACHE_INVALIDATE_RETRY_DELAY_MS * attempt),
        );
      }
    }
  }
};