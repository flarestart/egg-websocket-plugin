'use strict';
const assert = require('assert');
const ws = require('ws');
const compose = require('koa-compose');
const url = require('url');
const http = require('http');

// Egg Websocket Plugin
class EggWebsocket extends ws.Server {
  static resolveController(controller, app) {
    if (typeof controller === 'string') {
      const actions = controller.split('.');
      let obj = app.controller;
      actions.forEach(key => {
        obj = obj[key];
        assert(
          typeof obj === 'function',
          `[egg-websocket-plugin]: controller '${controller}' not exists`
        );
      });
      controller = obj;
    }
    // ensure controller is exists
    assert(
      typeof controller === 'function',
      '[egg-websocket-plugin]: controller not exists'
    );
    return controller;
  }

  constructor(app) {
    super({
      noServer: true,
    });
    this.app = app;
    this.routes = new Map();
    this.middlewares = [];
    this.on('error', e => {
      app.logger.error('[egg-websocket-plugin] error: ', e);
    });
  }

  use(middleware) {
    assert(
      typeof middleware === 'function',
      '[egg-websocket-plugin] middleware should be a function'
    );
    if (this.middlewares.includes(middleware)) {
      return;
    }
    this.middlewares.push(middleware);
  }

  route(path, ...middleware) {
    assert(middleware.length > 0, '[egg-websocket-plugin] controller not set');
    // get last middleware as handler
    const handler = middleware.pop();
    let controller;
    if (typeof handler === 'string') {
      // resolve handler from app's controller
      controller = EggWebsocket.resolveController(handler, this.app);
    } else {
      controller = handler;
    }
    const app = this.app;
    const composedMiddleware = compose([
      ...app.middleware,
      ...this.middlewares,
      ...middleware,
      waitWebSocket(controller),
    ]);

    this.routes.set(path, composedMiddleware);
  }

  notfound(socket) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  }
}

// 运行 controller 并等待退出
function waitWebSocket(controller) {
  return ctx => {
    return new Promise((resolve, reject) => {
      ctx.websocket.on('close', resolve);
      ctx.websocket.on('error', reject);
      // todo 错误处理
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

module.exports = app => {
  const ws = new EggWebsocket(app);
  // add ws object to app
  app.ws = ws;

  const upgradeHandler = async (request, socket, head) => {
    if (!request.url) {
      return ws.notfound(socket);
    }

    const pathname = url.parse(request.url).pathname;
    const controller = ws.routes.get(pathname || '/');

    // check if the route has a handler or not
    if (!controller) {
      return ws.notfound(socket);
    }

    // upgrade to websocket connection
    ws.handleUpgrade(request, socket, head, async conn => {
      ws.emit('connection', conn, request);
      const ctx = app.createContext(request, new http.ServerResponse(request));
      ctx.websocket = conn;
      try {
        await controller(ctx);
      } catch (e) {
        // close websocket connection
        if (!ctx.websocket.CLOSED) {
          ctx.websocket.close();
        }
        ctx.onerror(e);
      }
    });
  };
  // add websocket upgrade event listener
  app.on('server', server => {
    server.on('upgrade', upgradeHandler);
  });
};
