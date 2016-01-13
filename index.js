var jf      = require('jsonfile'),
  util      = require('util'),
  request   = require('request'),
  _         = require('underscore'),
  S         = require('string'),
  log4js    = require('log4js'),
  async     = require('async');


//var ApigeeMGMT = {};
var logger;
var orgUrl;
var reqOpts;

function ApigeeMGMT(opts) {
    reqOpts = opts.reqOpts;
    orgUrl  = opts.orgUrl;
    logger  = log4js.getLogger();
    logger.setLevel( opts.debugLevel );

    logger.trace( 'Here are the options we got: %s', util.inspect(opts) );
}

ApigeeMGMT.prototype.fetchPath = function( relPath,cb ) {
  async.waterfall( [
    function(dcb) {
      ApigeeMGMT.prototype.fetchResource( relPath, dcb);
    },
    //Grab the vhosts for the given environment
    function(vhosts,dcb) {
      async.map( vhosts.result,
        function(vhost,callback) {
          ApigeeMGMT.prototype.fetchResource( relPath + vhost, callback);
        },
        function(err,res) {
          if (err) {
            dcb(err);
          }
          else {
            logger.trace('Should be vhosts: %s', util.inspect(res,true) );
            dcb(null,res);
          }
        }
    );
  }],
  function(err,res) {
    if (err) {
      cb(err);
    }
    else {
      cb(null,res);
    }
  }
  );
}

ApigeeMGMT.prototype.fetchEnvironments = function() {
  async.waterfall( [
    function(cb) {
      ApigeeMGMT.prototype.fetchResource('environments', cb);
    },
    //Grab the environments themselves
    function(envs,cb) {
      async.series(
        [
          function(dcb) {
            async.map( envs.result,
              function(env,callback) {
                logger.trace('Working on environment: %s', util.inspect(env));
                ApigeeMGMT.prototype.fetchResource('environments/' + env, callback);
              },
              function(err,results) {
                if (err) {
                  logger.error('We done failed: %s', err);
                  cb(err);
                }
                else {
                  dcb(null, results);
                }
              }
            );
          },
          function(dcb) {
            async.map( envs.result,
              function(env,callback) {
                logger.trace('Working on vhosts for environment: %s', util.inspect(env));
                ApigeeMGMT.prototype.fetchPath( 'environments/' + env + '/virtualhosts/', callback);
              },
              function (err,res) {
                if (err) {
                  dcb(err);
                }
                else {
                  dcb(null,res);
                }
              }
            );
          }
        ],
      function(err,res){
        if (err) {
          cb(err);
        }
        else {
          cb(null,res);
        }
      });
    },
  ],
  function(err,res) {
    if (err) {
      logger.warn('This is the error: %s', err);
    }
    else {
      logger.info('We\'re all done here: %s', util.inspect(res,true));
    }
  });
}

ApigeeMGMT.prototype.fetchResource = function( type,callback ) {
  var url = orgUrl + '/' + type;

  logger.debug('Fetching json data from url: %s', url );

  async.series( [
    function(cb) {
      request.get( url, reqOpts, function(err, res, body) {
        if (err) {
          cb( 'Failed to fetch type: ' + type );
          //logger.error('Failed fetching json data from url: %s. Failed with error: %s', url, err );
        }
        else if (res.statusCode == 200) {
          logger.debug( 'Successfully fetched json for url: %s', url );
          var daBody = JSON.parse(body);
          logger.trace( 'The body is: %s', util.inspect(daBody) );
          cb(null, { 'type': type, result: daBody });
        }
        else {
          logger.error('getResource received unexpected response while fetching json for url: %s. Response code: %s', url, res.statusCode );
          logger.error('Received following error body: %s', body );
          cb( 'Failed to fetch type: ' + type );
        }
      });
    }],
    function(err,res) {
      if (err) {
        return false;
      }
      else {
        callback(null,res[0]);
      }
    }
  );
};

module.exports = ApigeeMGMT;
