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

let ctrl = function(err, p, ctx) {
  if (err) {
    ui.hide()
    debug('player error: %o', err)
    console.log(chalk.red(err))
    process.exit()
  }

  let playlist = ctx.options.playlist
  let volume
  let is_keyboard_interactive = process.stdin.isTTY || false

  if (is_keyboard_interactive) {
    keypress(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()
  }

  ctx.once('closed', function() {
    ui.hide()
    console.log(chalk.red('lost connection'))
    process.exit()
  })

  // get initial volume
  p.getVolume(function(err, status) {
    volume = status
  })

  if (!ctx.options.disableTimeline) {
    p.on('position', function(pos) {
      ui.setProgress(pos.percent)
      ui.render()
    })
  }

  let seek = debouncedSeeker(function(offset) {
    if (ctx.options.disableSeek || offset === 0) return
    let seconds = Math.max(0, (p.getPosition() / 1000) + offset)
    debug('seeking to %s', seconds)
    p.seek(seconds)
  }, 500)

  let updateTitle = function() {
    p.getStatus(function(err, status) {
      if (!status || !status.media ||
          !status.media.metadata ||
          !status.media.metadata.title) return

      let metadata = status.media.metadata
      let title
      if (metadata.artist) {
        title = metadata.artist + ' - ' + metadata.title
      } else {
        title = metadata.title
      }
      ui.setLabel('source', 'Source', title)
      ui.showLabels('state', 'source')
      ui.render()
    })
  }

  let initialSeek = function() {
    let seconds = unformatTime(ctx.options.seek)
    debug('seeking to %s', seconds)
    p.seek(seconds)
  }

  p.on('playing', updateTitle)

  if (!ctx.options.disableSeek && ctx.options.seek) p.once('playing', initialSeek)

  updateTitle()

  let nextInPlaylist = function() {
    if (ctx.mode !== 'launch') return
    if (!playlist.length) return process.exit()
    p.stop(function() {
      ui.showLabels('state')
      debug('loading next in playlist: %o', playlist[0])
      p.load(playlist[0], noop)
      let file = playlist.shift()
      if (ctx.options.loop) playlist.push(file)
    })
  }

  p.on('status', last(function(status, memo) {
    if (opts.exit && status.playerState == 'PLAYING') process.exit()
    if (status.playerState !== 'IDLE') return
    if (status.idleReason !== 'FINISHED') return
    if (memo && memo.playerState === 'IDLE') return
    nextInPlaylist()
    return status
  }))

  let keyMappings = {

    // toggle between play / pause
    space: function() {
      if (p.currentSession.playerState === 'PLAYING') {
        p.pause()
      } else if (p.currentSession.playerState === 'PAUSED') {
        p.play()
      }
    },

    // toggle between mute / unmute
    m: function() {
      if(!volume) {
        return
      } else if (volume.muted) {
        p.unmute(function(err, status) {
          if (err) return
          volume = status
        })
      } else {
        p.mute(function(err, status) {
          if (err) return
          volume = status
        })
      }
    },

    t: function() {
      if (!p.currentSession.media.tracks) { return }
      var sessionRequestBody = {
        type: 'EDIT_TRACKS_INFO'
      }
      sessionRequestBody.activeTrackIds = p.currentSession.activeTrackIds ? [] : [1]
      p.sessionRequest(sessionRequestBody)
    },

    // volume up
    up: function() {
      if (!volume || volume.level >= 1) {
        return
      }

      var newVolume = Math.min(volume.level + volumeStep, 1)

      p.setVolume(newVolume, function(err, status) {
        if (err) {
          return
        }

        debug("volume up: %s", status.level)

        volume = status
      })
    },

    // volume down
    down: function() {
      if (!volume || volume.level <= 0) {
        return
      }

      var newVolume = Math.max(volume.level - volumeStep, 0)

      p.setVolume(newVolume, function(err, status) {
        if (err) {
          return
        }

        debug("volume down: %s", status.level)

        volume = status
      })
    },

    // next item in playlist
    n: function() {
      nextInPlaylist()
    },

    // stop playback
    s: function() {
      p.stop()
    },

    // quit
    q: function() {
      process.exit()
    },

    // Rewind, one "seekCount" per press
    left: function() {
      seek(-30)
    },

    // Forward, one "seekCount" per press
    right: function() {
      seek(30)
    }
  }

  if (is_keyboard_interactive) {
    process.stdin.on('keypress', function(ch, key) {
      if (key && key.name && keyMappings[key.name]) {
        debug('key pressed: %s', key.name)
        keyMappings[key.name]()
      }
      if (key && key.ctrl && key.name == 'c') {
        process.exit()
      }
    })
  }

  if (opts.command) {
    let commands = opts.command.split(",")
    commands.forEach(function(command) {
      if (!keyMappings[command]) {
        fatalError('invalid --command: ' + command)
      }
    })

    let index = 0
    function run_commands() {
      if (index < commands.length) {
        let command = commands[index++]
        keyMappings[command]()
        p.getStatus(run_commands)
      } else {
        if (opts.exit) {
          process.exit()
        }
      }
    }

    p.getStatus(run_commands)
  }
}

const capitalize = function(str) {
  return str.substr(0, 1).toUpperCase() + str.substr(1)
}

let logState = (function() {
  let inter
  let dots = circulate(['.', '..', '...', '....'])
  return function(status) {
    if (inter) clearInterval(inter)
    debug('player status: %s', status)
    inter = setInterval(function() {
      ui.setLabel('state', 'State', capitalize(status) + dots())
      ui.render()
    }, 300)
  }
})()

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
