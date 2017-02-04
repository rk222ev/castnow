const grabOpts = require('../../src/utils/grab-opts.js');

const options = { disableSeek: true, disableX: false }

describe('#grabOpts', () => {
  test('will grabs options with the specified prefix', () => {
    const option = grabOpts(options, 'disable')
    expect(option).toEqual({Seek: true, X: false })
  });

  test('returns an empty object if no keys has the correct prefix', () => {
    const option = grabOpts(options, 'enable')
    expect(option).toEqual({})
  });

})
