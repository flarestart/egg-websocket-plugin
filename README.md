# egg-websocket-plugin

[![NPM version][npm-image]][npm-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![npm download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/egg-websocket-plugin.svg?style=flat-square
[npm-url]: https://npmjs.org/package/egg-websocket-plugin
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

接下来，开启广播相关的 API 需要在 config.default.js 中配置 `redis` 连接，配置项可参见 [ioredis](https://www.npmjs.com/package/ioredis)

```typescript
config.websocket = {
  // 配置 websocket 使用 redis 作消息广播
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
};
```

开启后，即可使用下面的广播 API

```typescript
// 加入房间
ctx.websocket.room.join('foo');

// 离开房间
ctx.websocket.room.leave('foo');

// 通过当前 ctx 广播消息
ctx.websocket.room.sendTo('foo', 'hello world');

// 通过 app 广播消息
app.ws.sendTo('foo', 'hello world');
```

加入到某个房间后，就可以收到该房间广播的消息。

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
ws.addEventListener('message', (data) => {
    console.log(data);
});
```

这时候，访问 http://localhost:7001/ WebSocket 客户端将会收到一条  `hello from index` 的字符串



### 自定义广播处理函数

**注意**：`ctx.websocket.room.sendTo` 与 `app.ws.sendTo` 默认行为会直接将消息内容发送到客户端或浏览器中

如果你需要自定义这部分的处理逻辑，那么可配置 ctx.websocket.room.beforeSend 处理函数

```typescript
export default class HomeController extends Controller {
	public async ws() {
    const { websocket } = this.ctx;
    if (!websocket) {
      throw new Error('this function can only be use in websocket router');
    }
		// 自定义广播处理函数
    websocket.room.beforeSend = ({ type, room, message }) => {
      // type: 消息类型 'string', 'binary', 'unknown'
      // room: 房间名
      // message: 消息体 Buffer 或 string 类型
      console.log({ type, room, message });

      // 返回 false 的话，表示不再执行默认行为，返回其他值会继续执行默认处理函数
      return false
    };
  }
}
```





## 使用场景

- 使用 egg 开发标准 WebSocket 服务器
- 微信小程序 WebSocket 服务器



## 单元测试

因 egg 本身单元测试对 WebSocket 支持有限，因此，暂不支持使用 egg-mock 进行单元测试



## 提问交流

请到 [issues](https://github.com/flarestart/egg-websocket-plugin/issues) 异步交流。



## License

[MIT](LICENSE)