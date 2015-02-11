var async = require('async-chainable');
var fs = require('fs');
var fspath = require('path');
var events = require('events');
var mkdirp = require('mkdirp');
var util = require('util');

function CPPersistant() {
	this.settings = {
		base: '',
		dest: '/tmp/cp-persistant',
		blackList: '/tmp/cp-persistant.blacklist',
	};

	this.blackList = {};

	this.exec = function(options) {
		if (options) // Import options if any
			for (var k in options)
				this.settings[k] = options[k];

		if (this.settings.blackList && fs.existsSync(this.settings.blackList)) {
			this.blackList = JSON.parse(fs.readFileSync(this.settings.blackList));
			this.emit('blackListLoad', this.settings.blackList.length);
		}

		this._step();
		return this;
	};

	// Basic settings setters {{{
	this.base = function(path) {
		this.settings.base = path;
		return this;
	};

	this.dest = function(path) {
		this.settings.dest = path;
		return this;
	};

	this.add = function(path) {
		this._fileStack.push(path);
		return this;
	};
	// }}}

	/**
	* Process is existing - dump all black list entities
	*/
	this.dump = function(next) {
		if (this.settings.blackList) {
			this.emit('blackListSave', this.blackList.length);
			fs.writeFile(this.settings.blackList, JSON.stringify(this.blackList), function(err) {
				if (err) throw new Error('Error saving black list file - ' + err);
				next();
			});
		} else {
			next();
		}
	};

	this._fileStack = [];

	this._step = function() {
		var self = this;
		if (this._fileStack.length) {
			var path = this._fileStack.shift();
			var stats = fs.statSync(path);

			if (stats.isDirectory()) {
				fs.readdir(path, function(err, contents) {
					if (err) {
						return self.emit('error', err, path);
					} else {
						self.emit('dir', path, contents);
						contents.forEach(function(p) {
							self._fileStack.push(path + '/' + p);
						});
					}
					self._step();
				});
			} else {
				var dest = path;
				if (this.settings.base && path.substr(0, this.settings.base.length) == this.settings.base)
					dest = path.substr(this.settings.base.length);
				dest = this.settings.dest + dest;

				async()
					.then(function(next) {
						fs.stat(dest, function(err, dStats) {
							if (dStats && dStats.size == stats.size) {
								return next('ALREADY-EXISTS');
							} else if (dStats) {
								self.emit('rewrite', path, dest);
								return next();
							} else {
								return next();
							}
						});
					})
					.then(function(next) {
						if (self.blackList[path]) return next('BLACKLISTED');
						self.emit('precopy', path, dest);
						next();
					})
					.then(function(next) {
						mkdirp(fspath.dirname(dest), next);
					})
					/*.then(function(next) {
						if (Math.random() > 0.5) return next('Simulated read error');
						next();
					}) */
					.then(function(next) {
						var reader = fs.createReadStream(path);
						var writer = fs.createWriteStream(dest);
						reader
							.pipe(writer)
							.on('close', function(err) {
								if (err) return next('error', path, dest);
								next();
							})
							.on('error', function(err) {
								next(err);
							});
					})
					.then(function(next) {
						fs.utimes(dest, stats.atime, stats.mtime, next);
					})
					.end(function(err) {
						if (err && err == 'ALREADY-EXISTS') {
							self.emit('skip', path, dest);
						} else if (err && err == 'BLACKLISTED') {
							self.emit('blacklisted', path, dest);
						} else if (err) {
							self.blackList[path] = 1;
							self.emit('error', err, path, dest);
						}
						self.emit('postcopy', path, dest);
						self._step();
					});
			}
		}
	};
}
util.inherits(CPPersistant, events.EventEmitter);

module.exports = new CPPersistant();
