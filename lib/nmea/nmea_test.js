const { decode, encode } = require('./nmea');

const nmea =
  '$GPGGA,053204.02,3723.1018333,N,12205.3972723,W,1,00,1.0,39.662,M,-33.027,M,0.0,*40';
// '$GPGGA,081512.000,3130.503947,N,12024.083153,E,5,12,1.000,8.282,M,0,M,1,*4e';
// '$GPGGA,081512.000,3723.102485,N,12205.397658,W,5,12,1.000,8.282,M,0,M,-1.000,0123*66\r\n';
// const nmea =
//   '$GPGGA,081512.000,3130.503947,N,12024.083153,E,5,12,1.000,8.282,M,0,M,1,*4e';
const rst = decode(nmea);

if (!rst.valid) {
  return;
}
console.log(rst);

rst.ageGpsData = 1;
rst.type = 'GGA';
// rst.loc.ecef = [-2754339.2357, 4694397.4052, 3314096.45];

const newNmea = encode(rst);
console.log(newNmea);
console.log(decode(newNmea));
