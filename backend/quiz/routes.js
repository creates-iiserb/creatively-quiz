var express = require('express');
var router = express.Router();
var handler = require('./handler.js');
var mw = require('../services/middlewares')

// var cors = require('cors')
// var corsOptions = {
//   origin: function (origin, callback) {
//     console.log(origin)
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true)
//     } else {
//       callback(new Error('Not allowed by CORS'))
//     }
//   }
// }

/* GET home page. */
router.get('/', handler.index );

router.post('/time', handler.getTime)
router.post('/global',handler.languageAndCopyright)
router.post('/login',handler.login); //  todo check author token 
router.post('/unlockAccount',handler.studentResetLoginCounter);
router.post('/sendCredentials',handler.sendLoginCredentials)


router.use(mw.needAuthentication)
router.post('/exitQuiz',handler.logonreload)
router.post('/quizTime',handler.getQuizTimings)
router.post('/quizData',handler.quizData)
router.post('/saveResp',handler.saveQuizResponse)
router.post('/verifyToken',handler.ping)

router.post('/submitQuiz',handler.submitQuiz)
router.post('/summary',handler.getQuizSummary)
router.post('/summary/:type',handler.exportSummary)

router.post('/isReview',handler.quizReview)
router.post('/quizResponseData',handler.quizResponse)

// router.post('/quizLog',handler.quizLog)
module.exports = router;