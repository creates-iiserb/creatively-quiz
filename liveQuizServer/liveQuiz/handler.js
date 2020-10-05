const config = require('../services/config')
const utils = require('../services/utilities')

const request = require('request');
const nano = require('nano')(config.get('dbServer'));
const globaldb = nano.db.use('global');
const metadb = nano.db.use('examineer_metadata')
const respdb = nano.db.use('examineer_response')
const examdb = nano.db.use('examineer_exam')

let index = () => {
    res.success({ message: "Quiz API. Version 2" })
}
module.exports.index = index;

let getTime = (req, res, next) => {
    var d = new Date();
    // console.log(d);
    res.success({ time: d.getTime() })
}
module.exports.getTime = getTime;




let startLiveQuiz = async (quizData) => {
    try {
        console.log("handler-startLiveQuiz");
        await utils.inspectJSON(quizData, { requiredFields: ['quizId','socketTokenId'] , validFields : ['quizId','socketTokenId'] })
        let quizMeta =  await checkIfQuizIsActive(quizData.quizId);
        let students = quizMeta.students.map(std=>{
            return quizData.quizId+'-'+std;
        })

        //create response object of live quiz
        let quizlqRes = await respdb.view('forLiveQuiz','quizIdToDoc',{key:quizData.quizId});   
        let wbToken = utils.generateToken(8);     
        if(quizlqRes.rows.length==0){
            let resnewId = await getNewRespDBid();
            let newqResDoc = {
                _id:resnewId._id,                
                liveQuiz:{
                    startedOn : utils.getCurrentDateInUTC(),
                    wbToken: wbToken
                },
                quizId:quizData.quizId,
                userId:"sample0"
            }

            if(resnewId._rev){
                newqResDoc._rev = resnewId._rev
            }

            await respdb.insert(newqResDoc);

        }else{
          
            //create whiteboard token
            let sample0ResDoc = quizlqRes.rows[0].value
            if( !('wbToken' in sample0ResDoc.liveQuiz)){
                sample0ResDoc.liveQuiz['wbToken'] = wbToken;
                await respdb.insert(sample0ResDoc);
            }else{
                wbToken = sample0ResDoc.liveQuiz['wbToken'];
            }
        }

        let qRes = await respdb.view('forResponseDoc', 'quizIdUserIdToResponse1', { keys: students })
        let blankRes = await generateBlankResp(quizData.quizId,'sample0',quizMeta.numSections)
        //let stdudentsResp = [];
        let insertDoc = false;
        for(let std=0;std<quizMeta.students.length;std++){
               //if in case exam was reset by author of particular students
               insertDoc = true;
               if(qRes.rows.length>0){
                  let stdIndex = qRes.rows.findIndex(x=>x.key == quizData.quizId+'-'+quizMeta.students[std])
                  if(stdIndex>-1){
                    insertDoc = false
                  }
               }
               //create response
               if(insertDoc){
                    //console.log("insert for "+quizMeta.students[std])
                    let resId = await getNewRespDBid();
                    let newDoc = {
                    quizId: quizData.quizId,
                    userId: quizMeta.students[std],
                    sections : blankRes,
                    _id : resId._id,
                    lastSaveAt : utils.getCurrentDateInUTC(),
                    quizType: 'live'
                    }
    
                    if(resId._rev){
                        newDoc._rev = resId._rev
                    }
    
                    await respdb.insert(newDoc);
                    //stdudentsResp.push(newDoc); #
               }          
        }


        return  utils.successRes({wbToken:wbToken});
    } catch (err) {        
        return utils.errorRes(err);
    }
}
module.exports.startLiveQuiz = startLiveQuiz;


