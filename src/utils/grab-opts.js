/**
 * Collects all object attributes that starts with a certain
 * prefix
*/
module.exports = (options, prefix) => {
  const collectPropsWithPrefix = (xs, key) => {
    if (key.includes(prefix)) xs[key.replace(prefix, '')] = options[key]
    return xs
  }

  return Object.keys(options)
    .reduce(collectPropsWithPrefix, {})
};
