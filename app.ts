import * as assert from 'assert';
import { Application, Context, EggAppConfig } from 'egg';
import { IncomingMessage, ServerResponse } from 'http';
import * as compose from 'koa-compose';
import { Socket } from 'net';
import * as url from 'url';
import * as WebSocket from 'ws';
import { EggRouter as Router } from '@eggjs/router';
import { RedisPubSuber } from './adapter/redis';

/**
 * RFC6455 defined status code
 * https://tools.ietf.org/html/rfc6455#section-7.4.1
 */
const WebSocketInternalError = 1011;

export interface EggWsClient extends WebSocket {
  room: EggWebsocketRoom;
}

export interface PubSuber {
  publish(room: string, message: any): void;
  addMessageHandler(listener: Function): void;
  removeMessageHandler(listener: Function): void;
  joinRoom(...rooms: string[]): Promise<number>;
  leaveRoom(...rooms: string[]): Promise<number>;
}

export type RoomHandler = (params: {
  room: string;
  message: ArrayBufferLike | string;
}) => void;

function isFunction(v: any): v is Function {
  return typeof v === 'function';
}

function isString(v: any): v is string {
  return typeof v === 'string';
}

// run controller until finish
function waitWebSocket(controller) {
  return ctx => {
    return new Promise((resolve, reject) => {
      ctx.websocket.on('close', resolve).on('error', reject);
      try {
        const ret = controller.call(ctx, ctx);
        if (ret && isFunction(ret.catch)) {
          ret.catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  };
}

export class EggWebsocketRoom {
  private _server: EggWsServer;
  private _ctx: Context;
  private _joinedRooms: Set<string>;
  private _listening: boolean;
  private _roomHandlers: Map<string, RoomHandler> = new Map();

  constructor(wsServer: EggWsServer, ctx: any) {
    this._server = wsServer;
    this._ctx = ctx;
    this._joinedRooms = new Set();
    this._listening = false;

    this._ctx.websocket!.on('close', () => {
      this.leave(Array.from(this._joinedRooms));
    });
  }

  private get adapter(): PubSuber | undefined {
    return this._server.adapter;
  }

  sendTo(room: string, data: ArrayBufferLike | string) {
    return this.adapter?.publish(room, data);
  }

  sendJsonTo(room: string, data: any) {
    return this.adapter?.publish(room, JSON.stringify(data));
  }

  join(rooms: string | string[], fn?: RoomHandler) {
    const adapter = this.adapter;
    if (!adapter) {
      return;
    }
    const newRooms: string[] = [];
    let handler: RoomHandler;
    if (!fn) {
      handler = this._defaultHandler;
    } else {
      handler = fn;
    }
    let roomsArray: string[];
    if (!Array.isArray(rooms)) {
      roomsArray = [rooms];
    } else {
      roomsArray = rooms;
    }
    roomsArray.forEach(room => {
      if (!this._joinedRooms.has(room)) {
        newRooms.push(room);
        this._joinedRooms.add(room);
      }
      this._roomHandlers.set(room, handler);
    });
    if (this._joinedRooms.size > 0 && !this._listening) {
      this._listening = true;
      adapter.addMessageHandler(this.onMessage);
    }
    return adapter.joinRoom(...newRooms);
  }

  leave(rooms: string | string[]) {
    if (rooms === '' || (Array.isArray(rooms) && rooms.length <= 0)) {
      return;
    }
    const adapter = this.adapter;
    if (!adapter) {
      return;
    }
    let roomsArray: string[];
    if (Array.isArray(rooms)) {
      roomsArray = rooms;
    } else if (isString(rooms)) {
      roomsArray = [rooms];
    } else {
      this._server.server.emit('error', new Error('invalid room name'));
      return;
    }
    const leaveRooms: string[] = [];
    roomsArray.forEach(room => {
      if (this._joinedRooms.has(room)) {
        leaveRooms.push(room);
        this._joinedRooms.delete(room);
      }
      this._roomHandlers.delete(room);
    });
    if (this._joinedRooms.size <= 0 && this._listening) {
      this._listening = false;
      adapter.removeMessageHandler(this.onMessage);
    }
    return adapter.leaveRoom(...leaveRooms);
  }

  private onMessage = ({
    room,
    message,
  }: {
    room: string;
    message: Buffer;
  }) => {
    const roomName = room.toString();
    const handlers = this._roomHandlers.get(roomName);
    if (handlers) {
      handlers({ room, message });
    }
  };

  private _defaultHandler = ({ message }) => {
    this._ctx.websocket!.send(message);
  };
}

// Egg Websocket Plugin
export class EggWsServer {
  static resolveController(controller, app) {
    if (isString(controller)) {
      const actions = controller.split('.');
      let obj = app.controller;
      actions.forEach(key => {
        obj = obj[key];
      });
      assert(
        isFunction(obj),
        `[egg-websocket-plugin]: controller '${controller}' not exists`
      );
      controller = obj;
    }
    // ensure controller is exists
    assert(
      isFunction(controller),
      '[egg-websocket-plugin]: controller not exists'
    );
    return controller;
  }

  server: WebSocket.Server;
  private _app: Application;
  private _adapter?: PubSuber;
  private _router = new Router();
  private _middlewares: any[];
  private _routerUsed = false;
  public clients = new Set();

  constructor(config: EggAppConfig['websocket'], app: Application) {
    this.server = new WebSocket.Server({
      noServer: true,
    });
    this._app = app;
    this._middlewares = [];
    this.server.on('error', e => {
      if (process.env['NODE_ENV'] === 'test') {
        return;
      }
      // istanbul ignore next
      app.logger.error('[egg-websocket-plugin] error: ', e.message);
    });

    if (config && config.redis) {
      this._adapter = new RedisPubSuber(config.redis);
    }

    app.on('server', server => {
      server.on('upgrade', this._upgradeHandler);
    });
  }

  private _upgradeHandler = (
    request: IncomingMessage,
    socket: Socket,
    head: Buffer
  ) => {
    // istanbul ignore next
    if (!request.url) {
      return this.notFound(socket);
    }

    const pathname = url.parse(request.url).pathname;
    const matches = this._router.match(pathname, 'GET');

    // check if the route has a handler or not
    if (!matches.route) {
      return this.notFound(socket);
    }
    const controller = this._router.routes();
    // upgrade to websocket connection
    this.server.handleUpgrade(request, socket, head, conn => {
      this.server.emit('connection', conn, request);

      const ctx = this._app.createContext(request, new ServerResponse(request));
      const expandConn: EggWsClient = conn as EggWsClient;
      ctx.websocket = expandConn;
      expandConn.room = new EggWebsocketRoom(this, ctx);
      this.clients.add(ctx);
      const closeHandler = (err?: Error) => {
        // close websocket connection
        this.clients.delete(ctx);
        if (ctx.websocket.readyState !== ctx.websocket.CLOSED) {
          ctx.websocket.close(err && WebSocketInternalError);
        }
      };
      controller(ctx)
        .then(() => {
          closeHandler();
        })
        .catch(e => {
          closeHandler(e);
          ctx.logger.error(e);
        });
    });
  };

  public get adapter(): PubSuber | undefined {
    if (!this._adapter) {
      const err = new Error(
        '[egg-websocket-plugin] redis pub/sub adapter configure not found'
      );
      this.server.emit('error', err);
    }
    return this._adapter;
  }

  use(middleware) {
    assert(
      isFunction(middleware),
      '[egg-websocket-plugin] middleware should be a function'
    );
    if (this._middlewares.includes(middleware)) {
      this._app.logger.warn(
        '[egg-websocket-plugin] same middleware has been used'
      );
      return;
    }
    if (this._routerUsed) {
      this._app.logger.warn(
        '[egg-websocket-plugin] app.ws.use should used before all app.ws.route'
      );
    }
    this._middlewares.push(middleware);
  }

  route(path, ...middleware) {
    assert(middleware.length > 0, '[egg-websocket-plugin] controller not set');
    // get last middleware as handler
    const handler = middleware.pop();
    const app = this._app;
    let controller;
    if (isString(handler)) {
      // resolve handler from app's controller
      controller = EggWsServer.resolveController(handler, app);
    } else {
      controller = handler;
    }
    this._routerUsed = true;

    // check if need to use app middlewares
    let appMiddlewares: any[] = [];
    if (
      app.config.websocket &&
      app.config.websocket.useAppMiddlewares === true
    ) {
      appMiddlewares = app.middleware;
    }

    const composedMiddleware = compose([
      ...appMiddlewares,
      ...this._middlewares,
      ...middleware,
      waitWebSocket(controller),
    ]);

    this._router.all(path, composedMiddleware);
  }

  sendTo(room: string, data: ArrayBufferLike | string) {
    return this.adapter?.publish(room, data);
  }

  sendJsonTo(room: string, data: any) {
    return this.adapter?.publish(room, JSON.stringify(data));
  }

  private notFound(socket: Socket) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  }
}

export default (app: Application) => {
  // this is not a multi clients plugin, so it won't use app.addSingleton
  app.ws = new EggWsServer(app.config.websocket, app);
};