let checkIfQuizIsActive = (quizId) => {
    
    return new Promise((resolve, reject) => {

        metadb.get(quizId)
            .then((quizData) => {
                
               
                let today = new Date();
                let beginTime = new Date(quizData.beginTime);
                let endTime = new Date(quizData.endTime);
                let validTime = new Date(quizData.validUpto);
                let isActive = true;

                if(!quizData.hasOwnProperty('quizType')){
                    reject(utils.generateError({ configCode: 'notLiveQuiz' }));
                }

                if(quizData.quizType!=="live"){
                    reject(utils.generateError({ configCode: 'notLiveQuiz' }));
                }

                if (quizData.status != "active") {
                    isActive = false;
                    reject(utils.generateError({ configCode: 'inact' }));
                }

                // if (today > validTime) {
                //   // quiz no longer valid
                //   isActive = false;
                //   reject(utils.generateError({ configCode: 'quizNotValid' }));
                // }

                if (beginTime > today) {
                    // quiz is not yet started
                    isActive = false;
                    reject(utils.generateError({ configCode: 'quizNotStarted' }));
                }

                if (today > endTime) {
                    // quiz over
                    isActive = false;
                    reject(utils.generateError({ configCode: 'quizEnded' }));
                }

                let students = Object.keys(quizData.credentials);
                let numSections = quizData.sections.length;
                
                let data = {
                    students,
                    numSections
                }

                

                if (isActive) {
                    resolve(data)
                }
            })
            .catch(err => {
               
                if (err.statusCode == 404) {
                    reject(utils.generateError({ configCode: 'exam404' }));
                } else {                   
                    reject(err)
                }
            })
    })
}


let getQuizData = async (quizid, section,quesRef) => {   
    let dbKey = quizid+"-"+section+"-"+quesRef;
    try {
        let quizDB = await examdb.view('liveQuiz', 'quizIdQueIndexToQueData', { key:dbKey });
        if(quizDB.rows.length>0){
           let quizData = quizDB.rows.map(x=> x.value);
           return utils.successRes(quizData);
        }else{
            return utils.errorRes({message:'Question is not available'});
        }
        
        
    } catch (err) {
        return utils.errorRes(err);
    }
    
}
module.exports.getQuizData = getQuizData;

let getQuizDataOfStd = async (quizid, section,quesRef,studentId) =>{
    //console.log("handler-getQuizDataOfStd");
    let dbKey = quizid+"-"+section+"-"+quesRef+"-"+studentId;
    
    try {
        let quizDB = await examdb.view('liveQuiz', 'quizIdQueIndexUserToQueData', { key:dbKey });
        if(quizDB.rows.length>0){
           let quizData = quizDB.rows.map(x=> x.value);
           return utils.successRes(quizData);
        }else{
            return utils.errorRes({message:'Question is not available'});
        }
        
    } catch (err) {
        return utils.errorRes(err);
    }

}
module.exports.getQuizDataOfStd = getQuizDataOfStd;

