import { PubSuber } from '../app';
import { Redis, RedisOptions } from 'ioredis';

export class RedisPubSuber implements PubSuber {
  static TYPE_BINARY = 'b';
  static TYPE_STRING = 's';

  publisher: Redis;
  subscriber: Redis;
  joinedRoomCounter: Map<string, number> = new Map();
  handlers = new Set<Function>();
  listening = false;

  constructor(config: RedisOptions) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require('ioredis');
    this.publisher = new IORedis(config);
    this.subscriber = new IORedis(config);
  }

  publish(room: string, message: any) {
    if (typeof message === 'string') {
      return this.publisher.publish(
        room,
        `${RedisPubSuber.TYPE_STRING}${message}`,
      );
    }
    return this.publisher.publish(
      room,
      `${RedisPubSuber.TYPE_BINARY}${message.toString()}`,
    );
  }

  addMessageHandler(listener: Function) {
    this.handlers.add(listener);
    if (!this.listening) {
      this.listening = true;
      this.subscriber.addListener('messageBuffer', this.handleMessage);
    }
  }

  removeMessageHandler(listener: Function) {
    this.handlers.delete(listener);
    if (this.handlers.size <= 0 && this.listening) {
      this.listening = false;
      this.subscriber.removeListener('messageBuffer', this.handleMessage);
    }
  }

  handleMessage = (room: string | ArrayBufferLike, msg: any) => {
    const m = this._processMessage(msg);
    if (!m) {
      return;
    }
    const { message } = m;
    this.handlers.forEach(item => {
      item({ room: room.toString(), message });
    });
  };

  _processMessage(message: Buffer) {
    const messageType = String.fromCharCode(message[0]);
    if (messageType === RedisPubSuber.TYPE_BINARY) {
      return {
        type: 'binary',
        message: message.slice(1),
      };
    }
    if (messageType === RedisPubSuber.TYPE_STRING) {
      return {
        type: 'string',
        message: message.slice(1).toString(),
      };
    }
    return null;
  }

  joinRoom(...rooms: string[]) {
    const newRooms: string[] = [];
    rooms.forEach(room => {
      const isNew = this._addRoomCounter(room);
      if (isNew) {
        newRooms.push(room);
      }
    });
    if (newRooms.length <= 0) {
      return Promise.resolve(0);
    }
    return this.subscriber.subscribe(...newRooms);
  }

  leaveRoom(...rooms: string[]) {
    const leaveRooms: any[] = [];
    rooms.forEach(room => {
      const isDelete = this._deleteRoomCounter(room);
      if (isDelete) {
        leaveRooms.push(room);
      }
    });
    if (leaveRooms.length <= 0) {
      return Promise.resolve(0);
    }
    return this.subscriber.unsubscribe(...leaveRooms);
  }

  // 房间计数器，计数器 <= 0 则取消订阅房间, 返回值 true: 新房间, false 房间已订阅
  private _addRoomCounter(room: string): boolean {
    const count = this.joinedRoomCounter.get(room);
    if (!count || count <= 0) {
      this.joinedRoomCounter.set(room, 1);
      return true;
    }
    this.joinedRoomCounter.set(room, count + 1);
    return false;
  }
  private _deleteRoomCounter(room: string): boolean {
    const count = this.joinedRoomCounter.get(room);
    if (!count || count <= 1) {
      this.joinedRoomCounter.delete(room);
      return true;
    }
    this.joinedRoomCounter.set(room, count - 1);
    return false;
  }
}
