var http = require('http');
var https = require('https');
var internalIp = require('internal-ip');
var Transcoder = require('stream-transcoder');
var grabOpts = require('../utils/grab-opts');
var debug = require('debug')('castnow:transcode');

const get = (path, cb) => (/https/.test(path) ? https : http).get(path, cb);

var transcode = function(ctx, next) {
  if (ctx.mode !== 'launch' || !ctx.options.tomp4) return next();
  if (ctx.options.playlist.length > 1) return next();
  var orgPath = ctx.options.playlist[0].path;
  var port = ctx.options['transcode-port'] || 4103;
  var ip = ctx.options.myip || internalIp.v4.sync();
  ctx.options.playlist[0] = {
    path: 'http://' + ip + ':' + port,
    type: 'video/mp4'
  };
  ctx.options.disableTimeline = true;
  ctx.options.disableSeek = true;
  http.createServer(function(req, res) {
    var opts = grabOpts(ctx.options, 'ffmpeg-');
    debug('incoming request for path %s', orgPath);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*'
    });

    const onResponse = response => {
      const trans = new Transcoder(response)
        .videoCodec('h264')
        .format('mp4')
        .custom('strict', 'experimental')
        .on('finish', function() {
          debug('finished transcoding');
        })
        .on('error', function(err) {
          debug('transcoding error: %o', err);
        });
      for (var key in opts) {
        trans.custom(key, opts[key]);
      }

      var args = trans._compileArguments();
      args = [ '-i', '-' ].concat(args);
      args.push('pipe:1');
      debug('spawning ffmpeg %s', args.join(' '));

      trans.stream().pipe(res);
    };

    get(orgPath, onResponse)
      .on('error', err => debug('got error: %o', err));

  }).listen(port);
  debug('started webserver on address %s using port %s', ip, port);
  next();
};

module.exports = transcode;
