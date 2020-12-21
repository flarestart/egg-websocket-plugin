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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('test/websocket-plugin.test.ts', () => {
  let app: MockApp;
  let server: http.Server;
  let wsUrl: string;
  function NewTestWebSocket(url: string) {
    return new WebSocket(`${wsUrl}${url}`);
  }

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

  after(async () => {
    // wait for last test connection close
    await sleep(1000);
    app.close();
  });
  afterEach(mock.restore);

  it('should have app.ws property', () => {
    assert(app.ws instanceof EggWsServer);
  });

  it('should have app.ws.route function', () => {
    assert(typeof app.ws.route === 'function');
  });

  it('should have app.ws.sendTo function', () => {
    assert(typeof app.ws.sendTo === 'function');
  });

  it('should have app.ws.sendJsonTo function', () => {
    assert(typeof app.ws.sendJsonTo === 'function');
  });

  it('app.ws.route should work', async () => {
    await new Promise<void>(resolve => {
      const randString = `${Math.random()}`;
      app.ws.route('/echo', 'home.echo');

      const ws = NewTestWebSocket('/echo');
      ws.on('message', data => {
        assert(data.toString() === randString);
        resolve();
      });
      ws.on('open', () => {
        ws.send(randString);
      });
    });
  });

  it('ctx should have websocket instance', () => {
    return new Promise<void>(resolve => {
      app.ws.route('/ctx/sendJsonTo', ctx => {
        assert(ctx.websocket instanceof WebSocket);
        resolve();
      });

      const ws = NewTestWebSocket('/ctx/sendJsonTo');
      ws.on('open', () => {
        ws.close();
      });
    });
  });

  it('should throw error', () => {
    try {
      app.ws.route('/ws', null, () => {});
    } catch (e) {
      assert(e.message === 'Middleware must be composed of functions!');
    }
  });

  it('websocket route should have 404 from http request', () => {
    return app.httpRequest().get('/echo').expect(404);
  });

  it('should have 404 from websocket request', () => {
    const ws = NewTestWebSocket('/404');
    return new Promise<void>((resolve, reject) => {
      ws.onclose = () => {
        reject(new Error('closed'));
      };
      ws.onerror = e => {
        assert(/\b404\b/.test(e.message));
        resolve();
      };
    });
  });

  it('echo should return same string', async () => {
    const ws = NewTestWebSocket('/echo');
    const randValue = `${Math.random()}`;
    await new Promise<void>(resolve => {
      ws.on('open', () => {
        ws.send(randValue);
      }).on('message', msg => {
        assert(msg.toString() === randValue);
        resolve();
      });
    });
    ws.close();
  });

  it('echo should return same buffer content', async () => {
    const ws = NewTestWebSocket('/echo');
    const randValue = `${Math.random()}`;
    await new Promise<void>(resolve => {
      ws.on('open', () => {
        ws.send(Buffer.from(randValue));
      }).on('message', msg => {
        assert(Buffer.isBuffer(msg) && msg.toString() === randValue);
        resolve();
      });
    });
    ws.close();
  });

  it('should join room', async () => {
    app.ws.route('/room/join', ctx => {
      ctx.websocket.room.join(['room1', 'room2'], ({ room, message }) => {
        assert(room === 'room1' && message === 'hello');
      });
      ctx.websocket.room.sendTo('room1', 'hello');
    });

    const ws = NewTestWebSocket('/room/join');
    await new Promise<void>(resolve => {
      ws.on('open', () => {
        resolve();
      });
    });
    ws.close();
  });

  it('join and leave', async () => {
    const roomName = 'joinAndLeave';
    app.ws.route('/room/joinAndLeave', ctx => {
      ctx.websocket.room.join(roomName, ({ message }) => {
        ctx.websocket.room.leave(roomName);
        ctx.websocket.send(message);
      });
      app.ws.sendTo(roomName, Buffer.from('hello'));
    });

    const ws = NewTestWebSocket('/room/joinAndLeave');
    await new Promise<void>(resolve => {
      ws.on('open', () => {
        ws.send(JSON.stringify(['join', roomName]));
      }).on('message', m => {
        assert(m.toString() === 'hello');
        resolve();
      });
    });
    ws.close();
  });

  it('leave invalid room', async () => {
    const roomName = 1;
    app.ws.route('/room/invalid', ctx => {
      ctx.websocket.room.leave(roomName);
    });

    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('invalid room'));
        resolve();
      });
      const client = NewTestWebSocket('/room/invalid');
      client.on('open', () => {
        client.close();
      });
    });
  });

  it('websocket controller error', async () => {
    app.ws.route('/controller/error', () => {
      throw new Error('controller error');
    });

    const ws = NewTestWebSocket('/controller/error');
    await new Promise<void>(resolve => {
      ws.on('close', code => {
        assert(code === 1011);
        resolve();
      });
    });
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

      NewTestWebSocket('/middleware');
    });
  });

  it('app.ws.use should work', async () => {
    await new Promise<void>(resolve => {
      app.ws.use(async (ctx, next) => {
        ctx.wsTest = 'hello';
        await next();
      });
      app.ws.route('/app/ws/use/middleware', ctx => {
        ctx.websocket.close();
        assert((ctx.wsTest = 'hello'));
        resolve();
      });

      NewTestWebSocket('/app/ws/use/middleware');
    });
  });

  it('app.ws.use should ignore same middleware', async () => {
    let counter = 0;
    const middleware = async (_, next) => {
      counter++;
      await next();
    };
    app.ws.use(middleware);
    app.ws.use(middleware);
    app.ws.route('/app/ws/use/samemiddleware', ctx => {
      ctx.websocket.close();
    });

    const ws = NewTestWebSocket('/app/ws/use/samemiddleware');
    await new Promise<void>(resolve => {
      ws.on('open', () => {
        resolve();
      });
    });
    assert(counter === 1);
  });

  it('app.ws.sendJsonTo should work', async () => {
    app.ws.route('/app/ws/sendJsonTo', ctx => {
      ctx.websocket.room.join('app/sendJsonTo');
      ctx.app.ws.sendJsonTo('app/sendJsonTo', { foo: 'bar' });
    });
    const ws = NewTestWebSocket('/app/ws/sendJsonTo');
    await new Promise<void>(resolve => {
      ws.on('message', msg => {
        assert(msg === JSON.stringify({ foo: 'bar' }));
        resolve();
      });
    });
    ws.close();
  });

  it('ctx.websocket.room.sendTo should work', async () => {
    const randValue = `${Math.random()}`;
    app.ws.route('/ctx/room/sendTo', ctx => {
      ctx.websocket.room.join('ctx/sendTo');
      ctx.websocket.room.sendTo('ctx/sendTo', randValue);
    });
    const ws = NewTestWebSocket('/ctx/room/sendTo');
    await new Promise<void>(resolve => {
      ws.on('message', msg => {
        assert(msg === randValue);
        resolve();
      });
    });
    ws.close();
  });

  it('ctx.websocket.room.sendJsonTo should work', async () => {
    const randValue = `${Math.random()}`;
    app.ws.route('/ctx/room/sendJsonTo', ctx => {
      ctx.websocket.room.join('ctx/sendJsonTo');
      ctx.websocket.room.sendJsonTo('ctx/sendJsonTo', { foo: randValue });
    });
    const ws = NewTestWebSocket('/ctx/room/sendJsonTo');
    await new Promise<void>(resolve => {
      ws.on('message', msg => {
        assert(msg === JSON.stringify({ foo: randValue }));
        resolve();
      });
    });
    ws.close();
  });

  it('two connections join same room', async () => {
    const randValue = `${Math.random()}`;
    app.ws.route('/ctx/room/twoConnections', ctx => {
      ctx.websocket.room.join('ctx/twoConnections');
      ctx.websocket.room.sendJsonTo('ctx/twoConnections', { foo: randValue });
    });
    const ws1 = NewTestWebSocket('/ctx/room/twoConnections');
    const ws2 = NewTestWebSocket('/ctx/room/twoConnections');
    await Promise.all([
      new Promise<void>(resolve => {
        ws1.on('message', msg => {
          assert(msg === JSON.stringify({ foo: randValue }));
          resolve();
        });
      }),
      new Promise<void>(resolve => {
        ws2.on('message', msg => {
          assert(msg === JSON.stringify({ foo: randValue }));
          resolve();
        });
      }),
    ]);
    ws1.close();
    ws2.close();
  });
});
