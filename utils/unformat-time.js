const calcHours = n => n ? n * 60 * 60 : 0
const calcMinutes = n => n *  60

/**
 * Parses a timestamp string (hh:mm:ss or mm:ss)
 * and returns the total amount of seconds
*/
module.exports = string => {
  const [seconds, minutes, hours] = string.split(':')
        .reverse()
        .map(x => x ? parseInt(x) : x)
  return calcHours(hours) + calcMinutes(minutes) + seconds
};
