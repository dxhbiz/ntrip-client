const { geoToEcef, ecefToGeo } = require('./ecef');

/**
 * regex for GGA valid data
 *                                                      11
 *        1         2       3 4        5 6 7  8   9  10 |  12 13  14   15
 *        |         |       | |        | | |  |   |   | |   | |   |    |
 * $--GGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx*hh<CR><LF>
 * 1. UTC of this position report
 * 2. Latitude
 * 3. N or S (North or South)
 * 4. Longitude
 * 5. E or W (East or West)
 * 6. GPS Quality Indicator (non null)
 *    0 - fix not available,
 *    1 - GPS fix,
 *    2 - Differential GPS fix (values above 2 are 2.3 features)
 *    3 = PPS fix
 *    4 = Real Time Kinematic
 *    5 = Float RTK
 *    6 = estimated (dead reckoning)
 *    7 = Manual input mode
 *    8 = Simulation mode
 * 7. Number of satellites in use, 00 - 12
 * 8. Horizontal Dilution of precision (meters)
 * 9. Antenna Altitude above/below mean-sea-level (geoid) (in meters)
 * 10. Units of antenna altitude, meters
 * 11. Geoidal separation, the difference between the WGS-84 earth ellipsoid and mean-sea-level (geoid), "-" means mean-sea-level below ellipsoid
 * 12. Units of geoidal separation, meters
 * 13. Age of differential GPS data, time in seconds since last SC104 type 1 or 9 update, null field when DGPS is not used
 * 14. Differential reference station ID, 0000-1023
 * 15. Checksum
 * Example: $GNGGA,001043.00,4404.14036,N,12118.85961,W,1,12,0.98,1113.0,M,-21.3,M,,*47
 * Link: https://gpsd.gitlab.io/gpsd/NMEA.html#_gga_global_positioning_system_fix_data
 */
// const ggaRegex = /^\$((G\w{1})?GGA),(\d{6}([.]\d+)?),(\d{4}[.]\d+,[NS]),(\d{5}[.]\d+,[WE]),([0-8]),(\d{1,2}),(\d{1,3}[.]\d{1,3})?,([-]?\d+([.]\d+)?)?,(\w*)?,(\d+([.]\d+)?)?,(\w*)?,?([-]?\d+([.]\d+)?)?,?(\d{4})?\*([0-9a-fA-F]{2})(\r\n)?$/;
const ggaRegex = /^\$((G\w{1})?GGA).*(\r\n)?$/;

