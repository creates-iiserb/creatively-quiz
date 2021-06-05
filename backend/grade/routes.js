var express = require('express');
var router = express.Router();
var handler = require('./handler.js');
var mw = require('./plugins')

router.get('/', handler.index );
router.post('/login',handler.login);

router.use(mw.loginRequired)
// router.post('/ping',handler.ping);
router.post('/question',handler.fetchQuestion);
// router.post('/rubrics',handler.loadRubircs)
router.post('/grade',handler.gradeQuestion)
// router.post('/previous',handler.previousQuestion)
// router.post('/next',handler.nextQuestion)
// router.post('/history',handler.gradedHistory)

router.post('/rubrics',handler.editRubricsRule)
router.put('/rubrics',handler.newRubricsRule)
module.exports = router;