const wgs84 = require('./wgs84');

const a = wgs84.RADIUS;
const b = wgs84.POLAR_RADIUS;
const asqr = Math.pow(a, 2);
const bsqr = Math.pow(b, 2);

const e = Math.sqrt((asqr - bsqr) / asqr);
const eprime = Math.sqrt((asqr - bsqr) / bsqr);

/*
 * Converts an angle in radians to degrees.
 */
function degrees(angle) {
  return angle * (180 / Math.PI);
}

/*
 * Converts an angle in degrees to radians.
 */
function radians(angle) {
  return angle * (Math.PI / 180);
}

const getN = (latitude) => {
  const sinlatitude = Math.sin(latitude);
  const denom = Math.sqrt(1 - e * e * sinlatitude * sinlatitude);
  const N = a / denom;
  return N;
};

const LLAToECEF = (latitude, longitude, altitude) => {
  //Auxiliary values first
  const N = getN(latitude);
  const ratio = bsqr / asqr;

  //Now calculate the Cartesian coordinates
  const X = (N + altitude) * Math.cos(latitude) * Math.cos(longitude);
  const Y = (N + altitude) * Math.cos(latitude) * Math.sin(longitude);

  //Sine of latitude looks right here
  const Z = (ratio * N + altitude) * Math.sin(latitude);

  return [X, Y, Z];
};

const ECEFToLLA = (X, Y, Z) => {
  //Auxiliary values first
  const p = Math.sqrt(X * X + Y * Y);
  const theta = Math.atan((Z * a) / (p * b));

  const sintheta = Math.sin(theta);
  const costheta = Math.cos(theta);

  const num = Z + eprime * eprime * b * sintheta * sintheta * sintheta;
  const denom = p - e * e * a * costheta * costheta * costheta;

  //Now calculate LLA
  const latitude = Math.atan(num / denom);
  let longitude = Math.atan(Y / X);
  const N = getN(latitude);
  const altitude = p / Math.cos(latitude) - N;

  if (X < 0 && Y < 0) {
    longitude = longitude - Math.PI;
  }

  if (X < 0 && Y > 0) {
    longitude = longitude + Math.PI;
  }

  return [latitude, longitude, altitude];
};

/**
 * convert geodecti coordinates to ecef
 * @param {Array} coords
 */
const geoToEcef = (coords) => {
  return LLAToECEF(radians(coords[0]), radians(coords[1]), coords[2] || 0.0);
};

/**
 * convert ecef to geodecti coordinates
 * @param {Array} coords
 */
const ecefToGeo = (coords) => {
  const gps = ECEFToLLA(coords[0], coords[1], coords[2]);

  gps[0] = degrees(gps[0]);
  gps[1] = degrees(gps[1]);

  return gps;
};

module.exports = {
  geoToEcef,
  ecefToGeo
};
