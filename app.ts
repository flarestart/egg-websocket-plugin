import * as assert from 'assert';
import * as compose from 'koa-compose';
import * as url from 'url';
import * as WebSocket from 'ws';
import * as Router from '@eggjs/router';
import { Socket } from 'net';
import { Application } from 'egg';
import { RedisPubSuber } from './adapter/redis';
const http = require('http');

function isFunction(v: any) {
  return typeof v === 'function';
}

function isString(v: any) {
  return typeof v === 'string';
}

export interface EggWsClient extends WebSocket {
  room: EggWebsocketRoom;
}

let PubSubAdapter: PubSuber | undefined;

function getAdapter(): PubSuber {
  if (!PubSubAdapter) {
    throw new Error('[egg-websocket-plugin] no pub/sub adapter configure');
  }
  return PubSubAdapter;
}

export interface PubSuber {
  publish(room: string, message: any): void;
  addMessageHandler(listener: Function): void;
  removeMessageHandler(listener: Function): void;
  joinRoom(...rooms: string[]): Promise<number>;
  leaveRoom(...rooms: string[]): Promise<number>;
}

export class EggWebsocketRoom {
  conn: WebSocket;
  socket: Socket;
  ws: EggWsServer;
  joinedRooms: Set<string>;
  listening: boolean;
  beforeSend?: (params: {
    type: 'binary' | 'string' | 'unknown';
    room: string;
    message: ArrayBufferLike | string;
  }) => any;

  constructor(ws: EggWsServer, conn: WebSocket, socket: Socket) {
    this.conn = conn;
    this.socket = socket;
    this.ws = ws;
    this.joinedRooms = new Set();
    this.listening = false;

    this.conn.on('close', () => {
      this.leave(...Array.from(this.joinedRooms));
    });
  }

  sendTo(room: string, data: ArrayBufferLike | string) {
    const adapter = getAdapter();
    return adapter.publish(room, data);
  }

  join(...rooms: string[]) {
    const adapter = getAdapter();
    const newRooms: string[] = [];
    rooms.forEach(room => {
      if (!this.joinedRooms.has(room)) {
        newRooms.push(room);
        this.joinedRooms.add(room);
      }
    });
    if (this.joinedRooms.size > 0 && !this.listening) {
      this.listening = true;
      adapter.addMessageHandler(this.onMessage);
    }
    return adapter.joinRoom(...newRooms);
  }

  leave(...rooms: string[]) {
    const adapter = getAdapter();
    const leaveRooms: string[] = [];
    rooms.forEach(room => {
      if (this.joinedRooms.has(room)) {
        leaveRooms.push(room);
        this.joinedRooms.delete(room);
      }
    });
    if (this.joinedRooms.size <= 0 && this.listening) {
      this.listening = false;
      adapter.removeMessageHandler(this.onMessage);
    }
    return adapter.leaveRoom(...leaveRooms);
  }

  private onMessage = ({
    type,
    room,
    message,
  }: {
    type: 'string' | 'binary' | 'unknown';
    room: string;
    message: Buffer;
  }) => {
    const roomName = room.toString();

    if (this.joinedRooms.has(roomName)) {
      if (typeof this.beforeSend === 'function') {
        if (this.beforeSend({ type, room: roomName, message }) === false) {
          return;
        }
      }
      this.conn.send(message);
    }
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
  app: Application;
  private _router: Router = new Router();
  private _middlewares: any[];

  constructor(app: Application) {
    this.server = new WebSocket.Server({
      noServer: true,
    });
    this.app = app;
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

      const ctx = this.app.createContext(
        request,
        new http.ServerResponse(request)
      );
      const expandConn: EggWsClient = (conn as unknown) as EggWsClient;
      expandConn.room = new EggWebsocketRoom(this, conn, socket);
      ctx.websocket = expandConn;
      controller(ctx).catch(e => {
        // close websocket connection
        if (!ctx.websocket.CLOSED) {
          ctx.websocket.close();
        }
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
    const app = this.app;
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
    getAdapter().publish(room, data);
  }

  private notFound(socket: Socket) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  }
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

export default (app: Application) => {
  new EggWsServer(app);
};
