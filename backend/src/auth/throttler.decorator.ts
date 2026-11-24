import { SkipThrottle } from '@nestjs/throttler';

// Re-exported so call sites only need to import from here for auth-related
// throttling decorators. Use on genuinely public/unauthenticated endpoints
// that shouldn't count against the global 100 req/min limit.
export { SkipThrottle };

// Login rate limiting (failed attempts only) lives in LoginAttemptsService.
