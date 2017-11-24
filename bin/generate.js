#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var os = require('os')
var sodium = require('sodium-native')

var input = process.argv[2] || 'Containerfile'
var container = 'container.img'
var cache = path.join(os.homedir(), '.mkcontainer/cache')

var c = prepare(parse(fs.readFileSync(input)))
var makefile = generate(c)

fs.writeFileSync('Makefile', makefile)

function generate (c) {
  var make = ''
  var layers = []
  var caches = c.map(inp => inp.cache)
  var forcing = false

  make += '$(CONTAINER): ' + input + ' ' + caches.join(' ') + '\n'
  make += '\t@ echo Constructing $(CONTAINER) ...\n'
  make += '\t@ rm -f tmp.img tmp.diff tmp.img.prev\n'
  make += '\t@ mkcontainer-image ' +
    caches.map(c => '-d ' + c + ' ').join('') + '-o $(CONTAINER)\n\n'

  c.forEach(function (inp) {
    if (inp.force) forcing = true
    make += inp.cache + ': ' + (inp.force ? '.force ' : '') + inp.input.join(' ') + '\n'
    inp.sh.forEach(function (sh) {
      make += '\t' + sh + '\n'
    })
    make += '\n'
  })

  c.forEach(function (inp) {
    var id = 'D' + layers.length
    layers.push(id + '=' + inp.cache)
    make = make.replace(new RegExp(inp.cache.replace('$(CACHE)', '\\$\\(CACHE\\)'), 'g'), '$(' + id + ')')
  })

  var vars = 'CONTAINER=' + container + '\n' +
    'CACHE=' + cache + '\n'

  make = vars + layers.join('\n') + '\n\n' + make.trim()

  if (forcing) {
    make += '\n\n.force:\n'
  }

  return make.trim() + '\n'
}

function prepare (c) {
  c.forEach(makeShell)
  return c
}

function makeShell (inp, i, all) {
  var cache = '$(CACHE)'
  var img = 'tmp.img'
  var diff = 'tmp.diff'
  var prev = all.slice(0, i)

  inp.sh.push('@ echo ' + JSON.stringify(inp.line))

  switch (inp.type) {
    case 'from':
      var tmp = '@ mkcontainer-bootstrap --force --' + inp.os + (inp.version ? (' ' + inp.version) : '') + ' ' + img
      inp.sh.push(tmp.trim())
      inp.sh.push('@ mkcontainer-diff -i ' + img + ' --tmp ' + diff + ' -o $@')
      inp.input = []
      inp.output = diff
      break

    case 'run':
      inp.sh.push('@ mkcontainer-image ' + prev.map(p => '-d ' + p.cache + ' ').join('') + '-o ' + img)
      inp.sh.push('@ sudo systemd-nspawn -q -a -i ' + img + ' /bin/sh -c ' + JSON.stringify(inp.command))
      inp.sh.push('@ mkcontainer-diff ' + prev.map(p => '-d ' + p.cache + ' ').join('') + '-i ' + img + ' --tmp ' + diff + ' -o $@')
      inp.input = prev.map(p => p.cache)
      inp.output = diff
      break

    case 'copy':
      inp.sh.push('@ mkcontainer-image ' + prev.map(p => '-d ' + p.cache + ' ').join('') + '-o ' + img)
      inp.sh.push('@ mkdir -p mnt')
      inp.sh.push('@ sudo mkcontainer-mount -f ' + img + ' mnt')
      inp.sh.push('@ sudo cp -r ' + inp.from + ' mnt' + inp.to)
      inp.sh.push('@ sudo umount mnt')
      inp.sh.push('@ rmdir mnt')
      inp.sh.push('@ mkcontainer-diff ' + prev.map(p => '-d ' + p.cache + ' ').join('') + '-i ' + img + ' --tmp ' + diff + ' -o $@')
      inp.input = prev.map(p => p.cache).concat(inp.from)
      inp.output = diff
      break
  }

  // -1 + slice(1) because first line is the echo itself
  var hashable = [inp.type, '' + inp.sh.length - 1].concat(inp.sh.slice(1))

  inp.hash = hashArray(hashable)
  inp.cache = path.join(cache, inp.hash.slice(0, 2), inp.hash.slice(2, 4), inp.hash.slice(4))
}

function parse (inp) {
  return inp.toString().trim().split('\n').map(function parse (line) {
    var i = line.indexOf(' ')
    var cmd = line.slice(0, i).trim().toLowerCase()
    var arg = line.slice(i).trim()
    var args = arg.split(' ')
    var first = args[0].trim()

    if (cmd === 'force') {
      var next = parse(line.slice(6).trim())
      next.force = true
      return next
    }

    switch (cmd) {
      case 'from':
        return {type: 'from', line: line, os: first.split(':')[0], version: first.split(':')[1], hash: null, sh: []}
      case 'run':
        return {type: 'run', line: line, command: arg, hash: null, sh: []}
      case 'copy':
        return {type: 'copy', line: line, from: args[0], to: args[1], sh: []}
      default:
        throw new Error('Unknown line: ' + line)
    }
  })
}

function hashArray (list) {
  var out = Buffer.alloc(32)
  sodium.crypto_generichash(out, Buffer.from(list.join('\n')))
  return out.toString('hex')
}
