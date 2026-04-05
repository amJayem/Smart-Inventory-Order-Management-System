import { Injectable, ConflictException, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private activityService: ActivityService,
  ) {}

  private safeLog(params: Parameters<ActivityService['log']>[0]) {
    this.activityService.log(params).catch((err) =>
      this.logger.warn(`Activity log failed: ${err.message}`)
    );
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, password: hashed },
      select: { id: true, email: true, name: true, role: true },
    });

    this.safeLog({ action: 'USER_CREATED', description: `New user registered: ${user.name} (${user.email})`, userId: user.id });

    return { user, token: this.signToken(user.id, user.email) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    this.safeLog({ action: 'USER_LOGGED_IN', description: `${user.name} logged in`, userId: user.id });

    const { password: _, ...safeUser } = user;
    return { user: safeUser, token: this.signToken(user.id, user.email) };
  }

  async demoLogin() {
    const demoEmail = this.configService.get<string>('DEMO_EMAIL', 'demo@admin.com');
    const user = await this.prisma.user.findUnique({ where: { email: demoEmail } });
    if (!user) throw new UnauthorizedException('Demo account not available. Run the seed first.');

    this.safeLog({ action: 'USER_LOGGED_IN', description: `Demo account logged in`, userId: user.id });

    const { password: _, ...safeUser } = user;
    return { user: safeUser, token: this.signToken(user.id, user.email) };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, isDemo: true, createdAt: true },
    });
  }

  private signToken(userId: string, email: string) {
    return this.jwtService.sign({ sub: userId, email });
  }
}
