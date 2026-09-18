import { Module } from '@nestjs/common'
import { LoggerModule } from 'nestjs-pino'
import type { AuthenticatedRequest } from './auth/clerk-auth.guard'
import { AuthModule } from './auth/auth.module'
import { DecksModule } from './decks/decks.module'
import { HealthModule } from './health/health.module'

const isProduction = process.env.NODE_ENV === 'production'

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
        autoLogging: {
          ignore: (req) => req.url === '/healthz',
        },
        customProps: (req) => {
          const auth = (req as AuthenticatedRequest).auth
          return auth?.userId ? { userId: auth.userId } : {}
        },
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie'],
          remove: true,
        },
        ...(isProduction
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
            }),
      },
    }),
    AuthModule,
    HealthModule,
    DecksModule,
  ],
})
export class AppModule {}
