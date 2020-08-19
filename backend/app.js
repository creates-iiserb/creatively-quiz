var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
// config is a global variable which is directly used in other pages to get configs
config = require('./services/config') // always load configs first

var utilities = require('./services/utilities')
var appMw = require('./services/middlewares')

var routes = require('./quiz/routes');
var useragent = require('express-useragent');

var app = express();

// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');
// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
 
app.use(logger('dev'));
app.use(bodyParser.json({strict:true,limit:'5mb'}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(appMw.enableCORS)
app.use(useragent.express());

rootDirLoc = __dirname

app.use(function (req, res, next) {
  // middleware to adding userangent and ip address to incoming request 
  if (!req.useragent.source) {
    if (req.get('appagent')) {
      // creating a custom useragent header if the request is coming from mobile app
      // if the request is from mobile backend , then the ip address of the client device is in clientIP header
      let deviceInfo = JSON.parse(Buffer.from(req.get('appagent'), 'base64').toString('ascii'));
      req.useragent = deviceInfo;
      let ip = req.get('clientIP')
      req.useragent['ipAddress'] = ip;
    }
  }else{
    // if the request is from webapp , get ip address directly 
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    req.useragent['ipAddress'] = ip;
  }


  // console.log("ipppp = "+ip);
  next()
})

app.use(express.static(path.join(__dirname, 'public')));
app.use(appMw.responseHandler)
app.use('/', routes);
// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('{"code":"notFound","type":"danger"}');
  err.status = 404;
  next(err);
});

// error handlers
// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(async function  (err, req, res, next) {

    let errmsg;
    try {
      errmsg = JSON.parse(err.message);
    }
    catch (err) {
      errmsg = "Unexpected internal error. Try again later"
    }

    console.log('------------Dev error-----------')
    console.log(err)
    await utilities.logEvent("error",err)
    console.log('--------------------------------')
    res.status(err.status || 500);
    res.send({
      status: false,
      error: errmsg
    });
  });
}
 
// production error handler
// no stacktraces leaked to user
app.use(async function  (err, req, res, next) { 
  console.log(err)
  await utilities.logEvent("error",err)
  let errmsg;
  try {
    errmsg = JSON.parse(err.message);
  }
  catch (err) {
    errmsg = "Unexpected internal error. Try again later"
  }
  res.status(err.status || 500);
  res.send({
    status: false,
    error: errmsg,
  });
});

module.exports = app;