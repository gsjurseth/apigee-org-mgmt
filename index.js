var jf      = require('jsonfile'),
  util      = require('util'),
  request   = require('request'),
  _         = require('lodash'),
  S         = require('string'),
  log4js    = require('log4js'),
  async     = require('async');


//var ApigeeMGMT = {};
var logger;
var orgUrl;
var reqOpts;
var orgList = ['environments','apiproducts','developers','companies','apps','keyvaluemaps'];
var envList = ['apis','developers','keyvaluemaps'];
var devHash = {};

function ApigeeMGMT(opts) {
    reqOpts = opts.reqOpts;
    orgUrl  = opts.orgUrl;
    logger  = log4js.getLogger();
    logger.setLevel( opts.debugLevel );

    logger.trace( 'Here are the options we got: %s', util.inspect(opts) );
}

ApigeeMGMT.prototype.fetchVirtualhosts = function( env, callback ) {
   this.fetchPath( 'environments/' + env + '/virtualhosts/', callback );
};

ApigeeMGMT.prototype.fetchCaches = function( env, callback ) {
   this.fetchPath( 'environments/' + env + '/caches/', callback );
};

ApigeeMGMT.prototype.fetchKeyvaluemaps = function( env, callback ) {
   this.fetchPath( 'environments/' + env + '/keyvaluemaps/', callback );
};

ApigeeMGMT.prototype.fetchKeystores = function( env, callback ) {
   this.fetchPath( 'environments/' + env + '/keystores/', callback );
};

ApigeeMGMT.prototype.listEnvironments = function( callback ) {
   this.fetchResource( 'environments/', callback );
};

ApigeeMGMT.prototype.fetcEnvironment = function( env, callback ) {
   this.fetchPath( 'environments/' + env, callback );
};

ApigeeMGMT.prototype.fetchProducts = function( callback ) {
   this.fetchPath( 'apiproducts/', callback );
};

ApigeeMGMT.prototype.fetchCompanies = function( callback ) {
   this.fetchPath( 'companies/', callback );
};

ApigeeMGMT.prototype.fetchDevelopers = function( callback ) {
   this.fetchPath( 'developers/', callback );
};

// support fetching both company and developer apps
// @param type for developer or company
ApigeeMGMT.prototype.fetchApps = function( type,name,callback ) {
   this.fetchPath( type + '/' + name, callback );
};

ApigeeMGMT.prototype.fetchAll = function( cb ) {
  var self=this;
  async.series([
    //Use a map to fetch all those things directly under the org path
    function(acb) {
      async.map( orgList,
        function(i,dcb) {
          self.fetchPath( i + '/', dcb);
        },
        function(err,res) {
          if (err) {
            logger.error("failure here: %s", err);
          }
          else {
            acb(null,res);
          }
        }
      );
    },
    //environments waterfall -> descends into vhosts, caches, etc
    function(acb) {
      async.waterfall( [
        function(bcb) {
          self.fetchEnvironments(bcb);
        },
        function(envs,bcb) {
          async.map( envs.result,
          function(env,bcb) {
            async.parallel([
              function(callback) {
                self.fetchCaches(env, callback);
              },
              function(callback) {
                self.fetchKeystores(env, callback);
              },
              function(callback) {
                self.fetchKeyvaluemaps(env, callback);
              },
              function(callback) {
                self.fetchVirtualhosts(env, callback);
              }
            ],
            function(e,r) {
              if (e) {
                console.error( "We failed: %s", util.inspect(e) );
                bcb(e);
              }
              else {
                bcb(null,r);
              }
            });
          },
          function(err,res) {
            if (err) {
              logger.error("we failed here: %s", err);
            }
            else {
              bcb(null,res);
            }
          });
        }
      ],
      function(err,res) {
        if (err) {
          logger.error('We failed: %s', err);
        }
        else {
          acb(null,res);
        }
      });
    }],
    function(err,res) {
      if (err) {
        logger.error("We failed: %s ", err);
      }
      else {
        cb(null,_.flatten(res));
      }
    }
  );
};

ApigeeMGMT.prototype.fetchPath = function( relPath,cb ) {
  var self=this;
  async.waterfall( [
    function(dcb) {
      self.fetchResource( relPath, dcb);
    },
    //Grab the vhosts for the given environment
    function(stuff,dcb) {
      async.map( stuff.result,
        function(thingy,callback) {
          self.fetchResource( relPath + encodeURIComponent(thingy), callback);
        },
        function(err,res) {
          if (err) {
            dcb(err);
          }
          else {
            logger.trace('Should be %s: %s', relPath,util.inspect(res,true) );
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
};

ApigeeMGMT.prototype.fetchResource = function( type,callback ) {
  var url = orgUrl + '/' + type;

  logger.trace('Fetching json data from url: %s', url );

  async.series( [
    function(cb) {
      request.get( url, reqOpts, function(err, res, body) {
        if (err) {
          cb( 'Failed to fetch type: ' + type );
          //logger.error('Failed fetching json data from url: %s. Failed with error: %s', url, err );
        }
        else if (res.statusCode == 200) {
          logger.trace( 'Successfully fetched json for url: %s', url );
          var daBody = JSON.parse(body);
          logger.trace( 'The body is: %s', util.inspect(daBody) );

          // Spooky logic .. just for cleanup and it's all gotta be hardcoded, unfortunately
          if (type.indexOf('apps/') === 0) {
            type="apps/" + daBody.name;
            daBody.developerEmail = devHash[ daBody.developerId ];
          }
          if (type.indexOf('developers/') === 0) {
            devHash[ daBody.developerId ] = daBody.developerEmail;
          }
          cb(null, { 'type': type, result: daBody });
        }
        else {
          logger.error('fetchResource received unexpected response while fetching json for url: %s. Response code: %s', url, res.statusCode );
          logger.error('Received following error body: %s', body );
          cb( 'Failed to fetch type: ' + type );
        }
      });
    }],
    function(err,res) {
      if (err) {
        callback(err);
      }
      else {
        callback(null,res[0]);
      }
    }
  );
};

module.exports = ApigeeMGMT;
