'use strict';

const assert = require('assert');
const mock = require('egg-mock');
const ws = require('ws');

describe('test/websocket-plugin.test.js', () => {
  let app;
  before(() => {
    app = mock.app({
      baseDir: 'apps/websocket-plugin-test',
    });
    return app.ready();
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should have app ws property', () => {
    assert(app.ws instanceof ws.Server);
  });

  it('should have route function', () => {
    assert(typeof app.ws.route === 'function');
  });

  it('should have 404 from http request ', () => {
    app.ws.route('/ws', ctx => {
      ctx.websocket.close();
    });
    return app
      .httpRequest()
      .get('/ws')
      .expect(404);
  });
});
