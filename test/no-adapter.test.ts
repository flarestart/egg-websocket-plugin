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

describe('test/no-adapter.test.ts', () => {
  let app: MockApp;
  let server: http.Server;
  let wsUrl: string;
  function NewTestWebSocket(url: string) {
    return new WebSocket(`${wsUrl}${url}`);
  }

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

  it('should not use room.join without adapter', async () => {
    const url = '/no-adapter/room/join';
    app.ws.route(url, ctx => {
      ctx.websocket.room.join('room1');
    });
    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('adapter configure not found'));
        resolve();
      });
      const client = NewTestWebSocket(url);
      client.on('open', () => {
        client.close();
      });
    });
  });

  it('should not use room.leave without adapter', async () => {
    const url = '/no-adapter/room/leave';
    app.ws.route(url, ctx => {
      ctx.websocket.room.leave('room1');
    });
    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('adapter configure not found'));
        resolve();
      });
      const client = NewTestWebSocket(url);
      client.on('open', () => {
        client.close();
      });
    });
  });

  it('should not use app.sendTo without adapter', async () => {
    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('adapter configure not found'));
        resolve();
      });
      app.ws.sendTo('room1', 'hello');
    });
  });

  it('should not use app.sendJsonTo without adapter', async () => {
    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('adapter configure not found'));
        resolve();
      });
      app.ws.sendJsonTo('room1', 'hello');
    });
  });

  it('should not use ctx.room.sendTo without adapter', async () => {
    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('adapter configure not found'));
        resolve();
      });
      app.ws.sendJsonTo('room1', 'hello');
    });
  });

  it('should not use ctx.room.sendTo without adapter', async () => {
    const url = '/no-adapter/room/sendTo';
    app.ws.route(url, ctx => {
      ctx.websocket.room.sendTo('room1', 'hello');
    });
    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('adapter configure not found'));
        resolve();
      });
      const client = NewTestWebSocket(url);
      client.on('open', () => {
        client.close();
      });
    });
  });


  it('should not use ctx.room.sendJsonTo without adapter', async () => {
    const url = '/no-adapter/room/sendJsonTo';
    app.ws.route(url, ctx => {
      ctx.websocket.room.sendJsonTo('room1', 'hello');
    });
    await new Promise<void>(resolve => {
      app.ws.server.once('error', e => {
        assert(e.message.includes('adapter configure not found'));
        resolve();
      });
      const client = NewTestWebSocket(url);
      client.on('open', () => {
        client.close();
      });
    });
  });
});
