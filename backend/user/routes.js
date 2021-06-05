var express = require('express');
var router = express.Router();
var handler = require('./handler.js');
var mw = require('./plugins')

router.get('/', handler.index );
router.post('/login',handler.login);

router.use(mw.loginRequired)
router.get('/ping',handler.ping);
router.post('/details',handler.fetchDetails);

module.exports = router;