import { ForbiddenException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_RATE_LIMIT_MESSAGE,
  LoginAttemptsService,
} from './login-attempts.service';

describe('Login rate limiting (failed attempts only)', () => {
  let clock: number;
  let attempts: LoginAttemptsService;
  let login: jest.Mock;
  let controller: AuthController;
  const dto = { email: 'a@b.c', password: 'x', role: 'STUDENT' } as unknown as LoginDto;
  const req = (ip = '1.2.3.4') => ({ ip }) as Request;
  const fail = () => login.mockRejectedValueOnce(new UnauthorizedException('Invalid credentials'));

  beforeEach(() => {
    clock = 1_000_000;
    attempts = new LoginAttemptsService(10, LOGIN_FAILURE_WINDOW_MS, () => clock);
    login = jest.fn().mockResolvedValue({ accessToken: 't' });
    controller = new AuthController({ login } as unknown as AuthService, attempts);
  });

  it('allows 10 failures, then blocks the 11th attempt with a friendly 429', async () => {
    for (let i = 0; i < 10; i++) {
      fail();
      await expect(controller.login(req(), dto)).rejects.toBeInstanceOf(UnauthorizedException);
    }
    const err = await controller.login(req(), dto).catch((e) => e);
    expect(err).toBeInstanceOf(ThrottlerException);
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(err.message).toBe(LOGIN_RATE_LIMIT_MESSAGE);
    expect(login).toHaveBeenCalledTimes(10); // blocked request never reached AuthService
  });

  it('does not count successful logins', async () => {
    for (let i = 0; i < 50; i++) {
      await expect(controller.login(req(), dto)).resolves.toEqual({ accessToken: 't' });
    }
    for (let i = 0; i < 9; i++) {
      fail();
      await controller.login(req(), dto).catch(() => undefined);
    }
    await expect(controller.login(req(), dto)).resolves.toEqual({ accessToken: 't' });
  });

  it('counts suspended-account (403) failures', async () => {
    for (let i = 0; i < 10; i++) {
      login.mockRejectedValueOnce(new ForbiddenException('suspended'));
      await controller.login(req(), dto).catch(() => undefined);
    }
    await expect(controller.login(req(), dto)).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('tracks each IP separately', async () => {
    for (let i = 0; i < 10; i++) {
      fail();
      await controller.login(req('1.1.1.1'), dto).catch(() => undefined);
    }
    await expect(controller.login(req('1.1.1.1'), dto)).rejects.toBeInstanceOf(ThrottlerException);
    await expect(controller.login(req('2.2.2.2'), dto)).resolves.toEqual({ accessToken: 't' });
  });

  it('unblocks once failures age out of the 15-minute window', async () => {
    for (let i = 0; i < 10; i++) {
      fail();
      await controller.login(req(), dto).catch(() => undefined);
    }
    clock += LOGIN_FAILURE_WINDOW_MS - 1;
    await expect(controller.login(req(), dto)).rejects.toBeInstanceOf(ThrottlerException);
    clock += 2;
    await expect(controller.login(req(), dto)).resolves.toEqual({ accessToken: 't' });
  });
});
