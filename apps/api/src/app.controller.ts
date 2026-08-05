import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import type { HealthCheckResponse } from "@food-xpress/types";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  health(): HealthCheckResponse {
    return {
      status: "ok",
      timestamp: new Date(),
    };
  }
}
