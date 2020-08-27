'use strict';

import * as http from 'http';
import { MockApplication } from 'egg-mock';
import * as WebSocket from 'ws';
import { EggWsServer } from '../app';

// const assert = require('assert');
const mock = require('egg-mock');
const mockServer = require('egg-mock/lib/mock_http_server');

interface MockApp extends MockApplication {
  ws: EggWsServer;
}

let wsUrl: string;
function WebSocketClient(url: string) {
  return new WebSocket(`${wsUrl}${url}`);
}

describe('test/websocket-plugin.test.js', () => {
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

  it('websocket error', async () => {
    WebSocketClient('/error');
  });

  it('websocket controller error', async () => {
    app.ws.use(async (_, next) => {
      try {
        await next();
      } catch (e) {}
    });
    WebSocketClient('/controller/error');
  });

  it('websocket controller error', async () => {
    app.ws.use(async (ctx, next) => {
      console.log(ctx.headers);
      await next();
    });
  });

  it('join room', async () => {
    app.ws.route('/room/join', ctx => {
      ctx.websocket.room.join(['room1', 'room2'], ({ room, message }) => {
        console.log(room, message);
      });
    });

    const ws = WebSocketClient('/room/join');
    await new Promise(resolve => {
      ws.on('open', () => {
        resolve();
      });
    });
    ws.close();
  });
});
