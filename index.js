var jf      = require('jsonfile'),
  util      = require('util'),
  request   = require('request'),
  _         = require('lodash'),
  S         = require('string'),
  log4js    = require('log4js'),
  promise   = require('bluebird'),
  async     = require('async');


//var ApigeeMGMT = {};
var logger;
var orgUrl;
var reqOpts;
var devHash = {};

var ApigeeMGMT = function(opts) {
    reqOpts = opts.reqOpts;
    orgUrl  = opts.orgUrl;
    this.defaultList = ['environments','apiproducts','developers','companies'];

    this.foo = "I am foo";

    logger  = log4js.getLogger();
    logger.setLevel( opts.debugLevel );

    logger.trace( 'Here are the options we got: %s', util.inspect(opts) );

    // set a default and empty result set for our live data
    this.liveData = [];
};

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

ApigeeMGMT.prototype.fetchTargetservers = function( env, callback ) {
   this.fetchPath( 'environments/' + env + '/targetservers/', callback );
};

ApigeeMGMT.prototype.listEnvironments = function( callback ) {
   this.fetchResource( 'environments/', callback );
};

ApigeeMGMT.prototype.listDevelopers = function( callback ) {
   this.fetchResource( 'developers/', callback );
};

ApigeeMGMT.prototype.listCompanies = function( callback ) {
   this.fetchResource( 'companies/', callback );
};

ApigeeMGMT.prototype.fetchEnvironments = function( callback ) {
   this.fetchPath( 'environments/', callback );
};

ApigeeMGMT.prototype.fetchEnvironment = function( env, callback ) {
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
   this.fetchPath( type + '/' + name + '/apps/', callback );
};

ApigeeMGMT.prototype.addData = function(e,r) {
  console.log("This is this: %s", util.inspect(this.liveData) );
  if (e) {
    logger.error('Failed fetching data: %s', util.inspect(e) );
  }
  else {
    this.liveData.push(r);
  }
};