let getGradeMatrix = async (data,serRes) =>{
    //console.log("handler-getGradeMatrix");   
    //console.log(JSON.stringify(data,null,2));
    try {
      
        let gradeStats = [
            [0,0,0,0],
            [0,0,0,0],
            [0,0,0,0],
            [0,0,0,0]
        ];
                
        let students = Object.keys(serRes.response);
        let studentsIds = [];          
        for(let i = 0; i<students.length; i++ ){            
            let std = students[i];
            let gradIndex = serRes.response[std].gradingIndex;
            gradeStats[gradIndex[0]][gradIndex[1]]++;
            // console.log(gradeStats);
            //save in database;
            studentsIds.push(data.quizid+'-'+std);
        }

        gradeStats[0][3] = gradeStats[0][0] + gradeStats[0][1] + gradeStats[0][2];
        gradeStats[1][3] = gradeStats[1][0] + gradeStats[1][1] + gradeStats[1][2];
        gradeStats[2][3] = gradeStats[2][0] + gradeStats[2][1] + gradeStats[2][2];
        /////////////////////////////////////////////////////////////////////////
        gradeStats[3][0] =  gradeStats[0][0] + gradeStats[1][0] + gradeStats[2][0];
        gradeStats[3][1] =  gradeStats[0][1] + gradeStats[1][1] + gradeStats[2][1];
        gradeStats[3][2] =  gradeStats[0][2] + gradeStats[1][2] + gradeStats[2][2];
        //////////////////////////////////////////////////////////////////////
        gradeStats[3][3] =  gradeStats[3][0]+gradeStats[3][1]+gradeStats[3][2]

        
        //get all docs of students  
        let qRes = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { keys: studentsIds })
        //console.log("grad update=========")
        //console.log(JSON.stringify(qRes,null,2));
        if(qRes.rows.length>0){

            let updateRows = qRes.rows.map(res=>{
                return res.value;             
            });

            //console.log("Update Rows=========")
            //console.log(JSON.stringify(updateRows,null,2));
            
            for(let i = 0; i<students.length; i++ ){
                    let std = students[i];
                    let index = updateRows.findIndex(x=> x.userId==std && x.quizId == data.quizid);
                    if(index>-1){
                        let quesindex = updateRows[index].sections[data.section].findIndex(x=>x.ref==data.quesid);    
                        if(quesindex>-1){
                            updateRows[index].sections[data.section][quesindex] = serRes.response[std];
                            updateRows[index].lastSaveAt = utils.getCurrentDateInUTC()
                        }            
                        
                    }
                    
            }

            //save response
            await respdb.bulk({docs:updateRows});
        }

        //all response 
        let quizlqRes = await respdb.view('forLiveQuiz','quizIdToDoc',{key:data.quizid}); 
        if (quizlqRes.rows.length > 0) {
            let resData = quizlqRes.rows[0].value;          
            if(resData.liveQuiz.hasOwnProperty('playedQuest')){
                let forwardIndex = resData.liveQuiz['playedQuest'].slice().reverse().findIndex(x => x.section === data.section  && x.quesId ===data.quesid);
                let totalPlayed = resData.liveQuiz['playedQuest'].length - 1
                let index = forwardIndex >= 0 ? totalPlayed - forwardIndex : forwardIndex;
                if(index>-1){
                    resData.liveQuiz['playedQuest'][index]['grade'] = gradeStats;
                    await respdb.insert(resData);
                }
            }
        }

        return utils.successRes(gradeStats);        
    }catch (err) {
        return utils.errorRes(err);
    }

}
module.exports.getGradeMatrix = getGradeMatrix;



let saveTimeTakenInfo = async (data,response) =>{
    try {  
        let students = Object.keys(response);
        let studentsIds = [];          
        for(let i = 0; i<students.length; i++ ){            
            let std = students[i];
            studentsIds.push(data.quizid+'-'+std);
        }
        let qRes = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { keys: studentsIds });
        if(qRes.rows.length>0){
            let updateRows = qRes.rows.map(res=>{
                return res.value;             
            });
            for(let i = 0; i<students.length; i++ ){
                    let std = students[i];
                    let index = updateRows.findIndex(x=> x.userId==std && x.quizId == data.quizid);
                    if(index>-1){
                        let quesindex = updateRows[index].sections[data.section].findIndex(x=>x.ref==data.quesid);    
                        if(quesindex>-1){
                            let responseTimeTaken = response[std].timeTaken;
                            updateRows[index].sections[data.section][quesindex].timeTaken += responseTimeTaken;
                            updateRows[index].lastSaveAt = utils.getCurrentDateInUTC();
                        }            
                        
                    }
            }
            await respdb.bulk({docs:updateRows});
        }

        return utils.successRes(true);        
    }catch (err) {
        return utils.errorRes(err);
    }

}
module.exports.saveTimeTakenInfo = saveTimeTakenInfo;


