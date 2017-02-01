unformatTime = require('../../utils/unformat-time.js')

const testData = [
  ['01:02:03', 3723],
  ['59:59:59', 215999],
  ['02:03',    123],
  ['59:01',    3541],
]

describe('unformatTime', () => {
  test('translates timestamps to seconds', () =>{
    testData.forEach(([timeStamp, expected]) => {
      const time = unformatTime(timeStamp)
      expect(time).toBe(expected)
    })
  })
})
