const validateVolumeStep = x => {
  if (isNaN(x)) return 'invalid --volume-step'
  if (x < 0 || x > 1) return '--volume-step must be between 0 and 1'
}

/**
 * Parses and validates a volumstep or returns a default value
 */
const getVolumeStep = option  => {
  const value = parseFloat(option || 0.05)
  return [value, validateVolumeStep(value)]
}

module.exports = { getVolumeStep }
