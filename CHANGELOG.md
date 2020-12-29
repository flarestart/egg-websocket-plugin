## <small>1.0.1 (2020-12-29)</small>

* refactor: 部分代码重构 ([6fca207](https://github.com/flarestart/egg-websocket-plugin/commit/6fca207))
* test: 添加单元测试 ([758213d](https://github.com/flarestart/egg-websocket-plugin/commit/758213d))



# [1.0.0](https://github.com/flarestart/egg-websocket-plugin/compare/v0.2.1...v1.0.0) (2020-08-22)


### feat

* 添加房间，允许接受房间广播、加入、离开 ([277ed18](https://github.com/flarestart/egg-websocket-plugin/commit/277ed185f017a1b4640a99772c6019a500bc3a37))

### fix

* WebSocket 被中间件拦截后或捕获到错误后，正确的关闭连接 ([026aef5](https://github.com/flarestart/egg-websocket-plugin/commit/026aef57894e92124a6b11bc1639364e72d2cda4))
* 避免在未配置 Redis 的情况下，使用广播方法可能导致未捕获的错误 ([b7b0ed7](https://github.com/flarestart/egg-websocket-plugin/commit/b7b0ed703685e3def8baf21783d2ab16febdf8df))



## [0.1.1](https://github.com/flarestart/egg-websocket-plugin/compare/v0.1.0...v0.1.1) (2020-07-18)


### chore

* 文档更新 ([628c680](https://github.com/flarestart/egg-websocket-plugin/commit/628c6806a4b8271ee0d1681d58e44e7adf904470))

### fix

* 使用 egg 自身的 Router 来处理路由 ([9e87019](https://github.com/flarestart/egg-websocket-plugin/commit/9e87019dc52a3a0a14e5a41ae3d43fa5607f4169))
* 修复默认配置错误 ([fd6fcfa](https://github.com/flarestart/egg-websocket-plugin/commit/fd6fcfa49ce96d2a2a5539dbdee71132f3cb273f))



## [0.0.3](https://github.com/flarestart/egg-websocket-plugin/compare/v0.0.2...v0.0.3) (2020-04-16)


### fix

* TypeScript 定义文件更新 ([355a82b](https://github.com/flarestart/egg-websocket-plugin/commit/355a82b455b29895e52e8f3149446c8b768063ce))



## [0.0.2](https://github.com/flarestart/egg-websocket-plugin/compare/227a81c38ea6a147e40b04fc61e63ad346514fa8...v0.0.2) (2020-01-06)


### chore

* 基础代码 ([227a81c](https://github.com/flarestart/egg-websocket-plugin/commit/227a81c38ea6a147e40b04fc61e63ad346514fa8))

### fix

* 中间件优化；文档更新 ([36ebf6b](https://github.com/flarestart/egg-websocket-plugin/commit/36ebf6b2036cb3958d57c0af0039a4fb861d99c6))



