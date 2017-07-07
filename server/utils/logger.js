var winston = require('winston');
var path = require('path');
var fs = require('fs');

// Constants
const logPath = process.env.LOG_PATH || '../logs/';
const logFile = process.env.LOG_FILENAME || 'access';
const logLevel = process.env.LOG_LEVEL || 'debug';

// Build the current date for rotation of logs
Date.prototype.yyyymmdd = function() {
   var yyyy = this.getFullYear().toString();
   var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
   var dd  = this.getDate().toString();
   return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]); // padding
  };
var d = new Date();

var logDir = path.join(__dirname, logPath);
var logDirFile = path.join(logDir + logFile + '-' + d.yyyymmdd() + '.log');

if (!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

// We want to see what errors Winston is throwing out
winston.emitErrs = true;

// Log to both console and file simultaneously
var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: logLevel,
            filename: logDirFile,
            handleExceptions: true,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 30,
            colorize: false
        }),
        new winston.transports.Console({
            level: logLevel,
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

logger.debug('-- Logger initialised!');

module.exports = logger;
module.exports.stream = {
    write: function(message, encoding){
        logger.info(message);
    }
};
