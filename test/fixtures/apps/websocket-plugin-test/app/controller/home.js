'use strict';

const Controller = require('egg').Controller;

class HomeController extends Controller {
  async index() {
    this.ctx.body = 'hi, ' + this.app.plugins.websocket.name;
  }

  async echo() {
    this.ctx.websocket.on('message', msg => {
      this.ctx.websocket.send(msg);
    });
  }

  async room() {
    this.ctx.websocket.room.join('room');
    this.app.ws.sendTo('room', 'room message');
  }

  error() {
    throw new Error('throw error');
  }
}

module.exports = HomeController;
