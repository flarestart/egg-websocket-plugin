# egg-websocket-plugin

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/egg-websocket-plugin.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-websocket-plugin
[travis-image]: https://img.shields.io/travis/flarestart/egg-websocket-plugin.svg?style=flat-square
[travis-url]: https://travis-ci.org/flarestart/egg-websocket-plugin
[codecov-image]: https://img.shields.io/codecov/c/github/flarestart/egg-websocket-plugin.svg?style=flat-square
[codecov-url]: https://codecov.io/github/flarestart/egg-websocket-plugin?branch=master
[david-image]: https://img.shields.io/david/flarestart/egg-websocket-plugin.svg?style=flat-square
[david-url]: https://david-dm.org/flarestart/egg-websocket-plugin
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



## 特性支持

- [x] 兼容 egg 自身的 controller
- [x] 兼容 egg 路由中间件
- [x] 不需要像 socket.io 一样开启 `sticky` 模式
- [x] 支持消息广播订阅



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

### 3. 配置 WebSocket 全局中间件【可选】

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

### 5. 禁用 App 全局中间件

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

    console.log('client connected');

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



## 支持 Redis 消息发布订阅【可选】

### 开启消息广播

**注意**：`egg-websocket-plugin` 依赖于 `ioredis` 但可与其他插件如 `egg-redis` 共用一个 `ioredis` 依赖

开启广播相关的 API 需要在 config.default.js 中配置 `redis` 连接，配置项可参见 [ioredis](https://www.npmjs.com/package/ioredis)

```typescript
config.websocket = {
  // 配置 websocket 使用 redis 作消息广播，配置项目参见 ioredis
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
};
```

### 房间消息广播 API

> 开启 redis 配置后，即可使用下面的广播 API

#### 1. app.ws.sendTo(room, data)

> 发送消息到某个房间，将 data 原样发送到客户端连接

- `room` &lt;string&gt;: 房间名
- `data` &lt;string | Buffer&gt;: 发送内容，原样发送

#### 2. app.ws.sendJsonTo(room, data)

> 发送消息到某个房间，会自动使用 JSON.stringify 对 data 进行序列化

- `room` &lt;string&gt; 房间名
- `data` &lt;any&gt; 发送内容，可进行 JSON 序列化的任意对象

#### 3. ctx.websocket.room.join(room, fn?)
> 将当前连接加入房间

- `room` &lt;string&gt; 要加入的房间名
- `fn` &lt;function({room, message})&gt; 可选参数，用于配置房间消息处理函数，配置详情见 [自定义房间消息处理函数](#roomhandler)
  - `room` &lt;string&gt; 消息所属房间名
  - `message`<string | Buffer> 房间内的广播消息，消息类型取决于 `sendTo()` 发送时的类型
  - 忽略此参数，则该房间的消息将直接发送到客户端连接
  - 配置这个参数，则可以手动处理消息发送逻辑，不再自动将房间内的消息发送到客户端连接

#### 4. ctx.websocket.room.leave(room)
> 当前连接离开房间，当前连接关闭后，将自动退出当前连接加入过的房间，因此关闭连接前无需要手动离开房间

- `room` &lt;string&gt; 房间名

#### 5. ctx.websocket.room.sendTo(room, data)

> 发送消息到某个房间，将 data 原样发送到客户端连接，功能与 app.ws.sendTo 相同

#### 6. ctx.websocket.room.sendJsonTo(room, data)

> 发送消息到某个房间，会自动使用 JSON.stringify 对 data 进行序列化，功能与 `app.ws.sendTo` 相同



```typescript
// 当前连接加入房间 foo，收到房间的消息将直接发送到当前客户端连接
ctx.websocket.room.join('foo');

// 当前连接加入房间 bar，并设置该房间消息处理函数，设置了处理函数将不再直接发送消息到当前客户端
// room: string, message: Buffer | string
ctx.websocket.room.join('bar', ({ room, message }) => {
  console.log(room, message);
});

// 当前连接离开房间
ctx.websocket.room.leave('foo');

// 通过当前 ctx 广播消息，所有加入房间的连接会收到这条消息
ctx.websocket.room.sendTo('foo', 'hello foo');

// 也可以通过通过 app 对象来广播消息
app.ws.sendTo('bar', 'hello bar');
```





### 自定义房间消息处理函数<a id="roomhandler"></a>

**注意**：使用 `room.join()` 函数，忽略第二个参数的情况下，房间内的消息会直接发送到当前客户端连接。

如果你需要自定义这部分的处理逻辑，那么可配置 `room.join()` 的第二个参数。

```typescript
ctx.websocket.room.join('foo', ({ room, message }) => {
  // room: string 房间名
  // message: Buffer | string 消息内容
  // message 的类型取决于使用 sendTo 发送的是 string 还是 Buffer
  console.log(room, message);
});
```



### 例子

router.ts

```typescript
import { Application } from 'egg';

export default (app: Application) => {
  const { controller, router } = app;

  // 配置 http 路由
  router.get('/', controller.home.index);
  // 配置 websocket 路由，websocket 可与 http 使用同一个 url，不会导致冲突
  app.ws.route('/', controller.home.ws);
};
```

controller/home.ts

```typescript
import { Controller } from 'egg';

export default class HomeController extends Controller {
  public async index() {
    const { ctx, app } = this;
    // 向房间 foo 发送消息
    app.ws.sendTo('foo', 'hello from index');
    ctx.body = 'index';
  }

  public async ws() {
    const { websocket } = this.ctx;
    if (!websocket) {
      throw new Error('this function can only be use in websocket router');
    }

    // 加入到房间 foo
    websocket.room.join('foo');
  }
}
```

浏览器连接 WebSocket

```javascript
const ws = new WebSocket('ws://127.0.0.1:7001/');
ws.addEventListener('message', data => {
  console.log(data);
});
```

这时候，访问 http://localhost:7001/ WebSocket 客户端将会收到一条  `hello from index` 的字符串



## 使用场景

- 使用 egg 开发标准 WebSocket 服务器
- 微信小程序 WebSocket 服务器



## 提问交流

请到 [issues](https://github.com/flarestart/egg-websocket-plugin/issues) 异步交流。



## License

[MIT](LICENSE)