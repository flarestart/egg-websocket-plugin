import 'egg';
import * as WebSocket from 'ws';

declare module 'egg' {
  export interface Application {
    ws: EggWs;
  }

  export interface Context {
    websocket?: WebSocket;
  }

  export interface EggAppConfig {
    websocket: {
      useAppMiddlewares: boolean;
    };
  }

  interface EggWs extends WebSocket.Server {
    route(path: string, ...middleware): void;
    route(path: RegExp, ...middleware): void;
    use(
      middleware: (ctx: Context, next: () => Promise<void>) => Promise<void>,
    ): void;
  }
}
