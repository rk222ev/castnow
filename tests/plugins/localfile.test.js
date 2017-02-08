const localfile = require('../../src/plugins/localfile.js');

jest.mock('http');
const http = require('http')


describe('localfile plugin', () => {
  beforeEach(() => {
    mockHttp()
  })

  test('Calls cb if ctx.mode !== launch', () => {
    const cb = jest.fn()
    localfile({}, cb)

    expect(cb.mock.calls.length).toBe(1)
    expect(http.createServer.mock.calls.length).toBe(0)
  });

  describe('with mode launch', () => {
    test('calls cb but not http.createServer if not all paths in playlist are files', () => {
      const ctx = ctxFixture('not-a-file')
      const cb = jest.fn()

      localfile(ctx, cb)

      expect(cb.mock.calls.length).toBe(1)
      expect(http.createServer.mock.calls.length).toBe(0)
    });

    test('calls cb and http.createServer if all paths in playlist are files', () => {
      const ctx = ctxFixture(__filename)
      const cb = jest.fn()

      localfile(ctx, cb)

      expect(cb.mock.calls.length).toBe(1)
      expect(http.createServer.mock.calls.length).toBe(1)
    });
  })
})

const mockHttp = () => {
  http.createServer = jest.fn()
  http.createServer.mockImplementation(() => ({ listen: () => {} }))
}

const ctxFixture = path => ({
  mode: 'launch',
    options: {
      playlist: [
        { path }
    ]
  }
})
