import * as schema from "./db/schema"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { Controller, Get, Inject } from "@nestjs/common";
import type { HealthCheckResponse } from "@food-xpress/types";

@Controller()
export class AppController {
  constructor(@Inject('DB') private db: NodePgDatabase<typeof schema>) {}

  @Get('db-test')
  async dbTest() {
    const result = await this.db.select().from(schema.users);
    return { users: result, count: result.length };
  }

  @Get("health")
  health(): HealthCheckResponse {
    return {
      status: "ok",
      timestamp: new Date(),
    };
  }
}
