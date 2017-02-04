const serveMp4 = require('../../src/utils/serve-mp4.js')

jest.mock('range-parser');
const rangeParser = require('range-parser');

jest.mock('fs');
const fs = require('fs');

describe('#serve-mp4', () => {
  const filePath = 'some string'

  const req = { headers: { range: 'range' } }

  const res = {
    headers: {},
    setHeader: function (key, value) { this.headers[key] = value }
  }

  beforeEach(() => {
    rangeParser.mockImplementation(() => [{ start: 5,  end: 1 }])
  })

  test('throws type error if filepath is missing', () => {
    expect(serveMp4).toThrow(TypeError);
  });

  test('will not throw given a file', () => {
    mockFs()
    expect(() => serveMp4(req, res, filePath))
      .not.toThrow();
  });


  describe('req headers without range', () => {
    const req = { headers: {} }

    beforeEach(() => {
      mockFs()
    })

    test('status is 200', () => {
      const { statusCode } = serveMp4(req, res, filePath)
      expect(statusCode)
        .toEqual(200);
    });

    test('Sets expected headers', () => {
      const resultMap = [
        ['Accept-Ranges', 'bytes'],
        ['Access-Control-Allow-Origin', '*'],
        ['Content-Length', 1],
        // Treats \1 as octal and octals are not allowed in strict mode
        // ['Content-Range', 'bytes 1-1\1'],
        ['Content-Type', 'application/octet-stream']
      ]

      const { headers } = serveMp4(req, res, filePath)
      expect(headers['Accept-Ranges']).toEqual('bytes')

      resultMap.forEach(([header, expected]) => expect(headers[header]).toEqual(expected))
    });
  })


  describe('req headers has a range', () => {
    beforeEach(() => {
      mockFs()
    })

    test('status is 206', () => {
      const { statusCode } = serveMp4(req, res, filePath)
      expect(statusCode)
        .toEqual(206);
    });

    test('Sets expected headers', () => {
      const resultMap = [
        ['Accept-Ranges', 'bytes'],
        ['Access-Control-Allow-Origin', '*'],
        ['Content-Length', -3],
        // Treats \1 as octal and octals are not allowed in strict mode
        // ['Content-Range', 'bytes 1-1\1'],
        ['Content-Type', 'application/octet-stream']
      ]

      const { headers } = serveMp4(req, res, filePath)

      resultMap.forEach(([header, expected]) => expect(headers[header]).toEqual(expected))
    });
  })
})


const mockFs = () => {
  fs.createReadStream.mockImplementation(() => {
    return { pipe: x => x }
  })
  fs.statSync.mockImplementation(() => {
    return { size: 1 }
  })
}
