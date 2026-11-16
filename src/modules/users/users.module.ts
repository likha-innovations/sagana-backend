import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersOperatorController } from './users-operator.controller';
import { UsersAdminController } from './users-admin.controller';

@Module({
  providers: [UsersService],
  controllers: [UsersOperatorController, UsersAdminController],
  exports: [UsersService],
})
export class UsersModule {}
