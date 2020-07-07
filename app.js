'use strict';
const assert = require('assert');
const ws = require('ws');
const compose = require('koa-compose');
const url = require('url');
const http = require('http');
const Router = require('@eggjs/router');

function isFunction(fn) {
  return typeof fn === 'function';
}

function isString(str) {
  return typeof str === 'string';
}

// Egg Websocket Plugin
class EggWebsocket extends ws.Server {
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

  constructor(app) {
    super({
      noServer: true,
    });
    this.app = app;
    this.router = new Router();
    this.middlewares = [];
    this.on('error', e => {
      app.logger.error('[egg-websocket-plugin] error: ', e);
    });
  }

  use(middleware) {
    assert(
      isFunction(middleware),
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
    if (isString(handler)) {
      // resolve handler from app's controller
      controller = EggWebsocket.resolveController(handler, this.app);
    } else {
      controller = handler;
    }
    const app = this.app;

    // check if need to use app middlewares
    let appMiddlewares = [];
    if (
      app.config.websocket &&
      app.config.websocket.useAppMiddlewares === true
    ) {
      appMiddlewares = app.middleware;
    }

    const composedMiddleware = compose([
      ...appMiddlewares,
      ...this.middlewares,
      ...middleware,
      waitWebSocket(controller),
    ]);

    this.router.all(path, composedMiddleware);
  }

  notFound(socket) {
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

module.exports = app => {
  const ws = new EggWebsocket(app);
  // add ws object to app
  app.ws = ws;

  const upgradeHandler = (request, socket, head) => {
    if (!request.url) {
      return ws.notFound(socket);
    }

    const pathname = url.parse(request.url).pathname;
    const matches = ws.router.match(pathname, 'GET');

    // check if the route has a handler or not
    if (!matches.route) {
      return ws.notFound(socket);
    }
    const controller = ws.router.routes();
    // upgrade to websocket connection
    ws.handleUpgrade(request, socket, head, conn => {
      ws.emit('connection', conn, request);
      const ctx = app.createContext(request, new http.ServerResponse(request));
      ctx.websocket = conn;
      controller(ctx).catch(e => {
        // close websocket connection
        if (!ctx.websocket.CLOSED) {
          ctx.websocket.close();
        }
        ctx.onerror(e);
      });
    });
  };
  // add websocket upgrade event listener
  app.on('server', server => {
    server.on('upgrade', upgradeHandler);
  });
};