let saveSubjective = async (data,response) =>{
    try {  

        let gradeStats = [
            [0,0,0,0],
            [0,0,0,0],
            [0,0,0,0]
        ];

        let students = Object.keys(response);
        let studentsIds = [];          
        for(let i = 0; i<students.length; i++ ){            
            let std = students[i];
            studentsIds.push(data.quizid+'-'+std);
        }
        let qRes = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { keys: studentsIds });
        if(qRes.rows.length>0){
            let updateRows = qRes.rows.map(res=>{
                return res.value;             
            });
            for(let i = 0; i<students.length; i++ ){
                    let std = students[i];
                    let index = updateRows.findIndex(x=> x.userId==std && x.quizId == data.quizid);
                    if(index>-1){
                        let quesindex = updateRows[index].sections[data.section].findIndex(x=>x.ref==data.quesid);    
                        if(quesindex>-1){
                            let attSkip = 0;
                            let responseTimeTaken = response[std].timeTaken;
                            let dbTimeTaken = updateRows[index].sections[data.section][quesindex].timeTaken;
                            if(response[std]['answerId'] == -1){
                                //don't overwrite the previous answer, if I skipped the question 
                                if(updateRows[index].sections[data.section][quesindex]['answerId'] == -1){
                                    updateRows[index].sections[data.section][quesindex] = response[std];
                                    attSkip = 1;
                                }else{
                                    attSkip = 0;
                                    response[std] = updateRows[index].sections[data.section][quesindex]; 
                                    response[std].timeTaken = responseTimeTaken;
                                }
                            }else{
                                updateRows[index].sections[data.section][quesindex] = response[std];
                                attSkip = 0;
                            }

                            gradeStats[attSkip][response[std].helpUsed]++;
                            updateRows[index].sections[data.section][quesindex].timeTaken = dbTimeTaken + responseTimeTaken;
                            updateRows[index].lastSaveAt = utils.getCurrentDateInUTC();
                        }            
                        
                    }
            }

            //sum of rows
            gradeStats[0][3] = gradeStats[0][0] + gradeStats[0][1] + gradeStats[0][2];
            gradeStats[1][3] = gradeStats[1][0] + gradeStats[1][1] + gradeStats[1][2];

            //sum of columns
            gradeStats[2][0] = gradeStats[0][0] + gradeStats[1][0];
            gradeStats[2][1] = gradeStats[0][1] + gradeStats[1][1];
            gradeStats[2][2] = gradeStats[0][2] + gradeStats[1][2];
            gradeStats[2][3] = gradeStats[0][3] + gradeStats[1][3];
           
            await respdb.bulk({docs:updateRows});
        }

        //all response 
        let quizlqRes = await respdb.view('forLiveQuiz','quizIdToDoc',{key:data.quizid}); 
        if (quizlqRes.rows.length > 0) {
            let resData = quizlqRes.rows[0].value;          
            if(resData.liveQuiz.hasOwnProperty('playedQuest')){
                let forwardIndex = resData.liveQuiz['playedQuest'].slice().reverse().findIndex(x => x.section === data.section  && x.quesId ===data.quesid);
                let totalPlayed = resData.liveQuiz['playedQuest'].length - 1
                let index = forwardIndex >= 0 ? totalPlayed - forwardIndex : forwardIndex;
                if(index>-1){
                    resData.liveQuiz['playedQuest'][index]['grade'] = gradeStats;
                    await respdb.insert(resData);
                }
            }
        }

        return utils.successRes({gradeStats,response});       
    }catch (err) {
        return utils.errorRes(err);
    }

}
module.exports.saveSubjective = saveSubjective;


let checkAuth = async (quizId,userId,token) => {
    let data = await respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: quizId + '-' + userId });
    if (data.rows.length > 0) {
        let resDoc = data.rows[0].value;
        //console.log(JSON.stringify(resDoc,null,2));

        if (resDoc.token == token) {

            let resData = {
                status: true                   
            };
            return resData;

            // let authorized = false;
            // // console.log(req.body)
            
            // if (quizId == resDoc.quizId) {
            //     authorized = true;
            // }
            // authorized = (quizId == resDoc.quizId && userId === resDoc.userId)?true:false;
            // if (!authorized) {              
            //     let resData = {
            //         status: false,
            //         error: {
            //             code: 'authFailed',
            //             type: 'danger',
            //             message: "Authorization failed. Access denied"
            //         }
            //     };
            //     return resData;
            // }else{
            //     let resData = {
            //         status: true                   
            //     };
            //     return resData;
            // }

        } else {
            //console.log("no match")
            let resData = {
                status: false,
                error: {
                    code: 'authFailed',
                    type: 'danger',
                    message: "Authentication failed. Invalid token"
                }
            };
            return resData;
        }
    } else {
        let resData = {
            status: false,
            error: {
                code: 'authFailed',
                type: 'danger',
                message: "Authentication failed. Invalid user"
            }
        };

        return resData;
    }          

}
module.exports.checkAuth = checkAuth;



