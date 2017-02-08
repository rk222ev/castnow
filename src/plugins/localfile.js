const http = require('http')
const internalIp = require('internal-ip')
const path = require('path')
const serveMp4 = require('../utils/serve-mp4')
const debug = require('debug')('castnow:localfile')
const fs = require('fs')

const isFile = x => fs.existsSync(x.path) && fs.statSync(x.path).isFile()

const localfile = (ctx, next) => {
  if (ctx.mode !== 'launch') return next()
  if (!ctx.options.playlist.every(isFile)) return next()

  const list = ctx.options.playlist.slice(0)
  const ip = (ctx.options.myip || internalIp())
  const port = ctx.options['localfile-port'] || 4100

  ctx.options.playlist = list.map((item, idx) => {
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
