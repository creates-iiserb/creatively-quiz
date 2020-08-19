var express = require('express');
var router = express.Router();


let emitEvent = (quizId, uname, logObj) => {
  //let cquiz = searchActiveQuiz(quizId);
  //if (cquiz.length > 0) {
    
  let emitObject ={res:  {
      quizId: quizId, userId: uname, log: logObj
  }}
  globalIO.sockets.in(quizId).emit(logObj.action,emitObject);
  //console.log("Emmited in room : " + quizId)
  //} else {
  //    console.log("Quiz not registered .. not emmiting ")
  //}
  // io.getIO().emit(logObj.action, {
  //     res: { quizId: quizId, userId: uname, log: logObj }
  // });
}

/* GET home page. */
router.post('/', function(req, res, next) {
  //console.log("---------------------")
  //console.log(req.body.quizId+"-"+req.body.uname+" : "+req.body.logObj.message);
  //let uag ;
  //if(req.body.logObj['useragent']['source']){
  //  uag = req.body.logObj['useragent']['source']
  //}else if(req.body.logObj['useragent']['examApp']){
  //  uag = JSON.stringify( req.body.logObj['useragent'])
  // }
  //console.log("Useragent: "+uag)
  //console.log("---------------------")
  emitEvent(req.body.quizId, req.body.uname, req.body.logObj)
  res.json({message:'Sent'});
});

module.exports = router;