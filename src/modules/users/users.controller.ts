/* eslint-disable */
import { Controller, Get, Patch, Body, UsePipes } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Users (Profile)')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
  getProfile(@CurrentUserId() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  @UsePipes(ZodValidationPipe)
  updateProfile(
    @CurrentUserId() userId: string,
    @Body() data: UpdateProfileDto
  ) {
    return this.usersService.updateProfile(userId, data);
  }
}
