import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Public values for static frontends (session.html, etc.).
 * Maps JS keys are meant for browser use — restrict in Google Cloud by HTTP referrer.
 */
@Controller("config")
export class ClientConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get("maps-key")
  mapsKey() {
    const key = (this.configService.get<string>("googleMaps.browserKey") || "").trim();
    return { mapsApiKey: key.length > 0 ? key : null };
  }
}
