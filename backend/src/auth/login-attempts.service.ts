import { Injectable } from '@nestjs/common';

export const LOGIN_MAX_FAILED_ATTEMPTS = 10;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MESSAGE =
  'Too many attempts. Please wait a few minutes and try again.';

/**
 * Tracks failed login attempts per client IP in a sliding window.
 * Only failures are recorded, so successful logins never use up the allowance.
 * In-memory (per process), same as the default ThrottlerModule storage.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures = LOGIN_MAX_FAILED_ATTEMPTS,
    private readonly windowMs = LOGIN_FAILURE_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  isBlocked(key: string): boolean {
    return this.recent(key).length >= this.maxFailures;
  }

  recordFailure(key: string): void {
    const timestamps = this.recent(key);
    timestamps.push(this.now());
    this.failures.set(key, timestamps);
    if (this.failures.size > 10_000) this.prune();
  }

  private recent(key: string): number[] {
    const cutoff = this.now() - this.windowMs;
    const timestamps = (this.failures.get(key) ?? []).filter((t) => t > cutoff);
    if (timestamps.length) this.failures.set(key, timestamps);
    else this.failures.delete(key);
    return timestamps;
  }

  private prune(): void {
    for (const key of [...this.failures.keys()]) this.recent(key);
  }
}
