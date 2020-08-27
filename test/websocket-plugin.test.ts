'use strict';

import * as http from 'http';
import { MockApplication } from 'egg-mock';
import * as WebSocketClient from 'ws';
import { EggWsServer } from '../app';

const assert = require('assert');
const mock = require('egg-mock');
const mockServer = require('egg-mock/lib/mock_http_server');

interface MockApp extends MockApplication {
  ws: EggWsServer;
}

describe('test/websocket-plugin.test.js', () => {
  let app: MockApp;
  let server: http.Server;
  let wsUrl: string;
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

  it('should have 404 from websocket request', done => {
    let ws: WebSocketClient;
    let closed = false;
    const close = (err?: Error) => {
      if (closed) {
        return;
      }
      closed = true;
      done(err);
      if (ws) {
        ws.close();
      }
    };
    ws = new WebSocketClient(`${wsUrl}/404`);
    ws.onclose = () => {
      close(new Error('closed'));
    };
    ws.onerror = e => {
      var err: any = e;
      if (/\b404\b/.test(err.message)) {
        return close();
      }
      close(err);
    };
  });

  it('echo should return same string', async () => {
    const ws = new WebSocketClient(`${wsUrl}/echo`);
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
    const ws = new WebSocketClient(`${wsUrl}/echo`);
    const randValue = `${Math.random()}`;
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(Buffer.from(randValue));
      }).on('message', msg => {
        if (Buffer.isBuffer(msg) && msg.toString() === randValue) {
          resolve();
        } else {
          reject(new Error('buffer content not the same'))
        }
      });
    });
    ws.close();
  });

  it('auto close', async () => {
    const ws = new WebSocketClient(`${wsUrl}/room`);
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
});
