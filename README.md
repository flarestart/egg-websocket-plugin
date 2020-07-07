# egg-websocket-plugin

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/egg-websocket-plugin.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-websocket-plugin
[travis-image]: https://img.shields.io/travis/eggjs/egg-websocket-plugin.svg?style=flat-square
[travis-url]: https://travis-ci.org/eggjs/egg-websocket-plugin
[codecov-image]: https://img.shields.io/codecov/c/github/eggjs/egg-websocket-plugin.svg?style=flat-square
[codecov-url]: https://codecov.io/github/eggjs/egg-websocket-plugin?branch=master
[david-image]: https://img.shields.io/david/eggjs/egg-websocket-plugin.svg?style=flat-square
[david-url]: https://david-dm.org/eggjs/egg-websocket-plugin
[snyk-image]: https://snyk.io/test/npm/egg-websocket-plugin/badge.svg?style=flat-square
[snyk-url]: https://snyk.io/test/npm/egg-websocket-plugin
[download-image]: https://img.shields.io/npm/dm/egg-websocket-plugin.svg?style=flat-square
[download-url]: https://npmjs.org/package/egg-websocket-plugin

<!--
Description here.
-->

## 依赖说明

### 依赖的 egg 版本

✅ egg 2.x

## 使用方式

```bash
yarn add egg-websocket-plugin
```

### 1. 开启插件

```js
// config/plugin.js
exports.websocket = {
  enable: true,
  package: 'egg-websocket-plugin',
};
```

### 2. 配置 WebSocket 路由

```js
// app/router.js
app.ws.route('/ws', app.controller.home.hello);

// 可使用路由参数，使用方式同 egg 自身路由
app.ws.route('/foo/:id', app.controller.home.foo);
```

### 3. 配置全局中间件【可选】

```js
// app/router.js

// 配置 WebSocket 全局中间件
app.ws.use((ctx, next) => {
  console.log('websocket open');
  await next();
  console.log('websocket closed');
});
```

### 4. 配置路由中间件【可选】

**路由会依次用到 app.use, app.ws.use, 以及 app.ws.router 中配置的中间件**

```js
// app/router.js
function middleware(ctx, next) {
  console.log('open', ctx.starttime);
  return next();
}
// 配置路由中间件
app.ws.route('/ws', middleware, app.controller.home.hello);
```

### 5. 禁用 app 全局中间件

> 插件默认会使用 app.use(...) 注册的中间件，如果你不想使用它们，或者这些插件与 websocket 有冲突，你可以在 `config.default.js` 中禁用它们

```js
config.websocket = {
  useAppMiddlewares: false,
};
```

### 6. 在控制器中使用 websocket

websocket 是一个 `ws` 插件的实例，可阅读 [ws](https://www.npmjs.com/package/ws) 插件的说明文档或 TypeScript 的定义

```js
// app/controller/home.js
import { Controller } from 'egg';

export default class HomeController extends Controller {
  async hello() {
    const { ctx, app } = this;
    if (!ctx.websocket) {
      throw new Error('this function can only be use in websocket router');
    }

    console.log(`clients: ${app.ws.clients.size}`);

    ctx.websocket
      .on('message', (msg) => {
        console.log('receive', msg);
      })
      .on('close', (code, reason) => {
        console.log('websocket closed', code, reason);
      });
  }
}

```



## 使用场景

- 使用 egg 开发标准 WebSocket 服务器
- 微信小程序 WebSocket 服务器

## 特性支持

- [x] 兼容 egg 自身的 controller
- [x] 兼容 egg 路由中间件
- [x] 不需要像 socket.io 一样开启 `sticky` 模式
- [ ] 多进程时的消息通讯

## 详细配置

请到 [config/config.default.js](config/config.default.js) 查看详细配置项说明。

## 单元测试

因 egg 本身单元测试对 WebSocket 支持有限，因此，暂不支持使用 egg-mock 进行单元测试

## 提问交流

请到 [issues](https://github.com/flarestart/egg-websocket-plugin/issues) 异步交流。

## License

[MIT](LICENSE)