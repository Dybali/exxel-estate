import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import type { Response } from "express";

@Catch(HttpException)
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const detail = exception.getResponse();
    const message = typeof detail === "string" ? detail : typeof detail === "object" && detail !== null && "message" in detail ? detail.message : exception.message;
    response.status(exception.getStatus()).json({ error: Array.isArray(message) ? message.join(" ") : String(message) });
  }
}
