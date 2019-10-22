const { nmea } = require('./nmea');

/**
 * do sleep
 * @param {number} ms
 */
const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

/**
 * check xyz
 * @param {Array} xyz the coordinate
 */
const checkXyz = (xyz) => {
  if (!Array.isArray(xyz) || xyz.length !== 3) {
    return false;
  }
  if (xyz[0] !== 0.0 && xyz[1] !== 0.0 && xyz[2] !== 0.0) {
    return true;
  }
  return false;
};

/**
 * generate gga
 * @param {Array} xyz the coordinate
 */
const encodeGGA = (xyz) => {
  return nmea.encode({
    type: 'GPGGA',
    datetime: Date.now(),
    loc: {
      ecef: xyz
    },
    gpsQuality: 1,
    satellites: 0,
    hdop: 0,
    altitude: 0,
    geoidalSeparation: 0,
    ageGpsData: 1,
    refStationId: 1
  });
};

module.exports = {
  sleep,
  checkXyz,
  encodeGGA
};
