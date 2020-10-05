const config = require('../services/config');
const nano = require('nano')(config.get('dbServer'));
const respdb = nano.db.use('examineer_response')

exports.liveHome = (req,res) => {
   res.render('default',{})
}

exports.lqWhitBoardSender = async (req,res) => {
    try {
        let lqUrl = config.get('liveQuizUrl');
        let keyData = req.params.quizId+"-"+req.params.token;
        let quizlqRes = await respdb.view('forLiveQuiz','quizIdwbTokenToId',{key:keyData}); 
        if(quizlqRes.rows.length>0){
            res.render('lqWhiteboardSender',{lqUrl:lqUrl,quizId:req.params.quizId,isServerError:false,invalidUrl:false})
        }else{
            res.render('lqWhiteboardSender',{lqUrl:lqUrl,quizId:req.params.quizId,isServerError:false,invalidUrl:true})
        }
        
    } catch (error) {
        console.log(error);
        res.render('lqWhiteboardSender',{lqUrl:lqUrl,quizId:req.params.quizId,isServerError:true})
    }
    
}

exports.lqWhitBoardReciever = (req,res) => {
    let lqUrl = config.get('liveQuizUrl');
    let quizId = req.params.quizId;
    console.log(req.params);
    res.render('lqWhiteboardReciever',{lqUrl:lqUrl,quizId:quizId})
}