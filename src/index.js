#!/usr/bin/env node

const player = require('chromecast-player')()
const opts = require('minimist')(process.argv.slice(2))
const chalk = require('chalk')
const keypress = require('keypress')
const ui = require('playerui')()
const circulate = require('array-loop')
const xtend = require('xtend')
const shuffle = require('array-shuffle')
const unformatTime = require('./utils/unformat-time')
const debug = require('debug')('castnow')
const debouncedSeeker = require('debounced-seeker')
const noop = function() {}

// plugins
const directories = require('./plugins/directories')
const xspf = require('./plugins/xspf')
const localfile = require('./plugins/localfile')
const torrent = require('./plugins/torrent')
const transcode = require('./plugins/transcode')
const subtitles = require('./plugins/subtitles')
const stdin = require('./plugins/stdin')

const printHelp = require('./lib/print-help')
const { getVolumeStep } = require('./lib/volume')

if (opts.help) return printHelp()

if (opts._.length) opts.playlist = opts._.map(path => ({ path }))
delete opts._

if (opts.quiet || opts.exit || process.env.DEBUG) ui.hide()

const [ volumeStep, error ] = getVolumeStep(opts['volume-step'])
if (error) fatalError(error)

debug('volume step: %s', volumeStep)

ui.showLabels('state')

const last = (fn, l) => {
  return () => {
    let args = Array.prototype.slice.call(arguments)
    args.push(l)
    l = fn.apply(null, args)
    return l
  }
}

const ctrl = (err, p, ctx) => {
  if (err) {
    ui.hide()
    debug('player error: %o', err)
    console.log(chalk.red(err))
    process.exit()
  }

  const playlist = ctx.options.playlist
  const is_keyboard_interactive = process.stdin.isTTY || false
  let volume

  if (is_keyboard_interactive) {
    keypress(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()
  }

  ctx.once('closed', () => {
    ui.hide()
    console.log(chalk.red('lost connection'))
    process.exit()
  })

  // get initial volume
  p.getVolume((err, status) => {
    volume = status
  })

  if (!ctx.options.disableTimeline) {
    p.on('position', (pos) => {
      ui.setProgress(pos.percent)
      ui.render()
    })
  }

  const seek = debouncedSeeker(offset => {
    if (ctx.options.disableSeek || offset === 0) return
    const seconds = Math.max(0, (p.getPosition() / 1000) + offset)
    debug('seeking to %s', seconds)
    p.seek(seconds)
  }, 500)

  let updateTitle = () => {
    p.getStatus((err, status) => {
      if (!status || !status.media ||
          !status.media.metadata ||
          !status.media.metadata.title) return

      const getTitle = ({ artist, title }) => artist ? `${artist} - ${title}}` : title
      const title = getTitle(status.media.metadata)

      ui.setLabel('source', 'Source', title)
      ui.showLabels('state', 'source')
      ui.render()
    })
  }

  let initialSeek = () => {
    let seconds = unformatTime(ctx.options.seek)
    debug('seeking to %s', seconds)
    p.seek(seconds)
  }

  p.on('playing', updateTitle)

  if (!ctx.options.disableSeek && ctx.options.seek) p.once('playing', initialSeek)

  updateTitle()

  const nextInPlaylist = () => {
    if (ctx.mode !== 'launch') return
    if (!playlist.length) return process.exit()
    p.stop(() => {
      ui.showLabels('state')
      debug('loading next in playlist: %o', playlist[0])
      p.load(playlist[0], noop)
      if (ctx.options.loop) playlist.push(playlist.shift())
    })
  }

  p.on('status', last((status, memo) => {
    if (opts.exit && status.playerState == 'PLAYING') process.exit()
    if (status.playerState !== 'IDLE') return
    if (status.idleReason !== 'FINISHED') return
    if (memo && memo.playerState === 'IDLE') return
    nextInPlaylist()
    return status
  }))

  const keyMappings = {
    space: () => p.currentSession.playerState == 'PLAYING' ? p.pause() : p.play(),

    // toggle between mute / unmute
    m: () => {
      const f = (err, status) => {
        if (!err) volume = status
      }
      if (volume) volume.muted ? p.unmute(f) : p.mute(f)
    },

    t: function() {
      if (!p.currentSession.media.tracks) return
      const type = 'EDIT_TRACKS_INFO'
      sessionRequestBody.activeTrackIds = p.currentSession.activeTrackIds ? [] : [1]
      p.sessionRequest({ type })
    },

    // volume up
    up: () => {
      if (!volume || volume.level >= 1) return
      const newVolume = Math.min(volume.level + volumeStep, 1)
      p.setVolume(newVolume, (err, status) => {
        if (err) return
        debug("volume up: %s", status.level)
        volume = status
      })
    },

    // volume down
    down: () => {
      if (!volume || volume.level <= 0) return
      const newVolume = Math.max(volume.level - volumeStep, 0)
      p.setVolume(newVolume, (err, status) => {
        if (err) return
        debug("volume down: %s", status.level)
        volume = status
      })
    },

    n: () => nextInPlaylist(),
    s: () => p.stop(),
    q: () => process.exit(),
    left: () => seek(-30),
    right: () => seek(30)
  }

  if (is_keyboard_interactive) {
    process.stdin.on('keypress', (ch, key) => {
      if (key && key.name && keyMappings[key.name]) {
        debug('key pressed: %s', key.name)
        keyMappings[key.name]()
      }
      if (key && key.ctrl && key.name == 'c') process.exit()
    })
  }

  if (opts.command) {
    let commands = opts.command.split(",")

    commands.forEach(c => {
      if (!keyMappings[c]) fatalError(`invalid --command: ${c}`)
    })

    let index = 0
    const run_commands = () => {
      if (index < commands.length) {
        let command = commands[index++]
        keyMappings[command]()
        p.getStatus(run_commands)
      } else if (opts.exit) {
        process.exit()
      }
    }

    p.getStatus(run_commands)
  }
}

const capitalize = function(str) {
  return str.substr(0, 1).toUpperCase() + str.substr(1)
}

let inter
let dots = circulate(['.', '..', '...', '....'])

const logState = status => {
  if (inter) clearInterval(inter)
  debug('player status: %s', status)
  inter = setInterval(() => {
    ui.setLabel('state', 'State', capitalize(status) + dots())
    ui.render()
  }, 300)
}

player.use((ctx, next) => {
  ctx.on('status', logState)
  next()
})

player.use(stdin)
player.use(directories)
player.use(torrent)
player.use(xspf)
player.use(localfile)
player.use(transcode)
player.use(subtitles)

player.use((ctx, next) => {
  if (ctx.mode !== 'launch') return next()
  if (ctx.options.shuffle)
    ctx.options.playlist = shuffle(ctx.options.playlist)
  ctx.options = xtend(ctx.options, ctx.options.playlist[0])
  let file = ctx.options.playlist.shift()
  if (ctx.options.loop) ctx.options.playlist.push(file)
  next()
})

debug(opts.playlist ? 'launching...' : 'attaching' )
player[opts.playlist ?  'launch' : 'attach'](opts, ctrl)

process.on('SIGINT', () => process.exit())
process.on('exit', () => ui.hide())

module.exports = player