const pad = (n, width, z) => {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

/**
 * Get checksum from raw data
 *
 * @param {string} data - raw data
 * @return {string} checksum en hex
 */
const getChecksum = (data) => {
  let checksum;
  data = data.toString();
  const idx1 = data.indexOf('$G');
  const idx2 = data.indexOf('*');
  checksum = data
    .slice(idx1 + 1, idx2)
    .split('')
    .reduce((y, x) => y ^ x.charCodeAt(0), 0);
  return checksum;
};

/**
 * Verify checksum from raw data
 *
 * @param {string} data - raw data
 * @return {boolean} if valid data
 */
const verifyChecksum = (data) => {
  const idx = data.indexOf('*');
  return getChecksum(data) === parseInt(data.substr(idx + 1, 2), 16);
};

const toHexString = (checksum) => {
  const buf = Buffer.allocUnsafe(1);
  buf.fill(checksum);
  return buf.toString('hex');
};

const encodeTime = (time) => {
  const date = new Date(time);

  const hours = pad(date.getUTCHours(), 2, 0);
  const minutes = pad(date.getUTCMinutes(), 2, 0);
  const secs = pad(date.getUTCSeconds(), 2, 0);
  const msecs = pad(date.getUTCMilliseconds(), 3, 0);
  return `${hours}${minutes}${secs}.${msecs}`;
};

/**
 * Degree [dmm] to decimal
 *
 * @param {string} data - Degree in dmm.
 * @return {number} decimals
 */
const degToDec = (data) => {
  let decimal = 0.0;
  const _data = data.match(/(\d{2,3})(\d{2}[.]\d+),([NSWE])/).slice(1);
  const deg = _data[0];
  const min = _data[1];
  const sign = _data[2];
  decimal = parseFloat(deg) + parseFloat(min) / 60;
  if (sign === 'S' || sign === 'W') {
    decimal *= -1;
  }
  return decimal;
};

/**
 * Decimal latitude to degree [dmm]
 *
 * @param {string} data - raw data
 * @return {string} degree [dmm]
 */
const latToDmm = (data) => {
  const tmp = data.toString().split('.');
  const deg = pad(Math.abs(tmp[0]), 2, '0');
  const fixed = (('0.' + (tmp[1] || 0)) * 60).toFixed(6);
  const fixedArr = fixed.toString().split('.');
  const mim = pad(fixedArr[0], 2, 0) + '.' + fixedArr[1];
  // const mim = pad((('0.' + (tmp[1] || 0)) * 60).toFixed(4), 7, '0');
  const sign = data < 0 ? 'S' : 'N';
  return `${deg}${mim},${sign}`;
};

/**
 * Decimal longitude to degree [dmm]
 *
 * @param {string} data - raw data
 * @return {string} degree [dmm]
 */
const lngToDmm = (data) => {
  const tmp = data.toString().split('.');
  const deg = pad(Math.abs(tmp[0]), 3, '0');
  const fixed = (('0.' + (tmp[1] || 0)) * 60).toFixed(6);
  const fixedArr = fixed.toString().split('.');
  const mim = pad(fixedArr[0], 2, 0) + '.' + fixedArr[1];
  const sign = data < 0 ? 'W' : 'E';
  return `${deg}${mim},${sign}`;
};

/**
 * decode GPGGA data
 * @param {string} nmea
 * @return {object} data
 */
const decodeGGA = (nmea) => {
  let data = {
    raw: nmea,
    valid: false
  };

  data.valid = verifyChecksum(nmea);
  if (!data.valid) {
    return data;
  }

  const arr = nmea.split(',');

  data.type = arr[0].replace('$', '');
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const pattern = /(\d{2})(\d{2})(\d{2})[.](\d{1,3})/;

  data.datetime = new Date(
    `${date}T${arr[1].replace(pattern, '$1:$2:$3')}.000Z`
  );

  const latitude = arr[2] + ',' + arr[3];
  const longitude = arr[4] + ',' + arr[5];
  const coordinates = [degToDec(latitude), degToDec(longitude)];
  data.loc = {
    geojson: {
      type: 'Point',
      coordinates
    },
    ecef: geoToEcef(coordinates),
    dmm: {
      latitude,
      longitude
    }
  };
  data.gpsQuality = parseInt(arr[6], 10);
  data.satellites = parseInt(arr[7], 10);
  data.hdop = arr[8] ? parseFloat(arr[8]) : null;
  data.altitude = arr[9] ? parseFloat(arr[9]) : null;
  data.altitudeUnit = arr[10] ? arr[10] : null;
  data.geoidalSeparation = arr[11] ? parseFloat(arr[11]) : null;
  data.geoidalSeparationUnit = arr[12] ? arr[12] : null;
  data.ageGpsData = null;
  if (arr.length >= 15) {
    data.ageGpsData = parseFloat(arr[13]);
  }
  data.refStationId = null;
  if (arr.length >= 16) {
    data.refStationId = parseInt(arr[14]);
  }

  return data;
};

/**
 * encode data to GGA
 * @param {*} data
 */
const encodeGGA = (data) => {
  const result = ['$' + data.type];
  result.push(encodeTime(data.datetime));

  const coords = ecefToGeo(data.loc.ecef);
  result.push(latToDmm(coords[0]));
  result.push(lngToDmm(coords[1]));
  result.push(data.gpsQuality);
  result.push(pad(data.satellites, 2, 0));
  result.push(data.hdop.toFixed(3));
  result.push(data.altitude);
  result.push(data.altitudeUnit || 'M');
  result.push(data.geoidalSeparation);
  result.push(data.geoidalSeparationUnit || 'M');
  if (data.ageGpsData) {
    result.push(data.ageGpsData ? data.ageGpsData.toFixed(3) : data.ageGpsData);
  }
  if (data.refStationId) {
    result.push(
      data.refStationId
        ? pad(parseInt(data.refStationId), 4, 0)
        : data.refStationId
    );
  }

  const resultMsg = result.join(',') + '*';
  return resultMsg + toHexString(getChecksum(resultMsg)).toUpperCase();
};

/**
 * decode nmea data
 * @param {*} nmea
 */
const decode = (nmea) => {
  let data = {
    raw: nmea,
    valid: false
  };

  if (ggaRegex.test(nmea)) {
    data = decodeGGA(nmea);
  }

  return data;
};

/**
 * encode nmea data
 * @param {*} data
 */
const encode = (data) => {
  if (data.type.endsWith('GGA')) {
    return encodeGGA(data);
  }
  return '';
};

module.exports = {
  decode,
  encode
};
