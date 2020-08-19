var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
var routes = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

let cfg = require('./services/config');
// indiates wheter config file is loaded from db
let configLoaded = false;
app.use(async (req, res, next) => {
  if (!configLoaded) {
    // load config file i f not loaded  
    console.log("Loading configs...")
    await cfg.generateConfig()
    configLoaded = true;
  }
  // console.log(config)
  next();
})
app.use(logger('dev'));
app.use(bodyParser.json({strict:true,limit:'5mb'}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept,token,authToken,appagent");
  if (req.method === 'OPTIONS') {
    res.header("Access-Control-Allow-Methods", "PUT,POST,PATCH,DELETE,GET")
    return res.status(200).json({});
  }
  next();
});

app.use('/', routes);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
