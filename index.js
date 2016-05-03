var jf      = require('jsonfile'),
  util      = require('util'),
  request   = require('request'),
  _         = require('lodash'),
  S         = require('string'),
  log4js    = require('log4js'),
  path      = require('path'),
  async     = require('async');


//var ApigeeMGMT = {};
var logger;
var orgUrl;
var reqOpts;
var devHash = {};
var theRightOrder = [
  'environments','caches','keystores',
  'virtualhosts','keyvaluemaps','targetservers',
  'developers','companies','apiproducts','developerapps','companyapps'];

var ApigeeMGMT = function(opts) {
    reqOpts = opts.reqOpts;
    orgUrl  = opts.orgUrl;
    this.defaultList = ['environments','apiproducts','developers','companies'];

    this.foo = "I am foo";

    logger  = log4js.getLogger();
    logger.setLevel( opts.debugLevel );

    logger.trace( 'Here are the options we got: %s', util.inspect(opts) );

    // set a default and empty result set for our live data

    this.liveData = {
      environments: [],caches: [], keystores: [], virtualhosts: [],keyvaluemaps: [],
      targetservers: [], developers: [], companies: [], apiproducts: [],
      developerapps: [], companyapps: []
    };
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

ApigeeMGMT.prototype.updateResource = function( data,cb ) {
  var type = data.type.replace('.json','');
  var url = orgUrl + '/' + type;


  reqOpts = _.extend(reqOpts, {body: JSON.stringify(data.result)});
  reqOpts = _.extend(reqOpts, { headers: { "Content-Type" : "application/json"} });


  request.put(
    url,
    reqOpts,
    function(err, res, body) {
      if (err) {
        logger.error('updateResource received unexpected error while \"%s\":ing config for type: %s. Error: %s and Response: %s', 'PUT:ing',type, err, res );
      }
      else if ( (res.statusCode == 200) || (res.statusCode == 201) ) {
        logger.debug('Succeeded updating: %s with statusCode: %s', type, res.statusCode );
        cb(null, { 'type': type, result: JSON.parse(body) });
      }
      else {
        logger.error('updateConfig received unexpected status code while \"%s\":ing for type: %s and statusCode: %s and with body: %s', 'PUT:ing', type, res.statusCode, body );
      }
  });
};

ApigeeMGMT.prototype.createResource = function( data,cb ) {
  // for creations we also have to strip off the named resource from the end of
  // the url
  var type = path.dirname(data.type);
  var url = orgUrl + '/' + type;

  console.log("This is the ta-ta-type: %s", data.type);

  reqOpts = _.extend(reqOpts, {body: JSON.stringify(data.result)});
  reqOpts = _.extend(reqOpts, { headers: { "Content-Type" : "application/json"} });

  request.post(
    url,
    reqOpts,
    function(err, res, body) {
      if (err) {
        logger.error('Failed creating resource: %s with code: %s', data.type,res.statusCode);
      }
      else if ( (res.statusCode == 200) || (res.statusCode == 201) ) {
        logger.debug('Succeeded updating: %s with statusCode: %s', type, res.statusCode );
        cb(null, { 'type': type, result: JSON.parse(body) });
      }
      else {
        logger.error('Unexpected response while creating resource: %s with code: %s', data.type,res.statusCode);
      }
  });
};

ApigeeMGMT.prototype.writeAll = function( list,fileData,cb ) {
  var self=this;
  async.waterfall([
    function(wCB) {
      self.fetchAll(this.defaultList,wCB,true);
    },
    function(liveData,wCB) {
      // Now we take this liveData and make a types list array out of it
      var liveTypesList = [];

      console.log("This is the liveData: %s", util.inspect(liveData));
      _.each(liveData,function(i) {
        _.each(i,function(o) {
          liveTypesList.push(o.type);
        });
      });

      // now that we have our separated list we'll step through it in the right
      // order
      var listOrder =[];
      _.each(theRightOrder, function(t) {
        if ( _.includes(list,t) ) {
          listOrder.push(t);
        }
      });
      async.map(listOrder,
        function(t,mCB) {
          async.map(fileData[t], function(d,mmCB) {
            if ( _.includes(liveTypesList,d.type) ) {
              self.updateResource(d,mmCB);
            }
            else {
              self.createResource(d,mmCB);
            }
          },
          function(e,r){
            if (e) {
              logger.error("Failed update/creating resource: %s", util.inspect(e));
              mCB(e);
            }
            else {
              mCB(null);
            }
          });
        },
        function(e,r) {
          if (e) {
            logger.error("We failed handling the resource: %s", util.inspect(e));
            wCB(e);
          }
          else {
            wCB(null);
          }
        }
      );
    }
  ],
  function(e,r) {
    if (e) {
      cb(e);
    }
      cb(null);
  });
};

ApigeeMGMT.prototype.fetchAll = function( list,cb,returnSplit ) {
  var self=this;
  var todoList = list ? list : this.defaultList;

  logger.info("My list is: " + todoList);
  async.parallel([
    // apiproducts
    function(parallelCB) {
      if ( _.includes(todoList,'apiproducts') ) {
        self.fetchProducts(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              //self.liveData.apiproducts = _.concat(self.liveData.apiproducts, r);
              self.liveData.apiproducts = r;
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
      if ( _.includes(todoList,'developers' ) ) {
        self.fetchDevelopers(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              self.liveData.developers = _.concat(self.liveData.developers, r);
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
      if ( _.includes(todoList,'developers') ) {
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
                    self.liveData.developerapps = _.concat(self.liveData.developerapps,r);
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
      if ( _.includes(todoList,'companies') ) {
        self.fetchCompanies(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              self.liveData.companies = r;
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
      if ( _.includes(todoList,'companies') ) {
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
                    self.liveData.companyapps = _.concat(self.liveData.companyapps,r);
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
      if ( _.includes(todoList,'environments') ) {
        self.fetchEnvironments(
          function(e,r) {
            if (e) {
              logger.error('Failed fetching data: %s', util.inspect(e) );
              parallelCB(e);
            }
            else {
              self.liveData.environments = r;
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
      if ( _.includes(todoList,'environments') ) {
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
                        self.liveData.virtualhosts = _.concat(self.liveData.virtualhosts, r);
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
                        self.liveData.caches = _.concat(self.liveData.caches, r);
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
                        self.liveData.keyvaluemaps = _.concat(self.liveData.keyvaluemaps, r);
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
                        self.liveData.keystores = _.concat(self.liveData.keystores, r);
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
                        self.liveData.targetservers = _.concat(self.liveData.targetservers, r);
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
      if (returnSplit) {
        cb(null,self.liveData);
      }
      else {
        var theData = [];
        _.each(Object.keys(self.liveData), function(k) {
          theData = _.concat(theData,self.liveData[k]);
        });
        cb(null,theData);
      }
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
            logger.trace('Data fetched path ->  %s:  data -> %s', relPath,util.inspect(res,true) );
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
