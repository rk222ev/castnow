var http = require('http')
var internalIp = require('internal-ip')
var path = require('path')
var serveMp4 = require('../utils/serve-mp4')
var debug = require('debug')('castnow:localfile')
var fs = require('fs')

var isFile = function(item) {
  return fs.existsSync(item.path) && fs.statSync(item.path).isFile()
}

var contains = function(arr, cb) {
  for (var i=0, len=arr.length; i<len; i++) {
    if (cb(arr[i], i)) return true
  }
  return false
}

var localfile = function(ctx, next) {
  if (ctx.mode !== 'launch') return next()
  if (!contains(ctx.options.playlist, isFile)) return next()

  var list = ctx.options.playlist.slice(0)
  var ip = (ctx.options.myip || internalIp())
  var port = ctx.options['localfile-port'] || 4100

  ctx.options.playlist = list.map(function(item, idx) {
    if (!isFile(item)) return item
    return {
      path: 'http://' + ip + ':' + port + '/' + idx,
      type: 'video/mp4',
      media: {
        metadata: {
          filePath: item.path,
          title: path.basename(item.path)
        }
      }
    }
  })

  const requestListener = (req, res) => {
    const idx = req.url.slice(1)

    if (!list[idx]) {
      res.statusCode = '404'
      return res.end('page not found')
    }

    debug('incoming request serving %s', list[idx].path)
    serveMp4(req, res, list[idx].path)
  }

  http.createServer(requestListener)
    .listen(port)

  debug('started webserver on address %s using port %s', ip, port)
  next()

}

module.exports = localfile
