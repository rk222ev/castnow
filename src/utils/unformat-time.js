/**
 * Parses a timestamp string (hh:mm:ss or mm:ss)
 * and returns the total amount of seconds
*/

const hoursToSeconds = n => n ? n * 60 * 60 : 0
const minutesToSeconds = n => n *  60

module.exports = string => {
  const [seconds, minutes, hours] = string.split(':')
        .reverse()
        .map(x => x ? parseInt(x) : x)
  return hoursToSeconds(hours) + minutesToSeconds(minutes) + seconds
};
