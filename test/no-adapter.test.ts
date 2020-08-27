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
function createWebSocket(url: string) {
  return new WebSocket(`${wsUrl}${url}`);
}

describe('test/no-adapter.test.ts', () => {
  let app: MockApp;
  let server: http.Server;
  before(async () => {
    app = mock.app({
      baseDir: 'apps/websocket-plugin-no-adapter-test',
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

  it('should not use room functions', async () => {
    app.ws.route('/no-adapter/room', ctx => {
      ctx.websocket.room.join('room1');
    });
    createWebSocket('/no-adapter/room');
  });
});
