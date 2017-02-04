const fs = require('fs');
const util = require('util');
const rangeParser = require('range-parser');
const mime = require('mime');

module.exports = (req, res, filePath) => {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;
  const type = mime.lookup(filePath);

  res.setHeader('Content-Type', type);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!range) {
    res.setHeader('Content-Length', total);
    res.statusCode = 200;
    return fs.createReadStream(filePath).pipe(res);
  }

  const part = rangeParser(total, range)[0];
  const chunksize = (part.end - part.start) + 1;
  const file = fs.createReadStream(filePath, {start: part.start, end: part.end});

  res.setHeader('Content-Range', 'bytes ' + part.start + '-' + part.end + '/' + total);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', chunksize);
  res.statusCode = 206;

  return file.pipe(res);
};
