'use strict';
// const EventEmitter = require('events').EventEmitter;
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
        if (!obj) {
          throw new Error(
            `[egg-websocket-plugin]: controller '${controller}' not exists`
          );
        }
      });
      controller = obj;
    }
    // ensure controller is exists
    if (!controller) {
      throw new Error('[egg-websocket-plugin]: controller not exists');
    }
    return controller;
  }

  constructor(app) {
    super({
      noServer: true,
    });
    this.app = app;
    this.routes = new Map();
    this.on('error', e => {
      app.logger.error('[egg-websocket-plugin] error: ', e);
    });
  }

  route(path, ...middleware) {
    if (middleware.length <= 0) {
      throw new Error('[egg-websocket-plugin] controller not set');
    }
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
    const composedMiddleware = compose([ ...app.middleware, ...middleware ]);

    this.routes.set(path, {
      controller,
      composedMiddleware,
    });
  }

  notfound(socket) {
    socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  }
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
    const route = ws.routes.get(pathname || '/');

    // check if the route has a handler or not
    if (!route) {
      return ws.notfound(socket);
    }

    const ctx = app.createContext(
      request,
      new http.ServerResponse(request)
    );
    const { controller, composedMiddleware } = route;
    // run composed middleware
    await composedMiddleware(ctx);
    if (ctx.status !== 200) {
      return ws.notfound(socket);
    }

    // upgrade to websocket connection
    ws.handleUpgrade(request, socket, head, conn => {
      ws.emit('connection', conn, request);
      ctx.websocket = conn;
      controller.call(ctx);
    });
  };
  // add websocket upgrade event listener
  app.on('server', server => {
    server.on('upgrade', upgradeHandler);
  });
};
