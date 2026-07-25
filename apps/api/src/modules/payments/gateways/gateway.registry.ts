import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PaymentGateway } from "./payment-gateway.interface";
import { MockGateway } from "./mock.gateway";
import { FlutterwaveGateway } from "./flutterwave.gateway";

export type GatewayCatalogEntry = {
  id: string;
  label: string;
  configured: boolean;
  /** True when this gateway may be used for member checkout right now. */
  available: boolean;
};

/**
 * Resolves a {@link PaymentGateway} by id. Drivers are registered here;
 * callers stay gateway-agnostic.
 */
@Injectable()
export class GatewayRegistry {
  private readonly gateways = new Map<string, PaymentGateway>();

  constructor(
    private readonly config: ConfigService,
    mock: MockGateway,
    private readonly flutterwave: FlutterwaveGateway,
  ) {
    this.register(mock);
    this.register(flutterwave);
  }

  private register(gateway: PaymentGateway): void {
    this.gateways.set(gateway.id, gateway);
  }

  /** Resolve by explicit id, falling back to PAYMENT_DEFAULT_GATEWAY. */
  resolve(id?: string): PaymentGateway {
    const key = id?.trim() || this.config.get<string>("PAYMENT_DEFAULT_GATEWAY") || "mock";
    if (key === "mock" && !this.config.get<boolean>("ALLOW_MOCK_PAYMENTS")) {
      throw new BadRequestException("Mock payment gateway is disabled");
    }
    if (key === "flutterwave" && !this.flutterwave.isConfigured()) {
      throw new BadRequestException(
        "Flutterwave is not configured. Set FLUTTERWAVE_SECRET_KEY in the server environment.",
      );
    }
    const gateway = this.gateways.get(key);
    if (!gateway) {
      throw new BadRequestException(`Unsupported payment gateway: ${key}`);
    }
    return gateway;
  }

  /** For admin settings / deposit-methods — never exposes secrets. */
  catalog(): GatewayCatalogEntry[] {
    const allowMock = Boolean(this.config.get<boolean>("ALLOW_MOCK_PAYMENTS"));
    const flw = this.flutterwave.isConfigured();
    return [
      {
        id: "mock",
        label: "Mock (development)",
        configured: allowMock,
        available: allowMock,
      },
      {
        id: "flutterwave",
        label: "Flutterwave",
        configured: flw,
        available: flw,
      },
      {
        id: "manual",
        label: "Manual bank / mobile money",
        configured: true,
        available: true,
      },
    ];
  }

  defaultOnlineGatewayId(): string {
    return this.config.get<string>("PAYMENT_DEFAULT_GATEWAY") || "mock";
  }
}
