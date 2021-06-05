var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');
// var config = require("../services/config")

var rp = require('request-promise');
var request = require('request')
// console.log(config)

/* GET home page. */
router.get('/', function (req, res, next) {
  res.json({ title: 'Examineer App API version 2' });
});

router.post('/verifyDevice', (req, res) => {
  // to verify device token , when the app is opened
  let searchConfig= (inputSecret)=>{
    let result = config.versions.find(o => o.secret === inputSecret);
    return result
  }
 // if (req.body.secret == config.secret) {
 if(searchConfig(req.body.secret))  {
    //Success
    var user = {
      user_id: req.body.deviceId,
    }
    //Create Token
    var token = jwt.sign(user, config.key, {
      //expiresIn: Math.floor(Math.random() * 120) + 60 //Generate random token validity between (1-2min)
      expiresIn: 900000
    });
    //Send Token
    //res.cookie('Token',new Buffer(Token), { maxAge: 900000});
    res.json({ success: true, token: token });
  } else {
    //Incorrect Password
    res.json({ success: false, error: "unauthorized" });
  }
})


router.use(function (req, res, next) { 
  //Token Verifying
  // var token = req.body.token || req.headers['token'];
  //console.log(req.headers['token'])

  var token = req.get('token') || req.headers['token'];
  if (token) {
    jwt.verify(token, config.key, function (err, decode) {
     // console.log(decode)
      if (err) {
        //Invalid Token
        res.status(401).json({
          success: false,
          error: "unauthorized",
          message: "Unauthorized Access. Device Token incoorect"
        });
      } else {

        // adding client ip address to the request 
        let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        req.clientIP = ip

        next();
      }
    });
  } else {
    //Token Required
    res.status(401).json({
      success: false,
      error: "unauthorized",
      message: "Unauthorized Access. Device Token required"
    });
  }
});


router.post('/login', (req, res) => {
 // console.log(1)
  let data = { quizId: req.body.quizId, uname: req.body.user }
  if(req.body.password){
    data["pwd"]= req.body.password
  }
  if(req.body.altPwd){
    data["altPwd"]= req.body.altPwd
  }
  //  console.log(data)
  request.post({
    url: config.quizServer + '/login', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']
    }
  }, function (err, httpResponse, body) {
    /* ... JSON.parse(body)*/
    res.json(body)
  })
})

router.get('/time', (req, res) => {
  //   res.json({
  //     "status": true,
  //     "data": {
  //         "time": 1544572800000  // 1546300800
  //     }
  // })
  // console.log(1)

  request.post({
    url: config.quizServer + '/time', json: true, headers: {
      'Content-Type': 'application/json',
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    /* ... JSON.parse(body)*/
    res.json(body)
  })
})


router.post('/quizTime', (req, res) => {
  let data = { quizId: req.body.quizId, uname: req.body.user }
  request.post({
    url: config.quizServer + '/quizTime', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})

router.post('/quizData', (req, res) => {
  let data = { examId: req.body.examId }
  request.post({
    url: config.quizServer + '/quizData', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})


router.post('/saveResp', (req, res) => {
  // let data = { examId: req.body.examId, response: req.body.response }   examId, response
  let data = { examId: req.body.examId, resData: req.body.resData ,exit: req.body.exit}
  if(req.body.saveType){
    data['saveType'] = req.body.saveType
  }
  request.post({
    url: config.quizServer + '/saveResp', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})


router.post('/verifyToken', (req, res) => {
  // let data = { examId: req.body.examId, response: req.body.response }   examId, response
  // console.log(req.get('authToken'))
  request.post({
    url: config.quizServer + '/verifyToken', body: { examId: req.body.examId }, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})


router.post('/submitQuiz', (req, res) => {
  let data = { quizId: req.body.quizId, uname: req.body.user, isSection: req.body.isSection }
  request.post({
    url: config.quizServer + '/submitQuiz', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})


router.post('/summary', (req, res) => {
  let data = { quizId: req.body.quizId, uname: req.body.user , isSection:req.body.isSection, submitReason:req.body.submitReason }
  // 'quizId', 'uname', 'isSection', 'reqByAuthor', 'submitReason'
  request.post({
    url: config.quizServer + '/summary', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})

router.post('/isReview', (req, res) => {
  let data = { quizId: req.body.quizId }
  request.post({
    url: config.quizServer + '/isReview', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})


router.post('/quizResponseData', (req, res) => {
  let data = { examId: req.body.examId }
  request.post({
    url: config.quizServer + '/quizResponseData', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})

router.post('/raiseTicket', (req, res) => {
  let data = {examId:req.body.examId, ref:req.body.ref,issue:req.body.issue}
  // 'examId', 'ref', 'issue', 'index'
  request.post({
    url: config.quizServer + '/raiseTicket', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']
    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})

router.post('/exitQuiz', (req, res) => {
  let data = { quizId: req.body.quizId, uname: req.body.user ,message:req.body.message}
  request.post({
    url: config.quizServer + '/exitQuiz', body: data, json: true, headers: {
      'Content-Type': 'application/json',
      'authToken': req.get('authToken'),
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']

    }
  }, function (err, httpResponse, body) {
    res.json(body)
  })
})

router.post('/user_login', (req, res) => { 
  request.post({
    url: config.quizServer + '/user/login', body: req.body, json: true, headers: {
      'Content-Type': 'application/json',
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP']
    }
  }, function (err, httpResponse, body) {res.json(body)})
})

router.get('/user_ping', (req, res) => { 
  request.get({
    url: config.quizServer + '/user/ping', body: req.body, json: true, headers: {
      'Content-Type': 'application/json',
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP'],
      'loginToken': req.get('loginToken'),
    }
  }, function (err, httpResponse, body) {res.json(body)})
})

router.post('/user_details', (req, res) => { 
  request.post({
    url: config.quizServer + '/user/details', 
    body: req.body, 
    json: true, 
    headers: {
      'Content-Type': 'application/json',
      'appAgent': req.get('appAgent'),
      'clientIP': req['clientIP'],
      'loginToken': req.get('loginToken')
    }
  }, function (err, httpResponse, body) {res.json(body)})
})



module.exports = router;
