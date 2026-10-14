import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./http-error.filter";

async function bootstrap() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("DATABASE_URL and a strong JWT_SECRET are required");
  }
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new HttpErrorFilter());
  const origins = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").split(",").map((value) => value.trim());
  app.enableCors({ origin: origins, credentials: true, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });
  app.setGlobalPrefix("api");
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
}

bootstrap();
