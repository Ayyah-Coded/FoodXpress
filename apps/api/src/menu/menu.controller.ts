import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload, UserRole } from '@food-xpress/types';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Request as ExpressRequest } from 'express';
import { MenuService } from './menu.service';


type AuthRequest = ExpressRequest & { user: JwtPayload };

@Controller('menu')
export class MenuController {
  constructor(private menuService: MenuService) {}

  // CATEGORIES

  @Post('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER)
  createCategory(@Request() req: AuthRequest, @Body() dto: CreateCategoryDto) {
    return this.menuService.createCategory(req.user.sub, dto);
  }

  @Get('categories/:restaurantId')
  getCategories(@Param('restaurantId') restaurantId: string) {
    return this.menuService.getCategories(restaurantId);
  }

  @Patch('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER)
  updateCategory(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(id, req.user.sub, dto);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER)
  deleteCategory(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.menuService.deleteCategory(id, req.user.sub);
  }

  // MENU ITEMS

  @Post('items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER)
  createItem(@Request() req: AuthRequest, @Body() dto: CreateMenuItemDto) {
    return this.menuService.createItem(req.user.sub, dto);
  }

  @Get('items/:restaurantId')
  getItems(@Param('restaurantId') restaurantId: string) {
    return this.menuService.getItemsByRestaurant(restaurantId);
  }

  @Patch('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER)
  updateItem(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuService.updateItem(id, req.user.sub, dto);
  }

  @Delete('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.RESTAURANT_OWNER)
  deleteItem(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.menuService.deleteItem(id, req.user.sub);
  }
}