const { EventEmitter } = require('events');
const config = require('./config');
const { NtripDecoder } = require('ntrip-decoder');
const net = require('net');
const utils = require('./utils');

class NtripClient extends EventEmitter {
  /**
   * create a client
   * @param {Object} options client options
   */
  constructor(options) {
    super();
    /**
     * @member {string} host - the host of ntripcaster
     */
    this.host = options.host || '';
    /**
     * @member {(string|number)} port - the port of ntripcaster
     */
    this.port = options.port || '';
    /**
     * @member {string} mountpoint - the mountpoint of ntripcaster
     */
    this.mountpoint = options.mountpoint || '';
    /**
     * @member {string} userAgent - the user-agent of client
     */
    this.userAgent = options.userAgent || config.USER_AGENT;
    /**
     * @member {string} username - the username of ntripcaster
     */
    this.username = options.username || '';
    /**
     * @member {string} password - the password of ntripcaster
     */
    this.password = options.password || '';
    /**
     * @member {Object} headers - the custom headers
     */
    this.headers = options.headers || {};
    /**
     * @member {Array} xyz - the coordinate of client
     */
    this.xyz = options.xyz || [0, 0, 0];
    /**
     * @member {number} interval - the time interval to send GGA, unit is millisecond
     */
    this.interval = options.interval || 0;
    /**
     * @member {Timeout} intervalTimer - interval timer
     */
    this.intervalTimer = null;
    /**
     * @member {number} reconnectInterval - the recconect interval of ntripcaster
     */
    this.reconnectInterval =
      options.reconnectInterval || config.RECONNECT_INTERVAL;
    /**
     * @member {number} timeout - the timeout of socket
     */
    this.timeout = options.timeout || config.SOCKET_TIMEOUT;
    /**
     * @member {net.socket} client - the socket resource
     */
    this.client = null;
    /**
     * @member {NtripClient} decoder - the decoder of ntripcaster
     */
    this.decoder = null;
    /**
     * @member {Boolean} isError - the status of errored
     */
    this.isError = false;
    /**
     * @member {Boolean} isClose - the status of closed
     */
    this.isClose = false;
    /**
     * @member {Boolean} isReady - check if the ntripcater is ready
     */
    this.isReady = false;
  }

  /**
   * client start running
   */
  run() {
    this._connect();
    this._loop();
  }

  /**
   * close this client
   */
  close() {
    this.emit('close');

    this.isClose = true;
    this.client.destroy();
  }

  /**
   * set the xyz
   * @param {Array} xyz
   */
  setXYZ(xyz) {
    this.xyz = xyz;
  }

  /**
   * send data to ntripcaster
   * @param {(string|Buffer))} data
   */
  write(data) {
    if (this.close || this.isError) {
      return;
    }

    if (!this.client) {
      return;
    }

    try {
      this.client.write(data);
    } catch (e) {
      this.emit('error', e);
    }
  }

  /**
   * do loop
   */
  async _loop() {
    if (this.interval <= 0) {
      return;
    }

    this.intervalTimer = setInterval(() => {
      if (utils.checkXyz(this.xyz) && this.isReady) {
        const gga = utils.encodeGGA(this.xyz) + '\r\n';
        this.write(gga);
      }

      if (this.isClose) {
        if (this.intervalTimer) {
          clearInterval(this.intervalTimer);
          this.intervalTimer = null;
        }
      }
    }, this.interval);
  }

  /**
   * connect the ntripcaster
   */
  _connect() {
    if (this.isClose) {
      return;
    }

    // init ntrip decoder
    this.decoder = new NtripDecoder();
    this.decoder.on('data', (data) => {
      this._onData(data);
    });
    this.decoder.on('error', (err) => {
      this._onError(err);
    });

    // init connection of client
    this.client = net.createConnection({
      host: this.host,
      port: this.port
    });

    // on timeout event
    this.client.on('timeout', () => {
      this._onError('socket timeouted');
    });

    // on connect event
    this.client.on('connect', () => {
      const mountpoint = this.mountpoint;
      const userAgent = this.userAgent;
      const username = this.username;
      const password = this.password;
      const authorization = Buffer.from(
        username + ':' + password,
        'utf8'
      ).toString('base64');
      let customHeader = '';
      for (const key in this.headers) {
        customHeader += `${key}: ${this.headers[key]}\r\n`;
      }
      const data = `GET /${mountpoint} HTTP/1.1\r\nUser-Agent: ${userAgent}\r\n${customHeader}Authorization: Basic ${authorization}\r\n\r\n`;
      this.client.write(data);
    });

    // on data event
    this.client.on('data', (data) => {
      this.decoder.decode(data);
    });

    // on end event
    this.client.on('end', () => {
      this._onError('socket ended');
    });

    // on close event
    this.client.on('close', () => {
      this._onError('socket closed');
    });

    // on error event
    this.client.on('error', (err) => {
      this._onError(err);
    });

    this.client.setTimeout(this.timeout);
  }

  /**
   * trigger error
   * @param {(string|Error)} err
   */
  _onError(err) {
    if (this.isError) {
      return;
    }
    this.isError = true;

    // reset isReady
    this.isReady = false;

    // release socket
    if (this.client) {
      this.client.removeAllListeners();
      this.client.destroy();
      this.client = null;
    }

    // release decoder
    if (this.decoder) {
      this.decoder.removeAllListeners();
      this.decoder.close();
      this.decoder = null;
    }

    if (!this.isClose) {
      this.emit('error', err);
    }

    this._reconnect();
  }

  /**
   * reconnect the ntripcaster
   */
  async _reconnect() {
    if (this.isClose) {
      return;
    }
    this.isError = false;

    // check reconnect time
    if (this.reconnectInterval <= 0) {
      return;
    }

    // do sleep
    await utils.sleep(this.reconnectInterval);
    // begin connect
    this._connect();
  }

  /**
   * trigger data event
   * @param {Buffer} data - the data from ntripcaster
   */
  _onData(data) {
    if (!this.isReady) {
      const response = data.toString();
      if (response.startsWith(config.REPLY)) {
        this.isReady = true;
      }
    }
    this.emit('data', data);
  }
}

module.exports = {
  NtripClient
};
