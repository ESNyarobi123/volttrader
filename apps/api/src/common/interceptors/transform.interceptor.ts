import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/**
 * Wraps handler results in the success envelope `{ data, meta? }`.
 * If a service already returns an object with a `data` key (e.g. a paginated
 * `{ data, meta }`), it is passed through unchanged.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (
          payload !== null &&
          typeof payload === "object" &&
          "data" in (payload as Record<string, unknown>)
        ) {
          return payload;
        }
        return { data: payload ?? null };
      }),
    );
  }
}
