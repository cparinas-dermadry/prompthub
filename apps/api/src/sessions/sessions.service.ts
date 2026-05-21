import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { CreateSessionDto, UpdateSessionDto } from './dto/session.dto.js';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async findAll(userId: string, search?: string) {
    let query = this.supabase.db
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (search) {
      query = query.textSearch('name', search, { type: 'websearch' });
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`findAll failed: ${error.message}`);
      throw new InternalServerErrorException('Database error');
    }
    return data;
  }

  async findOne(id: string, userId: string) {
    const { data: session, error } = await this.supabase.db
      .from('sessions')
      .select(`*, threads(*, messages(*))`)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !session) throw new NotFoundException('Session not found');
    return session;
  }

  async create(userId: string, dto: CreateSessionDto) {
    const { data, error } = await this.supabase.db
      .from('sessions')
      .insert({
        user_id: userId,
        name: dto.name,
        tags: dto.tags ?? [],
        active_providers: dto.activeProviders ?? [],
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`create failed: ${error.message}`);
      throw new InternalServerErrorException('Database error');
    }
    return data;
  }

  async update(id: string, userId: string, dto: UpdateSessionDto) {
    const { data, error } = await this.supabase.db
      .from('sessions')
      .update({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.activeProviders !== undefined && { active_providers: dto.activeProviders }),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Session not found');
    return data;
  }

  async remove(id: string, userId: string) {
    const { error } = await this.supabase.db
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new NotFoundException('Session not found');
  }
}
