(function() {
  var File, PluginError, RED, RESET, Readable, aliasMap, arrayStream, browserify, coffee, fs, glob, path, replaceExtension, through, through2, traceError, transformCache, _;

  _ = require('lodash');

  fs = require('fs');

  path = require('path');

  glob = require('glob');

  through = require('through');

  through2 = require('through2');

  browserify = require('browserify');

  coffee = require('coffee-script');

  File = require('gulp-util').File;

  replaceExtension = require('gulp-util').replaceExtension;

  PluginError = require('gulp-util').PluginError;

  Readable = require('stream').Readable || require('readable-stream');

  transformCache = {};

  aliasMap = {};

  RED = '\u001b[31m';

  RESET = '\u001b[0m';

  traceError = function() {
    var args;
    args = Array.prototype.slice.apply(arguments);
    if (typeof args[0] === 'string') {
      args[0] = RED + args[0];
    } else {
      args.unshift(RED);
    }
    if (typeof args[args.length - 1] === 'string') {
      args[args.length - 1] = args[args.length - 1] + RESET;
    } else {
      args.push(RESET);
    }
    return console.error.apply(console, args);
  };

  arrayStream = function(items) {
    var index, readable;
    index = 0;
    readable = new Readable({
      objectMode: true
    });
    readable._read = function() {
      if (index < items.length) {
        readable.push(items[index]);
        return index++;
      } else {
        return readable.push(null);
      }
    };
    return readable;
  };

  module.exports = function(opts) {
    var aliases;
    if (opts == null) {
      opts = {};
    }
    aliasMap = {};
    if (opts.aliases) {
      aliases = _.isArray(opts.aliases) ? opts.aliases : [opts.aliases];
      aliases.forEach(function(alias) {
        var base, cwd, file;
        if (!alias) {
          return;
        }
        cwd = alias.cwd, base = alias.base, file = alias.file;
        return file.map(function(pattern) {
          var dir;
          if (!cwd) {
            return;
          }
          dir = cwd;
          if (!dir.match(/^\//)) {
            dir = path.join(process.cwd(), dir);
          }
          pattern = path.join(dir, pattern);
          return glob.sync(pattern).forEach(function(file) {
            alias = file.substr(dir.length + 1);
            if (base) {
              alias = path.join(base, alias);
            }
            alias = alias.replace(/\.[^.]+$/, '');
            return aliasMap[alias] = file;
          });
        });
      });
    }
    return through2.obj(function(file, enc, cb) {
      var b, data, destFile, self, srcContents, srcFile;
      self = this;
      if (file.isStream()) {
        return cb(new PluginError('gulp-browserify', 'Streaming not supported'));
      }
      opts.filename = file.path;
      if (file.data) {
        opts.data = file.data;
      }
      srcFile = file.path;
      srcContents = String(file.contents);
      destFile = replaceExtension(file.path, '.js');
      data = {};
      if (file.isNull()) {
        data.entries = file.path;
      }
      if (file.isBuffer()) {
        data.entries = arrayStream([file.contents]);
      }
      opts.basedir = path.dirname(file.path);
      if (!opts.extensions) {
        opts.extensions = ['.js', '.coffee', '.json', '.cson'];
      }
      opts.commondir = true;
      opts.builtins = _.defaults(require('browserify/lib/builtins'), aliasMap);
      b = browserify(data, opts);
      b.transform(function(file) {
        data = '';
        return through((function(buf) {
          return data += buf;
        }), function() {
          var e, extname, mtime;
          if (data === srcContents) {
            file = srcFile;
          }
          extname = path.extname(file);
          mtime = fs.statSync(file).mtime.getTime();
          if (transformCache.hasOwnProperty(file) && transformCache[file][0] === mtime) {
            data = transformCache[file][1];
          } else {
            if (transformCache.hasOwnProperty(file)) {
              console.log('coffee: recompiling...', file);
            } else {
              console.log('coffee: compiling...', file);
            }
            if (extname === '.coffee' || extname === '.cson') {
              try {
                if (extname === '.cson') {
                  data = "module.exports =\n" + data;
                }
                data = coffee.compile(data);
                transformCache[file] = [mtime, data];
              } catch (_error) {
                e = _error;
                traceError('coffee: COMPILE ERROR: ', e.message + ': line ' + (e.location.first_line + 1), 'at', file);
                data = '';
              }
            }
          }
          this.queue(data);
          this.queue(null);
        });
      });
      return b.bundle(function(err, jsCode) {
        if (err) {
          console.error(err);
          return;
        } else {
          file.contents = new Buffer(jsCode);
          console.info("browserify:", srcFile, ">", destFile);
          file.path = destFile;
          self.push(file);
        }
        return cb();
      });
    });
  };

}).call(this);
