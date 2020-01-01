# egg-websocket-plugin

[![NPM version][npm-image]][npm-url]https://www.npmjs.com/package/egg-websocket-plugin
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

egg-websocket-plugin 版本 | egg 1.x
--- | ---
1.x | 😁
0.x | ❌

### 依赖的插件
`ws`

## 开启插件

```js
// config/plugin.js
exports.websocket = {
  enable: true,
  package: 'egg-websocket-plugin',
};
```

## 使用场景

- 使用 egg 开发标准 WebSocket 服务器
- 微信小程序 WebSocket 服务器

## 特性

- [x] 兼容 egg 自身的 controller
- [x] 兼容 egg 路由中间件
- [x] 不需要像 socket.io 一样开启 `sticky` 模式
- [ ] 支持分布式部署时的发布与订阅

## 详细配置

请到 [config/config.default.js](config/config.default.js) 查看详细配置项说明。

## 单元测试

<!-- 描述如何在单元测试中使用此插件，例如 schedule 如何触发。无则省略。-->

## 提问交流

请到 [egg issues](https://github.com/eggjs/egg/issues) 异步交流。

## License

[MIT](LICENSE)