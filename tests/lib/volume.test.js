const { getVolumeStep } = require('../../src/lib/volume')

describe('#getVolumeStep', () => {

  test('returns 0.05 as default', () => {
    const [ volume, _ ] = getVolumeStep()
    expect(volume).toEqual(0.05)
  });

  test('returns error if NaN', () => {
    const [ volume, error ] = getVolumeStep('not a number')
    expect(error).toBe('invalid --volume-step');
  });

  test('calls the errorFn if less than zero', () => {
    const [ volume, error ] = getVolumeStep(-0.1)
    expect(error).toBe('--volume-step must be between 0 and 1');
  });
})
