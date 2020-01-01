'use strict';

const assert = require('assert');
import mock, { MockApplication } from 'egg-mock';

interface App extends MockApplication {
  ws?: any;
}

describe('test/websocket-plugin.test.js', () => {
  let app: App;
  before(() => {
    app = mock.app({
      baseDir: 'apps/websocket-plugin-test',
    });
    return app.ready();
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should has app ws property', () => {
    app.ws.route('/websocket', (ctx) => {console.log(ctx)});
    assert(typeof app.ws.route === 'function');
  });
});
