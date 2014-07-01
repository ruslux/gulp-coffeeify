
_           = require 'lodash'
fs          = require 'fs'
path        = require 'path'
glob        = require 'glob'
through     = require 'through'
through2    = require 'through2'
browserify  = require 'browserify'
coffee      = require 'coffee-script'
File        = require('gulp-util').File
replaceExtension = require('gulp-util').replaceExtension
PluginError = require('gulp-util').PluginError
Readable    = require('stream').Readable || require 'readable-stream'

# キャッシュ
transformCache = {}
aliasMap = {}

# エラー
RED   = '\u001b[31m'
RESET = '\u001b[0m'
traceError = ->
  args = Array::slice.apply arguments
  if typeof args[0] is 'string'
    args[0] = RED + args[0]
  else
    args.unshift RED

  if typeof args[args.length - 1] is 'string'
    args[args.length - 1] = args[args.length - 1] + RESET
  else
    args.push RESET
  console.error.apply console, args

# 
arrayStream = (items)->
  index = 0
  readable = new Readable objectMode: true
  readable._read = ->
    if index < items.length
      readable.push items[index]
      index++
    else
      readable.push null
  return readable

# 
module.exports = (opts = {})->

  # エイリアスマップを作成
  aliasMap = {}
  if opts.aliases
    aliases = if _.isArray(opts.aliases) then opts.aliases else [opts.aliases]
    aliases.forEach (alias)->
      return unless alias
      { cwd, base, file } = alias
      file.map (pattern)->
        return unless cwd
        dir = cwd
        dir = path.join(process.cwd(), dir) unless dir.match /^\//
        pattern = path.join dir, pattern
        glob.sync(pattern).forEach (file)->
          alias = file.substr(dir.length + 1)
          alias = path.join base, alias if base
          alias = alias.replace /\.[^.]+$/, ''
          aliasMap[alias] = file

  # through
  through2.obj (file, enc, cb)->
    self = this

    if file.isStream()
      return cb new PluginError 'gulp-browserify', 'Streaming not supported'

    opts.filename = file.path
    opts.data = file.data if file.data

    srcFile  = file.path
    srcContents = String file.contents

    destFile = replaceExtension(file.path, '.js')

    data = {}
    if file.isNull()
      data.entries = file.path
    if file.isBuffer()
      data.entries = arrayStream [file.contents]

    opts.basedir = path.dirname(file.path)

    unless opts.extensions
      opts.extensions = ['.js', '.coffee', '.json', '.cson']

    opts.commondir = true
    opts.builtins  = _.defaults require('browserify/lib/builtins'), aliasMap

    b = browserify(data, opts)

    b.transform (file)->

      data = ''
      through ((buf)-> data += buf), ->

        if data is srcContents
          file = srcFile

        extname = path.extname file
        mtime   = fs.statSync(file).mtime.getTime()

        if transformCache.hasOwnProperty(file) and transformCache[file][0] is mtime
          data = transformCache[file][1]
        else
          if transformCache.hasOwnProperty(file)
            console.log 'coffee: recompiling...', file
          else
            console.log 'coffee: compiling...', file

          if extname is '.coffee' or extname is '.cson'
            try
              data = "module.exports =\n" + data if extname is '.cson'
              data = coffee.compile data
              transformCache[file] = [mtime, data]
            catch e
              traceError 'coffee: COMPILE ERROR: ', e.message + ': line ' + (e.location.first_line + 1), 'at', file
              data = ''

        @queue data
        @queue null
        return

    b.bundle (err, jsCode)->

      if err
        console.error err
        return

      else

        # 書き出し
        file.contents = new Buffer jsCode

        # 
        console.info "browserify:", srcFile, ">", destFile

        file.path = destFile
        self.push file
      
      # コールバック
      cb()