ApigeeMGMT.prototype.fetchAll = function( list,cb ) {
  var self=this;
  var todoList = list ? list : this.defaultList;
  async.parallel([
    // apiproducts
    function(parallelCB) {
      if ( _.indexOf(todoList,'apiproducts' != -1) ) {
        self.fetchProducts(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              self.liveData = _.concat(self.liveData, r);
              parallelCB(null,'done');
            }
          }
        );
      }
      else {
        parallelCB(null);
      }
    },
    // developers
    function(parallelCB) {
      if ( _.indexOf(todoList,'developers' != -1) ) {
        self.fetchDevelopers(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              self.liveData = _.concat(self.liveData, r);
              parallelCB(null,'done');
            }
          }
        );
      }
      else {
        parallelCB(null);
      }
    },
    // developer apps
    function(parallelCB) {
      if ( _.indexOf(todoList,'developers' != -1) ) {
        async.waterfall([
          function(wfCB) {
            self.listDevelopers(wfCB);
          },
          function(devs,wfCB) {
            async.map(devs.result,
              function(dev,mapCB) {
                self.fetchApps('developers', encodeURIComponent(dev), function(e,r) {
                  if (e) {
                    logger.error('Failed fetching data: %s', util.inspect(e) );
                    mapCB(e);
                  }
                  else {
                    self.liveData = _.concat(self.liveData, r);
                    mapCB(null,'done');
                  }
                })
              },
              function(e,r) {
                if (e) {
                  wfCB(e);
                }
                else {
                  wfCB(null);
                }
              }
            );
          }
        ],
        function(e,r) {
          if (e) {
            parallelCB(e);
          }
          else {
            parallelCB(null);
          }
        });
      }
      else {
        parallelCB(null);
      }
    },
    // companies
    function(parallelCB) {
      if ( _.indexOf(todoList,'companies' != -1) ) {
        self.fetchCompanies(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              self.liveData = _.concat(self.liveData, r);
              parallelCB(null,'done');
            }
          }
        );
      }
      else {
        parallelCB(null);
      }
    },
    // company apps
    function(parallelCB) {
      if ( _.indexOf(todoList,'companies' != -1) ) {
        async.waterfall([
          function(wfCB) {
            self.listCompanies(wfCB);
          },
          function(devs,wfCB) {
            async.map(devs.result,
              function(dev,mapCB) {
                self.fetchApps('companies', encodeURIComponent(dev), function(e,r) {
                  if (e) {
                    logger.error('Failed fetching data: %s', util.inspect(e) );
                    mapCB(e);
                  }
                  else {
                    self.liveData = _.concat(self.liveData, r);
                    mapCB(null,'done');
                  }
                })
              },
              function(e,r) {
                if (e) {
                  wfCB(e);
                }
                else {
                  wfCB(null);
                }
              }
            );
          }
        ],
        function(e,r) {
          if (e) {
            parallelCB(e);
          }
          else {
            parallelCB(null);
          }
        });
      }
      else {
        parallelCB(null);
      }
    },
    // environments
    function(parallelCB) {
      if ( _.indexOf(todoList,'environments' != -1) ) {
        self.fetchEnvironments(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              self.liveData = _.concat(self.liveData, r);
              parallelCB(null,'done');
            }
          }
        );
      }
      else {
        parallelCB(null);
      }
    },
    // environments stuff: virtualhosts, targetservers, keyvaluemaps, and keystores
    function(parallelCB) {
      if ( _.indexOf(todoList,'environments' != -1) ) {
        async.waterfall([
          function(wfCB) {
            self.listEnvironments(wfCB);
          },
          function(envs,wfCB) {
            async.map(envs.result,
              function(env,mapCB) {
                async.parallel([
                  function(pCB) {

                    self.fetchVirtualhosts(env, function(e,r) {
                      if (e) {
                        logger.error('Failed fetching data: %s', util.inspect(e) );
                        pCB(e);
                      }
                      else {
                        self.liveData = _.concat(self.liveData, r);
                        pCB(null,'done');
                      }
                    });
                  },
                  function(pCB) {
                    self.fetchCaches(env, function(e,r) {
                      if (e) {
                        logger.error('Failed fetching data: %s', util.inspect(e) );
                        pCB(e);
                      }
                      else {
                        self.liveData = _.concat(self.liveData, r);
                        pCB(null,'done');
                      }
                    });
                  },
                  function(pCB) {
                    self.fetchKeyvaluemaps(env, function(e,r) {
                      if (e) {
                        logger.error('Failed fetching data: %s', util.inspect(e) );
                        pCB(e);
                      }
                      else {
                        self.liveData = _.concat(self.liveData, r);
                        pCB(null,'done');
                      }
                    });
                  },
                  function(pCB) {
                    self.fetchKeystores(env, function(e,r) {
                      if (e) {
                        logger.error('Failed fetching data: %s', util.inspect(e) );
                        pCB(e);
                      }
                      else {
                        self.liveData = _.concat(self.liveData, r);
                        pCB(null,'done');
                      }
                    });
                  },
                  function(pCB) {
                    self.fetchTargetservers(env, function(e,r) {
                      if (e) {
                        logger.error('Failed fetching data: %s', util.inspect(e) );
                        pCB(e);
                      }
                      else {
                        self.liveData = _.concat(self.liveData, r);
                        pCB(null,'done');
                      }
                    });
                  }
                ],
                function(e,r) {
                  if (e) {
                    mapCB(e);
                  }
                  else {
                    mapCB(null);
                  }
                });
              },
              function(e,r) {
                if (e) {
                  wfCB(e);
                }
                else {
                  wfCB(null);
                }
              }
            );
          }
        ],
        function(e,r) {
          if (e) {
            parallelCB(e);
          }
          else {
            parallelCB(null);
          }
        });
      }
      else {
        parallelCB(null);
      }
    },
  ],function(e,r) {
      cb(null,self.liveData);
  });
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
