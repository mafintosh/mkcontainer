var fs = require('fs')
var bitfield = require('sparse-bitfield')
var uint48be = require('uint48be')

module.exports = combine

function combine (diffs, container, cb) {
  var fd = -1
  var out = fs.openSync(container, 'w')
  var blocks = bitfield()
  var truncated = false

  loop(null)

  function loop (err) {
    if (err) return done(err)

    var next = diffs.pop()
    var pos = 0
    var first = true

    fd = -1
    if (!next) return cb()

    fd = fs.openSync(next, 'r')
    read(null)

    function read (err) {
      if (err) return done(err)
      var block = Buffer.alloc(4096 + 6)
      fs.read(fd, block, 0, block.length, pos, afterRead)
    }

    function afterRead (err, bytes, buf) {
      if (err) return done(err)
      if (!bytes) return fs.close(fd, loop)
      if (bytes !== (4096 + 6)) return done(new Error('Bad block'))

      pos += bytes

      if (first) {
        first = false
        var header = JSON.parse(buf.slice(0, buf.indexOf(0)))
        if (truncated) return read()
        truncated = true
        fs.ftruncate(out, header.blocks * 4096, read)
        return
      }

      var blockNumber = uint48be.decode(buf)
      if (!blocks.set(blockNumber, true)) return read()

      fs.write(out, buf.slice(6), 0, 4096, blockNumber * 4096, read)
    }
  }

  function done (err) {
    fs.close(out, function () {
      if (fd === -1) return cb(err)
      fs.close(fd, function () {
        cb(err)
      })
    })
  }
}
