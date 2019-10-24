const pkg = require('../package.json');

// the default timeout of socket connection
const SOCKET_TIMEOUT = 15000;
// the default reconnect interval of ntripcaster
const RECONNECT_INTERVAL = 2000;
// the ntripcater correct reponse data
const REPLY = 'ICY 200 OK';
// the ntripclient userAgent
const USER_AGENT = `NTRIP NtripClientJs/${pkg.version}`;

module.exports = {
  SOCKET_TIMEOUT,
  RECONNECT_INTERVAL,
  REPLY,
  USER_AGENT
};
