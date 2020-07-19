import 'egg';
import { RedisOptions } from 'ioredis';
import { EggWsClient, EggWsServer } from './app';

declare module 'egg' {
  export interface Application {
    ws: EggWsServer;
  }

  export interface Context {
    websocket?: EggWsClient;
  }

  export interface EggAppConfig {
    websocket: {
      useAppMiddlewares: boolean;
      redis: RedisOptions;
    };
  }
}
