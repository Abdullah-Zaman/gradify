import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './jwt.guard';
import { LOGIN_RATE_LIMIT_MESSAGE, LoginAttemptsService } from './login-attempts.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginAttempts: LoginAttemptsService,
  ) {}

  // Only failed attempts count: 10 failures per 15 minutes per IP (see LoginAttemptsService).
  @Post('login')
  async login(@Req() req: Request, @Body() dto: LoginDto) {
    const key = req.ip ?? 'unknown';
    if (this.loginAttempts.isBlocked(key)) {
      throw new ThrottlerException(LOGIN_RATE_LIMIT_MESSAGE);
    }
    try {
      return await this.authService.login(dto, req.ip);
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        this.loginAttempts.recordFailure(key);
      }
      throw err;
    }
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: Request & { user: { id: number } }) {
    return this.authService.logout(req.user.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, dto, req.ip);
  }
}
