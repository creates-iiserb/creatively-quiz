class Quiz {
  

  constructor() {
    this.liveQuiz = [];
    
  }

  startLQuiz(socketTokenId,quizId,id){
    
    let preSockId = null;
    let quizIndex = this.liveQuiz.findIndex(x=>x.quizId==quizId);
    if(quizIndex>-1){
      this.liveQuiz[quizIndex].response = {};
      if(this.liveQuiz[quizIndex].quiztoken !== socketTokenId){
        preSockId = this.liveQuiz[quizIndex].id;
        this.liveQuiz[quizIndex].quiztoken =  socketTokenId;
      }
      this.liveQuiz[quizIndex].id = id;
      
      this.liveQuiz[quizIndex].playData = {
        playStatus : "pause",  
        type: "",
        youtube:{},
        whiteboard:{
          isShow:false,
          snapshot:{}
        }
      };
      
    }else{
      let quiz = {
        id   : id,
        quizId : quizId,
        quiztoken: socketTokenId,
        students : [],
        playData : {
          playStatus:"pause",
          youtube:{},
          whiteboard:{
            isShow:false,
            snapshot:{}
          }
        },
        response:{}
       
       }

       this.liveQuiz.push(quiz);

    }
    return preSockId;
  }

  getStudentList(quizId){
  
    let data = {
      quizSockId : null,
      students : []
    }
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){
      data.quizSockId = this.liveQuiz[quizIndex].id;
      data.students = this.liveQuiz[quizIndex].students;
    }
    return data;
  }

  getStudent(quizId,studentId){
 
    let student = {};
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){      
      student = {...this.liveQuiz[quizIndex].students.find(std => std.studentId === studentId)};      
    }
    return student.hasOwnProperty('studentId')?student:null;
  }

  getQuiz(quizId){
  
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId  );
    if(quizIndex>-1){
    return this.liveQuiz[quizIndex];     
    }else{
      return false;
    }
  }

 
  changeStateOfQuiz(quizId,data){
    
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId  );
    if(quizIndex>-1){
       this.liveQuiz[quizIndex].playData.playStatus = data.state;
       this.liveQuiz[quizIndex].playData.startAt = data.startAt;
       this.liveQuiz[quizIndex].response = {};
       
    }
  }

  stopPlayItem(quizId,data){
  
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId  );
    if(quizIndex>-1){
    
       this.liveQuiz[quizIndex].playData.startAt = data.startAt;
       this.liveQuiz[quizIndex].playData.type = 'wait';
    }
  }

  changeTypeofQuiz(quizId,type){
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId  );
    if(quizIndex>-1){
       this.liveQuiz[quizIndex].playData.type = type;
    }
  }


  updateTime(data){

    let quizIndex = this.liveQuiz.findIndex(quiz => data.quizId=== quiz.quizId  );
    if(quizIndex>-1){
       this.liveQuiz[quizIndex].playData.time = data.newTime;
       this.liveQuiz[quizIndex].playData.startAt = data.startAt;
    }
  }

  
  setPlayData(quizId,playData){
    
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId  );
    if(quizIndex>-1){  
   
       let youtube = {};
       if(this.liveQuiz[quizIndex].playData.hasOwnProperty('youtube')){
        youtube = this.liveQuiz[quizIndex].playData['youtube'];
       }
 
      let whiteboard = this.liveQuiz[quizIndex].playData['whiteboard'];
      
       delete this.liveQuiz[quizIndex].playData;     
       this.liveQuiz[quizIndex].playData = playData;
       this.liveQuiz[quizIndex].playData['youtube'] = youtube;
       this.liveQuiz[quizIndex].playData['whiteboard'] = whiteboard;
       this.liveQuiz[quizIndex].response = {};
       
    }

  }


  joinLQuiz(quizData){
 
      let {id, quizId , studentId , token} = quizData;  
      let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId === quizId );
      let data = {}
      if(quizIndex>-1){

        let quiz = this.liveQuiz[quizIndex]
        
        let stdIndex = quiz.students.findIndex(std => std.studentId === studentId );
        data.status = "live";
        data.ansGiven = false;
        if(stdIndex>-1){
          let std = this.liveQuiz[quizIndex].students[stdIndex];
        
          if(std.token !== token){
            data.preStdSocId = std.id;
           
          }
          
          std.id =  id;
          std.token = token;
          this.liveQuiz[quizIndex].students[stdIndex] = std;
          
        }else{
          let std = {
              id : id,
              studentId : studentId,           
              token : token
            } 
            quiz.students.push(std);         
            this.liveQuiz[quizIndex] = quiz;    
        }
        
        if(this.liveQuiz[quizIndex].response.hasOwnProperty(studentId)){
          data.ansGiven = true;
        }

        data.liveQuiz = quiz;
      }else{
          data.status = "notLive";
      }
      return data;
  }

  disconnectLQuiz(id){
 
      let socketSt = {
        status : ''        
      }
      let index = this.liveQuiz.findIndex(quiz => quiz.id===id);
      if(index>-1){
          let quizId = this.liveQuiz[index].quizId; 
          this.liveQuiz =  this.liveQuiz.filter(quiz => quiz.quizId != quizId)
          socketSt.status = 'quizId';
          socketSt.quizId = quizId;
      }else{


        for(let i=0;i<this.liveQuiz.length;i++){
          let stdIndex = this.liveQuiz[i].students.findIndex(std=>std.id==id);
          if(stdIndex>-1){
            this.liveQuiz[i].students.splice(stdIndex,1);
            socketSt.status = 'studentId';
            socketSt.quizId = this.liveQuiz[i].quizId;            
            break;
          }
        }
 

      }

      return socketSt;
  }

  
  playDataInQuiz(quizId,data){
    
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId);
    if(quizIndex>-1){
      this.liveQuiz[quizIndex].playData = data; 
    
    }
  }

  
  pauseDataInQuiz(quizId,data){
  
  let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){
      this.liveQuiz[quizIndex].playData = false; 
    }
  }

  getQuizAns(quizId){
   
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){      
      let quiz = this.liveQuiz[quizIndex];      
        return quiz.response;          
    }
    return {};
  }

  setAnswer(data){
   
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===data.quizId );
    if(quizIndex>-1){      
      let quiz = this.liveQuiz[quizIndex];      
      if(quiz.playData.hasOwnProperty('quesId')){
        if(quiz.playData.quesId== data.stdAns.ref){
            if (!quiz["response"].hasOwnProperty(data.studentId)){
              quiz["response"][data.studentId] = {}
            }
           
            quiz["response"][data.studentId] = data.stdAns;                     
            this.liveQuiz[quizIndex] = quiz;
        }
      }
      
    }
  }


  setStudentAnsStats(quizId, answers,stats){
    
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){
      this.liveQuiz[quizIndex]['response'] = answers;
      this.liveQuiz[quizIndex]['playData']['stats'] = stats;
    }    
  }

  setTypeStats_GetStats(quizId,plyType){
   
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){      
     
      this.liveQuiz[quizIndex]['playData']['type'] = plyType;
      let data = {
        secId : this.liveQuiz[quizIndex]['playData']['secId'],
        stats :  this.liveQuiz[quizIndex]['playData']['stats'],
        type: this.liveQuiz[quizIndex]['playData']['type'],
        qtype: this.liveQuiz[quizIndex]['playData']['qtype'],
        quesId : this.liveQuiz[quizIndex]['playData']['quesId']
      }
      return data
    }
  }

  setVideoChatSetting(quizId,data){
   
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){  
      this.liveQuiz[quizIndex]['playData']['youtube'] = data;
    }
  }

  setWhiteBoardSetting(data){
   
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===data.quizId );
    if(quizIndex>-1){  
      this.liveQuiz[quizIndex]['playData']['whiteboard']['isShow'] = data.isShow;
     
    }
  }

  setWhiteBoardSnapShot(data){
   
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===data.quizId );
    if(quizIndex>-1){  
      this.liveQuiz[quizIndex]['playData']['whiteboard']['snapshot'] = data.snapshot;
    }
  }

  updateQuizResponse(quizId, response){
   
    let quizIndex = this.liveQuiz.findIndex(quiz => quiz.quizId===quizId );
    if(quizIndex>-1){
      this.liveQuiz[quizIndex]['response'] = response;
    }    
  }

}

module.exports = { Quiz }



