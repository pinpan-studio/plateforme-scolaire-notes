import { ApiError } from "@/server/errors";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const WRITE_LIMIT = 60;
const SEARCH_LIMIT = 30;
const MINUTE_MS = 60 * 1000;

type LoginBucket = {
  failures: number;
  lockedUntil: number;
};

const loginBuckets = new Map<string, LoginBucket>();
const writeBuckets = new Map<string, number[]>();
const searchBuckets = new Map<string, number[]>();

function loginKey(ip: string, email: string) {
  return `${ip}|${email.trim().toLowerCase()}`;
}

function retryAfter(until: number): number {
  return Math.max(1, Math.ceil((until - Date.now()) / 1000));
}

export function assertLoginAllowed(ip: string, email: string): void {
  const bucket = loginBuckets.get(loginKey(ip, email));
  if (bucket && bucket.lockedUntil > Date.now()) {
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Trop de tentatives. Réessayez plus tard.",
      undefined,
      retryAfter(bucket.lockedUntil),
    );
  }
}

export function recordLoginFailure(ip: string, email: string): void {
  const key = loginKey(ip, email);
  const bucket = loginBuckets.get(key) ?? { failures: 0, lockedUntil: 0 };
  if (bucket.lockedUntil > Date.now()) return;
  bucket.failures += 1;
  if (bucket.failures >= MAX_FAILURES) {
    bucket.lockedUntil = Date.now() + WINDOW_MS;
  }
  loginBuckets.set(key, bucket);
}

export function recordLoginSuccess(ip: string, email: string): void {
  const key = loginKey(ip, email);
  const bucket = loginBuckets.get(key);
  if (bucket && bucket.lockedUntil > Date.now()) return;
  loginBuckets.delete(key);
}

function hit(bucket: Map<string, number[]>, key: string, limit: number): void {
  const now = Date.now();
  const recent = (bucket.get(key) ?? []).filter((stamp) => now - stamp < MINUTE_MS);
  if (recent.length >= limit) {
    bucket.set(key, recent);
    const oldest = recent[0] ?? now;
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Trop de tentatives. Réessayez plus tard.",
      undefined,
      retryAfter(oldest + MINUTE_MS),
    );
  }
  recent.push(now);
  bucket.set(key, recent);
}

export function assertWriteRate(userId: string): void {
  hit(writeBuckets, userId, WRITE_LIMIT);
}

export function assertSearchRate(userId: string): void {
  hit(searchBuckets, userId, SEARCH_LIMIT);
}

export function resetRateLimits(): void {
  loginBuckets.clear();
  writeBuckets.clear();
  searchBuckets.clear();
}
