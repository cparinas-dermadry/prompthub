import { Controller, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ThreadsService } from './threads.service.js';
import { CreateThreadDto, UpdateThreadDto } from './dto/thread.dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('threads')
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: { sub: string }, @Body() dto: CreateThreadDto) {
    return this.threadsService.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body() dto: UpdateThreadDto,
  ) {
    return this.threadsService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.threadsService.remove(id, user.sub);
  }
}
