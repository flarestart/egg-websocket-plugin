'use strict';

import * as http from 'http';
import { MockApplication } from 'egg-mock';
import * as WebSocket from 'ws';
import { EggWsServer } from '../app';

const assert = require('assert');
const mock = require('egg-mock');
const mockServer = require('egg-mock/lib/mock_http_server');

interface MockApp extends MockApplication {
  ws: EggWsServer;
}

let wsUrl: string;
function createWebSocket(url: string) {
  return new WebSocket(`${wsUrl}${url}`);
}

describe('test/websocket-plugin.test.ts', () => {
  let app: MockApp;
  let server: http.Server;
  before(async () => {
    app = mock.app({
      baseDir: 'apps/websocket-plugin-test',
    });
    await app.ready();
    server = mockServer(app);
    server.listen();
    const addr = server.address();
    let port = '';
    if (typeof addr === 'string') {
      throw new Error('unexpected server address');
    } else if (addr === null) {
      throw new Error('websocket server listen failed');
    } else {
      port = `${addr.port}`;
    }
    wsUrl = `ws://127.0.0.1:${port}`;
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should have app ws property', () => {
    assert(app.ws instanceof EggWsServer);
  });

  it('should have route function', () => {
    assert(typeof app.ws.route === 'function');
  });

  it('should have sendTo function', () => {
    assert(typeof app.ws.sendTo === 'function');
  });

  it('should have sendJsonTo function', () => {
    assert(typeof app.ws.sendJsonTo === 'function');
  });

  it('should throw error', () => {
    try {
      app.ws.route('/ws', null, () => {});
    } catch (e) {
      assert(e.message === 'Middleware must be composed of functions!');
    }
  });

  it('should have 404 from http request', () => {
    return app.httpRequest().get('/echo').expect(404);
  });

  it('should have 404 from websocket request', () => {
    const ws = createWebSocket('/404');
    return new Promise((resolve, reject) => {
      ws.onclose = () => {
        reject(new Error('closed'));
      };
      ws.onerror = e => {
        var err: any = e;
        if (/\b404\b/.test(err.message)) {
          return resolve();
        }
        reject(err);
      };
    });
  });

  it('echo should return same string', async () => {
    const ws = createWebSocket('/echo');
    const randValue = `${Math.random()}`;
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(randValue);
      }).on('message', msg => {
        if (msg.toString() === randValue) {
          resolve();
        } else {
          reject(new Error(''));
        }
      });
    });
    ws.close();
  });

  it('echo should return same buffer content', async () => {
    const ws = createWebSocket('/echo');
    const randValue = `${Math.random()}`;
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(Buffer.from(randValue));
      }).on('message', msg => {
        if (Buffer.isBuffer(msg) && msg.toString() === randValue) {
          resolve();
        } else {
          reject(new Error('buffer content not the same'));
        }
      });
    });
    ws.close();
  });

  it('should leave room after close', async () => {
    const ws = createWebSocket('/room');
    await new Promise((resolve, reject) => {
      ws.on('message', msg => {
        if (msg === 'room message') {
          resolve();
        } else {
          reject(new Error(msg.toString()));
        }
      }).on('close', console.log);
    });
  });

  it('should join room', async () => {
    app.ws.route('/room/join', ctx => {
      ctx.websocket.room.join(['room1', 'room2'], ({ room, message }) => {
        console.log(room, message);
      });
    });

    const ws = createWebSocket('/room/join');
    await new Promise(resolve => {
      ws.on('open', () => {
        resolve();
      });
    });
    ws.close();
  });

  it('websocket error', async () => {
    createWebSocket('/error');
  });

  it('websocket controller error', async () => {
    createWebSocket('/controller/error');
  });

  it('app.ws.route middleware should work', async () => {
    return new Promise(resolve => {
      app.ws.route(
        '/middleware',
        async (_, next) => {
          await next();
          resolve();
        },
        ctx => {
          ctx.websocket.close();
        }
      );

      createWebSocket('/middleware');
    });
  });

  it('app.ws.use should work', async () => {
    return new Promise(resolve => {
      app.ws.use(async (_, next) => {
        await next();
        resolve()
      });
      app.ws.route('/app/ws/use/middleware', (ctx) => {
        ctx.websocket.close();
      })

      createWebSocket('/app/ws/use/middleware');
    });
  });

  it('app.ws.sendJsonTo should work', async () => {
    app.ws.route('/app/ws/sendJsonTo', ctx => {
      ctx.websocket.room.join('app/sendJsonTo');
      ctx.app.ws.sendJsonTo('app/sendJsonTo', { foo: 'bar' });
    });
    return new Promise((resolve, reject) => {
      const ws = createWebSocket('/app/ws/sendJsonTo');
      ws.on('message', msg => {
        if (msg === '{"foo":"bar"}') {
          resolve();
        } else {
          reject(new Error(msg.toString()));
        }
      });
    });
  });

  it('ctx.websocket.room.sendTo should work', async () => {
    const randValue = `${Math.random()}`;
    app.ws.route('/ctx/room/sendTo', ctx => {
      ctx.websocket.room.join('ctx/sendTo');
      ctx.websocket.room.sendTo('ctx/sendTo', randValue);
    });
    return new Promise((resolve, reject) => {
      const ws = createWebSocket('/ctx/room/sendTo');
      ws.on('message', msg => {
        if (msg === randValue) {
          resolve();
        } else {
          reject(new Error(msg.toString()));
        }
      });
    });
  });

  it('ctx.websocket.room.sendJsonTo should work', async () => {
    const randValue = `${Math.random()}`;
    app.ws.route('/ctx/room/sendJsonTo', ctx => {
      ctx.websocket.room.join('ctx/sendJsonTo');
      ctx.websocket.room.sendJsonTo('ctx/sendJsonTo', { foo: randValue });
    });
    return new Promise((resolve, reject) => {
      const ws = createWebSocket('/ctx/room/sendJsonTo');
      ws.on('message', msg => {
        if (msg === `{"foo":"${randValue}"}`) {
          resolve();
        } else {
          reject(new Error(msg.toString()));
        }
      });
    });
  });
});
