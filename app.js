var colors = require('colors');
var cpp = require('./index');

process.on('SIGINT', function() {
	console.log("Caught interrupt signal");
	cpp.dump(function() {
		process.exit();
	});
});

cpp
	.base('/home/mc/Papers/Pictures')
	.add('/home/mc/Papers/Pictures')
	.dest('/tmp/cp-persistant')
	.on('precopy', function(path, dest) {
		// console.log('[COPY]'.bgWhite.black, path, colors.bold.blue('=>'), dest);
		console.log('[CPY]'.bgWhite.black, path);
	})
	.on('postcopy', function(path, dest) {
		// console.log('[OK ]'.bgWhite.black, path);
	})
	.on('dir', function(path) {
		console.log('[DIR]'.bgWhite.black, path);
	})
	.on('rewrite', function(path, dest) { // Occurs when a destination file exists but the size mismatches - this is usually due to interuppted copy operations
		console.log('[AGN]'.bgWhite.black, path);
	})
	.on('error', function(err, path, dest) {
		console.log('[ERR]'.bold.red, path, colors.red(err));
	})
	.on('skip', function(err, path, dest) {
		console.log('[SKP]'.grey, path);
	})
	.on('blacklisted', function(err, path, dest) {
		console.log('[BLK]'.bgWhite.red, path);
	})
	.on('blackListLoad', function(number) {
		console.log('Loaded', colors.cyan(number), 'entries from black list file', colors.cyan(cpp.settings.blackList));
	})
	.on('blackListSave', function(number) {
		console.log('Saved', colors.cyan(number), 'entries to black list file', colors.cyan(cpp.settings.blackList));
	})
	.exec();
