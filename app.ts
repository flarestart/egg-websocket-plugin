import * as assert from 'assert';
import * as compose from 'koa-compose';
import * as url from 'url';
import * as WebSocket from 'ws';
import * as Router from '@eggjs/router';
import { Socket } from 'net';
import { Application } from 'egg';
import { RedisPubSuber } from './adapter/redis';
const http = require('http');

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

let PubSubAdapter: PubSuber | undefined;

function isFunction(v: any) {
  return typeof v === 'function';
}

function isString(v: any) {
  return typeof v === 'string';
}

function getAdapter(): PubSuber {
  if (!PubSubAdapter) {
    throw new Error('[egg-websocket-plugin] no pub/sub adapter configure');
  }
  return PubSubAdapter;
}

// 运行 controller 并等待退出
function waitWebSocket(controller) {
  return ctx => {
    return new Promise((resolve, reject) => {
      ctx.websocket.on('close', resolve);
      ctx.websocket.on('error', reject);
      try {
        const ret = controller.call(ctx);
        if (ret instanceof Promise) {
          ret.catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  };
}

export class EggWebsocketRoom {
  private _conn: WebSocket;
  private _joinedRooms: Set<string>;
  private _listening: boolean;
  private _roomHandlers: Map<string, RoomHandler> = new Map();

  constructor(conn: WebSocket) {
    this._conn = conn;
    this._joinedRooms = new Set();
    this._listening = false;

    this._conn.on('close', () => {
      this.leave(Array.from(this._joinedRooms));
    });
  }

  sendTo(room: string, data: ArrayBufferLike | string) {
    return getAdapter().publish(room, data);
  }

  sendJsonTo(room: string, data: any) {
    return getAdapter().publish(room, JSON.stringify(data));
  }

  join(rooms: string | string[], fn?: RoomHandler) {
    const adapter = getAdapter();
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
    const adapter = getAdapter();
    const leaveRooms: string[] = [];
    let roomsArray: string[];
    if (!Array.isArray(rooms)) {
      roomsArray = [rooms];
    } else {
      roomsArray = rooms;
    }
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
    this._conn.send(message);
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
        assert(
          isFunction(obj),
          `[egg-websocket-plugin]: controller '${controller}' not exists`
        );
      });
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
  private _router: Router = new Router();
  private _middlewares: any[];

  constructor(app: Application) {
    this.server = new WebSocket.Server({
      noServer: true,
    });
    this._app = app;
    this._middlewares = [];
    this.server.on('error', e => {
      app.logger.error('[egg-websocket-plugin] error: ', e);
    });

    if (app.config.websocket && app.config.websocket.redis) {
      PubSubAdapter = new RedisPubSuber(app.config.websocket.redis);
    }

    // add ws object to app
    app.ws = (this as unknown) as any;
    app.on('server', server => {
      server.on('upgrade', this._upgradeHandler);
    });
  }

  private _upgradeHandler = (request, socket, head) => {
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

      const ctx = this._app.createContext(
        request,
        new http.ServerResponse(request)
      );
      const expandConn: EggWsClient = (conn as unknown) as EggWsClient;
      expandConn.room = new EggWebsocketRoom(conn);
      ctx.websocket = expandConn;
      const closeHandler = () => {
        // close websocket connection
        if (ctx.websocket.readyState !== ctx.websocket.CLOSED) {
          ctx.websocket.close();
        }
      };
      controller(ctx)
        .then(closeHandler)
        .catch(e => {
          closeHandler();
          ctx.onerror(e);
        });
    });
  };

  use(middleware) {
    assert(
      isFunction(middleware),
      '[egg-websocket-plugin] middleware should be a function'
    );
    if (this._middlewares.includes(middleware)) {
      return;
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
    return getAdapter().publish(room, data);
  }

  sendJsonTo(room: string, data: any) {
    return getAdapter().publish(room, JSON.stringify(data));
  }

  private notFound(socket: Socket) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  }
}

export default (app: Application) => {
  new EggWsServer(app);
};
