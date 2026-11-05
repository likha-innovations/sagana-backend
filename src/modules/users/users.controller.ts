import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UsePipes,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUserId } from '../../core/decorators/current-user.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyOtpDto, ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../core/decorators/public.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiTags('Users (Profile)')
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
  getProfile(@CurrentUserId() userId: string) {
    return this.usersService.getProfile(userId);
  }

  @ApiTags('Users (Profile)')
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully.' })
  @UsePipes(ZodValidationPipe)
  updateProfile(
    @CurrentUserId() userId: string,
    @Body() data: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, data);
  }

  @ApiTags('Users (Profile)')
  @Post('me/send-password-otp')
  @ApiOperation({ summary: 'Send OTP verification code for password reset' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
  sendPasswordOtp(@CurrentUserId() userId: string) {
    return this.usersService.sendPasswordResetOtp(userId);
  }

  @ApiTags('Users (Profile)')
  @Post('me/verify-password-otp')
  @ApiOperation({ summary: 'Verify OTP code for password reset' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully.' })
  @UsePipes(ZodValidationPipe)
  verifyPasswordOtp(
    @CurrentUserId() userId: string,
    @Body() data: VerifyOtpDto,
  ) {
    return this.usersService.verifyPasswordResetOtp(userId, data.code);
  }

  @ApiTags('Users (Profile)')
  @Post('me/change-password')
  @ApiOperation({ summary: 'Change password using verified OTP' })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @UsePipes(ZodValidationPipe)
  changePassword(
    @CurrentUserId() userId: string,
    @Body() data: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      userId,
      data.code,
      data.newPassword,
    );
  }

  @ApiTags('Admin')
  @Get('admin/operators')
  @ApiOperation({ summary: 'Fetch all operator accounts' })
  @ApiResponse({
    status: 200,
    description: 'Operators retrieved successfully.',
  })
  getOperators() {
    return this.usersService.getOperators();
  }

  @ApiTags('Admin')
  @Patch('admin/operators/:id/status')
  @ApiOperation({
    summary: 'Update operator account status (active/suspended)',
  })
  @ApiResponse({
    status: 200,
    description: 'Operator status updated successfully.',
  })
  updateOperatorStatus(
    @Param('id') id: string,
    @Body() body: { status: 'active' | 'suspended' },
  ) {
    return this.usersService.updateOperatorStatus(id, body.status);
  }

  @ApiTags('Admin')
  @Delete('admin/operators/:id')
  @ApiOperation({ summary: 'Delete operator account' })
  @ApiResponse({
    status: 200,
    description: 'Operator deleted successfully.',
  })
  deleteOperator(@Param('id') id: string) {
    return this.usersService.deleteOperator(id);
  }

  @Public()
  @ApiTags('Auth')
  @Post('auth/forgot-password/send-otp')
  @ApiOperation({ summary: 'Send OTP for unauthenticated password reset' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
  sendPublicForgotPasswordOtp(@Body() body: { email: string }) {
    return this.usersService.sendPublicForgotPasswordOtp(body.email);
  }

  @Public()
  @ApiTags('Auth')
  @Post('auth/forgot-password/verify-otp')
  @ApiOperation({ summary: 'Verify OTP for unauthenticated password reset' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully.' })
  verifyPublicForgotPasswordOtp(@Body() body: { email: string; code: string }) {
    return this.usersService.verifyPublicForgotPasswordOtp(
      body.email,
      body.code,
    );
  }

  @Public()
  @ApiTags('Auth')
  @Post('auth/forgot-password/reset')
  @ApiOperation({
    summary: 'Reset password using OTP for unauthenticated user',
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  resetPublicForgotPassword(
    @Body() body: { email: string; code: string; newPassword: string },
  ) {
    return this.usersService.resetPublicForgotPassword(
      body.email,
      body.code,
      body.newPassword,
    );
  }
}