let getPreviousRes = async (data,response) =>{
    console.log("handler-getPreviousRes");
    try {

        let students = Object.keys(response);
        let studentsIds = [];          
        for(let i = 0; i<students.length; i++ ){
            studentsIds.push(data.quizid+'-'+students[i]);
        }

        //get all docs of students  
        let qRes = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { keys: studentsIds })
        //console.log("grad update=========")
        //console.log(JSON.stringify(qRes,null,2));
        if(qRes.rows.length>0){
            let updateRows = qRes.rows.map(res=>{
                return res.value;             
            });

            // console.log("Update Rows=========")
            // console.log(JSON.stringify(updateRows,null,2));
            
            for(let i = 0; i<students.length; i++ ){
                let std = students[i];
                let index = updateRows.findIndex(x=> x.userId==std && x.quizId == data.quizid);
                if(index>-1){
                    let quesindex = updateRows[index].sections[data.section].findIndex(x=>x.ref==data.quesid);    
                    if(quesindex>-1){
                       
                       
                        //if student attempt question previously, but he do not attempt question in the current session
                        // then we overwritten current skipped answer with preivous answser response.
                        
                        let reponseTimeTaken = response[std].timeTaken;
                        if(response[std]['answerId'] == -1){

                            if(updateRows[index].sections[data.section][quesindex]['answerId'] != -1){
                                console.log("Get Previous Anwer");
                                response[std] = updateRows[index].sections[data.section][quesindex];
                            }
                        }
                       
                        response[std].timeTaken = reponseTimeTaken + updateRows[index].sections[data.section][quesindex].timeTaken;

                       
                    }            
                    
                }   
                    
            }
            
        }

        return response;

               
    }catch (err) {
        return utils.errorRes(err);
    }

}
module.exports.getPreviousRes = getPreviousRes;


let getQuizResStd = async (stdResId) =>{
    //console.log("handler-getQuizResStd");
    try {
        //get all docs of students  
        let qRes = await respdb.view('forLiveQuiz', 'quizSecQueUserToQueRes', { key: stdResId })
        if(qRes.rows.length>0){
            let resDoc = qRes.rows[0].value;
            if(resDoc.hasOwnProperty('gradingIndex')){
                return resDoc;
            }else
            if(resDoc.answerId == -1 && !resDoc.hasOwnProperty('gradingIndex')){
                return false;
            }
            
        }else{
            return false;
        }
               
    }catch (err) {
        return utils.errorRes(err);
    }

}
module.exports.getQuizResStd = getQuizResStd;

let getNewRespDBid = async () => {
       try {
        let data = await respdb.view('byAdmin', 'getAvailableId');
        let id = data.rows[0].value;
        let num = (id < 0) ? -id : id + 1;
        let availableId = "0000".concat(num.toString(36)).slice(-5);
       // out("available id =" + availableId)
        if (id < 0) {
            // resusing old doucment , rev id required
            let data1 = await respdb.get(availableId);
            return {
                _id: data1._id,
                _rev: data1._rev
            };
            
        } else {
            // fresh id
            return { _id: availableId };
        }

       } catch (error) {
           throw error
       }

}


let generateBlankResp = async (quizId, uname,numOfSec) => {
    //out(quizId)

    let sectionData = {}
    for(let sec=1;sec<=numOfSec;sec++){

        let data1 = await examdb.view('byQuizUser', 'quizIdToData', { key: quizId + "-" + uname + "-"+sec })
        //out(data1)
        if (data1.rows.length > 0) {
        let ques = data1.rows[0].value.quizdata.elements;
        let resp = [];

        ques.forEach(itm => {
            let res = {};
            res['ref'] = itm['ref']
            res['type'] = itm['type']
            res['timeTaken'] = 0
            res['helpUsed'] = 0
            res['lock'] = false
            res['review'] = 0
            res['answerId'] = -1
            res['tempAns'] = -1
            resp.push(res)
        })

         sectionData[sec] = resp;

        } else {
            sectionData[sec] = [];
        }

    }

    return sectionData;
    

}
