var fs = require('fs')
var uint48be = require('uint48be')

var blockSize = 4096
var empty = Buffer.alloc(4096)

module.exports = diffImages

function diffImages (a, b, out, cb) {
  var readA = createIterator(a)
  var readB = createIterator(b)
  var out = fs.createWriteStream(out)
  var st = fs.statSync(b)

  var header = {blocks: Math.ceil(st.size / 4096)}
  var preamble = Buffer.alloc(4096 + 6)

  preamble.write(JSON.stringify(header))
  out.write(preamble)

  var nextA
  var nextB
  var doneA
  var doneB

  var cnt = 0
  var block = 0
  var dirty = []

  tick()

  function diff () {
    for (var i = 0; i < nextA.length; i += blockSize) {
      block++
      var j = i + blockSize
      if (nextA.compare(nextB, i, j, i, j) === 0) continue
      dirty.push({block: block - 1, buffer: nextB.slice(i, j)})
    }

    if (dirty.length) commit()
    else tick()
  }

  function commit () {
    var copy = Buffer.allocUnsafe(dirty.length * (4096 + 6))
    var ptr = 0

    for (var i = 0; i < dirty.length; i++) {
      uint48be.encode(dirty[i].block, copy, ptr)
      dirty[i].buffer.copy(copy, ptr + 6)
      ptr += (4096 + 6)
    }

    out.write(copy)
    dirty = []
    tick()
  }

  function done (err) {
    out.end(function () {
      cb(err)
    })
  }

  function tick () {
    if (doneA && doneB) return done()
    nextA = nextB = null
    readA(ona)
    readB(onb)
  }

  function ona (err, buf, done) {
    if (err) throw err
    nextA = buf
    doneA = done
    if (nextB) diff()
  }

  function onb (err, buf, done) {
    if (err) throw err
    nextB = buf
    doneB = done
    if (nextA) diff()
  }

  function createIterator (filename) {
    var buffer = Buffer.alloc(128 * blockSize)
    var fd = fs.openSync(filename, 'r')
    var pos = 0

    return next

    function next (cb) {
      var rel = 0

      fs.read(fd, buffer, 0, buffer.length, pos, function loop (err, read) {
        if (err) return cb(err)

        if (!read) {
          buffer.fill(0, rel)
          cb(null, buffer, true)
          return
        }

        rel += read
        pos += read

        if (rel < buffer.length) {
          fs.read(fd, buffer, rel, buffer.length - rel, pos, loop)
          return
        }

        cb(null, buffer, false)
      })
    }

  }
}
