import { beforeEach } from "vitest";
import { resetRateLimits } from "@/lib/auth/rate-limit";

beforeEach(async () => {
  await resetRateLimits();
});
