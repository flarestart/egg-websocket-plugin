'use strict';

async function auth(ctx, next) {
  await next();
}

module.exports = app => {
  const { router, controller } = app;

  router.get('/', controller.home.index);
  app.ws.route('/echo', 'home.echo');
  app.ws.route('/auth', auth, controller.home.echo);
  app.ws.route('/room', controller.home.room);
  app.ws.route('/error', ctx => {
    // throw new Error('controller error');
    ctx.body = 'wow';
  });
  app.ws.route('/controller/error', () => {
    throw new Error('controller error');
  });
};
