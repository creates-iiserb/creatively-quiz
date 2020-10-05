const path = require("path");

const express = require("express");
const bodyParser = require('body-parser');
const socketIO = require("socket.io");

let app = express();
app.use('/',  express.static(__dirname+'/public'));

const { Quiz } = require("./utils/liveQuiz");
const { out } = require("./utils/helper");
const utils = require("./services/utilities");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const handler = require("./liveQuiz/handler");

const port = process.env.PORT || 3090;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const liveQuizRts = require('./routes/liveQuiz');
app.get('/', liveQuizRts.liveHome);
app.get('/lqWhitBoardSender/:quizId/:token',liveQuizRts.lqWhitBoardSender);
app.get('/lqWhitBoardReciever/:quizId',liveQuizRts.lqWhitBoardReciever);


let server = app.listen(port,() => {
  console.log(`Live Quiz Server is running on port ${port}`);
});


let io = socketIO.listen(server,{
  pingTimeout: 60000,
  pingInterval:25000
});

let lqQuiz = new Quiz();
let infiniteTime = 900000;



io.on("connection", socket => {

  socket.on("std_lqSubmitAns", async data => {
    let student = lqQuiz.getStudent(data.quizId,data.studentId);
    if(student){
      let checkAuth = await handler.checkAuth(data.quizId,data.studentId,data.token);
      if(!checkAuth.status){
        io.to(`${student.id}`).emit("std_lqSessionExp", {});
        return;
      }
    }else{
      io.to(`${socket.id}`).emit("std_lqSessionExp", {});
      return;
    }
    
    lqQuiz.setAnswer(data);
    let answers = lqQuiz.getQuizAns(data.quizId);
    let stdList = lqQuiz.getStudentList(data.quizId);

    if (stdList.quizSockId !== null) {
      io.to(`${stdList.quizSockId}`).emit("ath_lqStudentList", {
        students: stdList.students,
        answers: answers
      });
    }

    out(lqQuiz.liveQuiz, true, "Quiz");
  });

 
  socket.on("ath_lqStartQuiz", async (data, cb) => {
   
    let result = await handler.startLiveQuiz(data);
    
    if (result.status) {
      socket.join(data.quizId);
      let preSockId = lqQuiz.startLQuiz(data.socketTokenId, data.quizId,socket.id);
      if (preSockId) {
        io.to(`${preSockId}`).emit("ath_lqNewLogin", {});
      }

    
      cb({ status: result.status, id: socket.id,wbToken:result.data.wbToken });
    } else {
      
      cb(result);
    }
  });


  socket.on("ath_lqShowDataStds", async (data,cb) => {
    if(data.ans || data.score){

      let quiz = lqQuiz.getQuiz(data.quizId);
      if (quiz) {
        let { secId, quesId } = quiz.playData;
        let qdResult = await handler.getQuizData(data.quizId, secId, quesId);
        if (qdResult.status) {
          quiz.students.forEach(std => {
            
            let qdIndex = qdResult.data.findIndex(
              qd => qd.userid == std.studentId
            );
            if (qdIndex > -1) {
              let stdData = {};
              stdData.quizData = qdResult.data[qdIndex];
              if (quiz.response.hasOwnProperty(std.studentId)) {
                stdData.response = quiz.response[std.studentId];
              }
              io.to(`${std.id}`).emit("std_lqRecieveDataAfterPlayed", {
                stdAns: stdData,
                meta: quiz.playData
              });
            }
          });

          let type = null;
          if(!data.stat && data.ans && !data.score){
           
            type = "ansOnly"
          }else 
          if(!data.stat && data.ans && data.score){
           
            type =  "ciAns"
          }else 
          if(data.stat && data.ans && !data.score){
          
            type =  "statAns"
          }else 
          if(data.stat && data.ans && data.score){
         
            type =  "all"
          }else 
          if(!data.stat && !data.ans && data.score){
           
            type =  "ciOnly"
          }else 
          if(data.stat && !data.ans && data.score){
          
            type =  "statCI"
          }

          lqQuiz.changeTypeofQuiz(data.quizId, type);
          io.in(data.quizId).emit("lq_stdShowData", { type: type });
          out(lqQuiz.liveQuiz, true, "Quiz");
          return cb(true);
        }
      }
    }else{
      
      if(data.stat && !data.ans && !data.score){
        let statData = lqQuiz.setTypeStats_GetStats(data.quizId,'statOnly');
        socket.to(data.quizId).emit("std_lqDisplayStatsOnly", statData);
        cb(true);
      }
      
    }
  });

  
  socket.on("ath_lqShowStatOnly", async (data,cb) => {
     let statData = lqQuiz.setTypeStats_GetStats(data.quizId,'statOnly');
      socket.to(data.quizId).emit("std_lqDisplayStatsOnly", statData);
      out(lqQuiz.liveQuiz, true, "Quiz");
      cb(true);
  });

  
  socket.on("ath_lqGrade", async (data, cb) => {
    
    let quiz = lqQuiz.getQuiz(data.quizid);
    if(quiz){
   
      let copyQuizRes = {...quiz.response};
      let previousRes = await handler.getPreviousRes(data,copyQuizRes);
    
      lqQuiz.updateQuizResponse(data.quizId,previousRes);
      data["response"] = previousRes;
      try {
        let serRes = await utils.requestToQuizServer(
          "grade_live_quiz_question",
          data
        );
        if (Array.isArray(serRes.response)) {
          serRes.response = {};
        }

       

        
        let gradeStats = await handler.getGradeMatrix(data, serRes);
        
       
        lqQuiz.setStudentAnsStats(
          data.quizid,
          serRes.response,
          gradeStats.data
        );

      
        cb({ ...gradeStats,playData:quiz.playData,ansData:serRes.response});
      } catch (error) {
        console.log(error);
      
        cb({status:false,error:error});
      }
    } else {
     
      cb({status:false,error:'Something went wrong.Please refresh your page'});
    }
  });

  //save timeken of info type
  socket.on("ath_lqSaveInfoTimeTaken", async (data,cb) => {
  
    try {
      let quiz = lqQuiz.getQuiz(data.quizid);
      if(quiz){
        
        let copyQuizRes = {...quiz.response};
        await handler.saveTimeTakenInfo(data,copyQuizRes);
        cb({status:true})
       
      }
       
    } catch (error) {
       console.log(error)
       cb({status:false,error:error})
    }
    

  });

  
  socket.on("ath_lqSaveSubResponse", async (data,cb) => {
  
    try {
      let quiz = lqQuiz.getQuiz(data.quizid);
      if(quiz){
       
        let copyQuizRes = {...quiz.response};
        let subjectRes = await handler.saveSubjective(data,copyQuizRes);
        lqQuiz.setStudentAnsStats(data.quizid,subjectRes.data.response,subjectRes.data.gradeStats);
        cb({
          status:subjectRes.status,
          gradeStats:subjectRes.data.gradeStats,
          playData:quiz.playData,
          ansData:subjectRes.data.response});

          out(lqQuiz.liveQuiz, true, "Quiz");
      }
       
    } catch (error) {
       console.log(error)
       cb({status:false,error:error})
    }
    

  });

 
  socket.on("std_lqJoinQuiz", async (data, cb) => {
    console.log("Socket-std_lqJoinQuiz");
    console.log(data);
   
    let quizSt = lqQuiz.joinLQuiz({ id: socket.id, ...data });
    let stdList = lqQuiz.getStudentList(data.quizId);
    let answers = lqQuiz.getQuizAns(data.quizId);
   
    if (stdList.quizSockId !== null) {
      io.to(`${stdList.quizSockId}`).emit("ath_lqStudentList", {
        students: stdList.students,
        answers: answers
      });
    }


    try {

      if (quizSt.status == "notLive") {
        cb({ status: "notLive" });
      } else if (quizSt.status == "live") {
  
      
          let checkAuth = await handler.checkAuth(data.quizId,data.studentId,data.token);
          if(!checkAuth.status){
         
            cb({status:checkAuth.error.code, type:checkAuth.error.type});
            return;
          }
      
  
       
        socket.join(data.quizId);
     
        if (quizSt.hasOwnProperty("preStdSocId")) {
        
          let preStdSocId = quizSt.preStdSocId;
        
          io.to(`${preStdSocId}`).emit("std_lqSessionExp", {});
        }
  
        
        const playData = {...quizSt.liveQuiz.playData,whiteboard:quizSt.liveQuiz.playData.whiteboard.isShow };
        
  
        let playStatus = playData.playStatus;
        if (playStatus == "play") {
          let type = playData.type;
  
      
           let pauseMeta = {
            playStatus: "pause",
            youtube:playData.youtube,
            whiteboard:playData.whiteboard
          };
          
          if (type == "question") {
            let qdResult = await handler.getQuizDataOfStd(
              data.quizId,
              playData.secId,
              playData.quesId,
              data.studentId
            );
  
            if (qdResult.status) {
              
              let currTime = utils.currTime();
             
              
  
              if (playData.time !== infiniteTime) {
                let endTime = playData.startAt + playData.time;
                let remainTime = endTime - currTime;
                if (remainTime > 0) {
                  var quizPlayData = Object.assign({}, playData);
                  quizPlayData.time = remainTime;
                  cb({
                    status: "live",
                    quizData: qdResult.data[0],
                    meta: quizPlayData,
                    ansGiven: quizSt.ansGiven 
                  });
                } else {
                  cb({ status: "live", meta: pauseMeta });
                }
              } else {
                cb({
                  status: "live",
                  quizData: qdResult.data[0],
                  meta: playData,
                  ansGiven: quizSt.ansGiven 
                });
              }
  
             
            } else {
              cb({
                status: "live",
                meta: pauseMeta,
                error: "questNotAvail"
              });
            }
          } else if (type == "quizInst" || type=="secInst") {
              let currTime = utils.currTime();
              if (playData.time !== infiniteTime) {
                let endTime = playData.startAt + playData.time;
                let remainTime = endTime - currTime;
                if (remainTime > 0) {
                  var quizPlayData = Object.assign({}, playData);
                  quizPlayData.time = remainTime;
                  cb({
                    status: "live",
                    meta: quizPlayData
                  });
  
                } else {
                  cb({ status: "live", meta: pauseMeta });
                }
              } else {
                cb({
                  status: "live",
                  meta: playData
                });
              }
          } else if (type == "statOnly") {
            cb({
              status: "live",
              meta: playData
            });
          } else if (type == "ansOnly" || type == "ciOnly" || type == "statAns" || type == "all" || type == "statCI" || type == "ciAns") {
            let qdResult = await handler.getQuizDataOfStd(
              data.quizId,
              playData.secId,
              playData.quesId,
              data.studentId
            );
  
            let stdData = {};
            if (qdResult.status) {
              stdData.quizData = qdResult.data[0];
        
              let quizStdResId = data.quizId+"-"+playData.secId+"-"+playData.quesId+"-"+data.studentId;
              let response = await handler.getQuizResStd(quizStdResId);
              if(response){
                stdData.response = response;
              }
            
             
              cb({ status: "live", stdAns: stdData, meta: playData });
            } else {
              cb({
                status: "live",
                meta: pauseMeta,
                error: "questNotAvail"
              });
            }
          } else if (type == "wait") {
            cb({ status: "live", meta: playData });
          }
        } else if (playStatus == "pause") {
          cb({ status: "live", meta: playData });
        }
      }
      
    } catch (error) {

      console.log(error);
      cb({ status: "notLive" ,error: error });
    }
    
  });

 
  socket.on("ath_lqStopQuiz", async (data, cb) => {
  
    let sockSt = lqQuiz.disconnectLQuiz(socket.id);
   

    if (sockSt.status == "quizId") {
      let room = sockSt.quizId;
      io.to(`${socket.id}`).emit("ath_lqStudentList", {
        students: [],
        answers: {}
      });

      socket.broadcast.to(room).emit("std_lqLeaveRoom", {});

      let roomObj = io.nsps["/"].adapter.rooms[room];
      if (roomObj) {
        Object.keys(roomObj.sockets).forEach(function (id) {
          io.sockets.connected[id].leave(room);
        });
        cb(true);
      }
    } else {
      cb(false);
    }
  });

  
  socket.on("ath_lqPlayQuiz", async data => {
  

    let stdData = lqQuiz.getStudentList(data.quizId);
    if (data.type == "question") {
     
      let playData = {
        type: data.type,
        playStatus: "pause",
        time: data.time,
        secId: data.secId,
        quesId: data.quesId,
        qtype: data.qtype,
        startAt: utils.currTime()
      };

      lqQuiz.setPlayData(data.quizId, playData);
      let qdResult = await handler.getQuizData(
        data.quizId,
        data.secId,
        data.quesId
      );
      if (qdResult.status) {
       
        for(let i=0; i<stdData.students.length;i++){
          let std = stdData.students[i];
          let qdIndex = qdResult.data.findIndex(
            qd => qd.userid == std.studentId
          );
          if (qdIndex > -1) {
            let checkAuth = await handler.checkAuth(data.quizId,std.studentId,std.token);
            if(!checkAuth.status){
              io.to(`${std.id}`).emit("std_lqSessionExp", {});
              continue;
            }

            let quizData = qdResult.data[qdIndex];
           
            io.to(`${std.id}`).emit("std_lqQuestion", {
              quizData: quizData,
              meta: playData
            });

          }
          
        }
      

        lqQuiz.changeStateOfQuiz(data.quizId, {
          state: "play",
          startAt: utils.currTime()
        });
        io.in(data.quizId).emit("lq_startTimer", { type: "question" });
      }
    } else if (data.type == "quizInst") {
      let playData = {
        type: data.type,
        playStatus: "pause",
        time: data.time,
        startAt: utils.currTime()
      };

      lqQuiz.setPlayData(data.quizId, playData);
      stdData.students.forEach(std => {
        io.to(`${std.id}`).emit("std_lqQuizInst", { meta: playData });
      });

      lqQuiz.changeStateOfQuiz(data.quizId, {
        state: "play",
        startAt: utils.currTime()
      });
      io.in(data.quizId).emit("lq_startTimer", { type: "quizInst" });
    } else if (data.type == "secInst") {
      let playData = {
        type: data.type,
        playStatus: "pause",
        time: data.time,
        secId: data.secId,
        startAt: utils.currTime()
      };

      lqQuiz.setPlayData(data.quizId, playData);
      stdData.students.forEach(std => {
        io.to(`${std.id}`).emit("std_lqSecInst", { meta: playData });
      });

      lqQuiz.changeStateOfQuiz(data.quizId, {
        state: "play",
        startAt: utils.currTime()
      });
      io.in(data.quizId).emit("lq_startTimer", { type: "secInst" });
    }

   
  });

 
  socket.on("ath_lqPauseQuiz", async data => {
   
    lqQuiz.changeStateOfQuiz(data.quizId, {
      state: "pause",
      startAt: utils.currTime()
    });
    socket.to(data.quizId).emit("std_lqPauseQuiz", {});
  
  });

  
  socket.on("ath_lqChangeTime", async data => {
   
    data.startAt = utils.currTime();
    lqQuiz.updateTime(data);
  
    io.in(data.quizId).emit("lq_updateTime", { newTime: data.newTime });
    
  });

  socket.on("ath_lqWait", async data => {
   
    lqQuiz.changeTypeofQuiz(data.quizId, "wait");
    socket.to(data.quizId).emit("std_lqWait", {});
 
  });


  socket.on("disconnect", () => {
 

    let sockSt = lqQuiz.disconnectLQuiz(socket.id);
    if (sockSt.status == "quizId") {
      let room = sockSt.quizId;
      socket.broadcast.to(room).emit("std_lqLeaveRoom", {});
    }
    if (sockSt.status == "studentId") {
      let stdList = lqQuiz.getStudentList(sockSt.quizId);
      let answers = lqQuiz.getQuizAns(sockSt.quizId);
      if (stdList.quizSockId !== null) {
        io.to(`${stdList.quizSockId}`).emit("ath_lqStudentList", {
          students: stdList.students,
          answers: answers
        });
      }
    }

   
  });


  socket.on("ath_lqStopPlay", async data=>{
  
    lqQuiz.stopPlayItem(data.quizId, {      
      startAt: utils.currTime()
    });
    socket.to(data.quizId).emit("std_lqPauseAndSubmit", {});
    
  })


  socket.on("ath_lqToggleVideoChat", async (data, cb) => {
   
    let quiz = lqQuiz.getQuiz(data.quizId);

    if(quiz){
      let vcData = {
        video : data.video,
        chat  : data.chat,
        youtubeId : data.youtubeId
      }
      lqQuiz.setVideoChatSetting(data.quizId,vcData);
  
      socket.broadcast.to(data.quizId).emit("std_toggleVideoChat", vcData);
      cb(true);
    }else{
      cb(false);
    }
    

  });

  
  socket.on("ath_lqToggleWhiteBoard", async (data,cb) => {
   
    let quiz = lqQuiz.getQuiz(data.quizId);
    if(quiz){
      lqQuiz.setWhiteBoardSetting(data);
      
      socket.broadcast.to(data.quizId).emit("std_toggleWhiteBoard", data.isShow);
      cb(true);
    }else{
      cb(false);
    }  
  });
  
  socket.on("ath_lqWhiteBoard", async (data,cb) => {
   
    let quiz = lqQuiz.getQuiz(data.quizId);
    if(quiz){
      if(quiz.playData.whiteboard.isShow){
        lqQuiz.setWhiteBoardSnapShot(data);
        socket.broadcast.to(data.quizId).emit("lqWhitboardOnChange", data.snapshot );
       
        cb("draw");
      }else{
        cb("notEnable")
      }
    }else{
       cb("notlive");
    }
    
  });

  socket.on('join_lqWhitBoard', async (data,cb) =>{
    let quiz = lqQuiz.getQuiz(data.quizId);
    if(quiz){
      if(quiz.playData.whiteboard.isShow){
        socket.join(data.quizId);
        let snapshot = quiz.playData.whiteboard.snapshot;
         cb({status:true,snapshot:snapshot});
      }else{
        cb({status:false})
      }
    }else{
       cb({status:false});
    }
  });


});

