// app.js

var bodyParser = require( 'body-parser' );
var cfenv = require( 'cfenv' );
var crypto = require( 'crypto' );
var express = require( 'express' );
var jwt = require( 'jsonwebtoken' );
var request = require( 'request' );
var session = require( 'express-session' );
var app = express();

var settings = require( './settings' );
var appEnv = cfenv.getAppEnv();

app.set( 'superSecret', settings.superSecret );
app.use( express.static( __dirname + '/public' ) );
//app.use( bodyParser.urlencoded( { extended: true, limit: '10mb' } ) );
app.use( bodyParser.urlencoded() );
app.use( bodyParser.json() );

app.use( session({
  secret: settings.superSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,           //. https で使う場合は true
    maxage: 1000 * 60 * 60   //. 60min
  }
}) );


//. https://www.npmjs.com/package/@cloudant/cloudant
var Cloudantlib = require( '@cloudant/cloudant' );
var cloudant = null;
var db = null;

if( !settings.db_host ){
  cloudant = Cloudantlib( { account: settings.db_username, password: db_password } );
}else{
  var url = settings.db_protocol + '://';
  if( settings.db_username && settings.db_password ){
    url += ( settings.db_username + ':' + settings.db_password + '@' );
  }
  url += ( settings.db_host + ':' + settings.db_port );
  cloudant = Cloudantlib( url );
}

if( cloudant ){
  cloudant.db.get( settings.db_name, function( err, body ){
    if( err ){
      if( err.statusCode == 404 ){
        cloudant.db.create( settings.db_name, function( err, body ){
          if( err ){
            db = null;
          }else{
            db = cloudant.db.use( settings.db_name );
          }
        });
      }else{
        db = cloudant.db.use( settings.db_name );
      }
    }else{
      db = cloudant.db.use( settings.db_name );
    }
  });
}




app.post( '/login', function( req, res ){
  res.contentType( 'application/json' );
  console.log( req.body );
  var username = req.body.username;
  var password = req.body.password;

  if( username && password && settings.sample_username == username && settings.sample_password == password ){
    var user = { username: username, password: password };
    var token = jwt.sign( user, app.get( 'superSecret' ), { expiresIn: '25h' } );
    res.write( JSON.stringify( { status: true, token: token }, 2, null ) );
    res.end();
  }else{
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'Not valid user_id/password.' }, 2, null ) );
    res.end();
  }
});

app.post( '/logout', function( req, res ){
  req.session.token = null;
  //res.redirect( '/' );
  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});


//. ここより上で定義する API には認証フィルタをかけない
//. ここより下で定義する API には認証フィルタをかける
app.use( function( req, res, next ){
  if( req.session && req.session.token ){
    //. トークンをデコード
    var token = req.session.token;
    if( !token ){
      return res.status( 403 ).send( { status: false, result: 'No token provided.' } );
    }

    jwt.verify( token, app.get( 'superSecret' ), function( err, decoded ){
      if( err ){
        return res.json( { status: false, result: 'Invalid token.' } );
      }

      req.decoded = decoded;
      next();
    });
  }else{
    return res.status( 403 ).send( { status: false, result: 'No token provided.' } );
  }
});


app.post( '/doc', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'POST /doc' );

  var token = ( req.session && req.session.token ) ? req.session.token : null;
  if( !token ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else{
        var doc = req.body;
        doc.timestamp = ( new Date() ).getTime();
        //console.log( doc );

        if( db ){
          db.insert( doc, function( err, body ){
            if( err ){
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              console.log( body );
              res.write( JSON.stringify( { status: true, body: body }, 2, null ) );
              res.end();
            }
          });
        }else{
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: 'db is not initialized.' }, 2, null ) );
          res.end();
        }
      }
    });
  }
});

app.get( '/doc/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  console.log( 'GET /doc/' + id );

  var token = ( req.session && req.session.token ) ? req.session.token : null;
  if( !token ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else{
        if( db ){
          db.get( id,  function( err, body ){
            if( err ){
              console.log( err );
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              console.log( body );
              res.write( JSON.stringify( { status: true, doc: body }, 2, null ) );
              res.end();
            }
          });
        }else{
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: 'db is not initialized.' }, 2, null ) );
          res.end();
        }
      }
    });
  }
});

app.get( '/docs', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'GET /docs' );

  var token = ( req.session && req.session.token ) ? req.session.token : null;
  if( !token ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else{
        if( db ){
          db.list( { include_docs: true }, function( err, body ){
            if( err ){
              console.log( err );
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              var docs = [];
              body.rows.forEach( function( doc ){
                var _doc = JSON.parse( JSON.stringify( doc.doc ) );
                if( _doc._id.indexOf( '_' ) !== 0 ){
                  docs.push( _doc );
                }
              });

              res.write( JSON.stringify( { status: true, docs: docs }, 2, null ) );
              res.end();
            }
          });
        }else{
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: 'db is not initialized.' }, 2, null ) );
          res.end();
        }
      }
    });
  }
});

app.delete( '/doc/:id', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  var id = req.params.id;
  console.log( 'DELETE /doc/' + id );

  var token = ( req.session && req.session.token ) ? req.session.token : null;
  if( !token ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else{
        if( db ){
          db.get( id,  function( err, doc ){
            if( err ){
              console.log( err );
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              db.destroy( id, doc._rev, function( err, body ){
                if( err ){
                  console.log( err );
                  res.status( 400 );
                  res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
                  res.end();
                }else{
                  console.log( body );
                  res.write( JSON.stringify( { status: true, doc: body }, 2, null ) );
                  res.end();
                }
              });
            }
          });
        }else{
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: 'db is not initialized.' }, 2, null ) );
          res.end();
        }
      }
    });
  }
});


app.post( '/reset', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );
  console.log( 'POST /reset' );

  var token = ( req.session && req.session.token ) ? req.session.token : null;
  if( !token ){
    res.status( 401 );
    res.write( JSON.stringify( { status: false, result: 'No token provided.' }, 2, null ) );
    res.end();
  }else{
    //. トークンをデコード
    jwt.verify( token, app.get( 'superSecret' ), function( err, user ){
      if( err ){
        res.status( 401 );
        res.write( JSON.stringify( { status: false, result: 'Invalid token.' }, 2, null ) );
        res.end();
      }else{
        if( db ){
          db.list( {}, function( err, body ){
            if( err ){
              console.log( err );
              res.status( 400 );
              res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
              res.end();
            }else{
              var docs = [];
              body.rows.forEach( function( doc ){
                if( doc.id.indexOf( '_' ) !== 0 ){
                  docs.push( { _id: doc.id, _rev: doc.value.rev, _deleted: true } );
                }
              });
              if( docs.length ){
                db.bulk( { docs: docs }, function( err ){
                  res.write( JSON.stringify( { status: true, message: docs.length + ' documents are deleted.' }, 2, null ) );
                  res.end();
                });
              }else{
                res.write( JSON.stringify( { status: true, message: 'No documents need to be deleted.' }, 2, null ) );
                res.end();
              }
            }
          });
        }else{
          res.status( 400 );
          res.write( JSON.stringify( { status: false, message: 'db is not initialized.' }, 2, null ) );
          res.end();
        }
      }
    });
  }
});



var port = settings.app_port || appEnv.port || 3000;
app.listen( port );
console.log( 'server started on ' + port );
