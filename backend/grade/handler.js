//const config = require('../services/config')
const utils = require('../services/utilities')
const pdfsumm = require('../services/pdfGenerator');
const plugins = require('./plugins')

const request = require('request');
const nano = require('nano')(config.getEnv('dbServer'));
const globaldb = nano.db.use('global');
const metadb = nano.db.use('examineer_metadata')
const respdb = nano.db.use('examineer_response')
const examdb = nano.db.use('examineer_exam')

let index = async (req, res, next) => { res.success({ message: "Grading API. Version 1" }) }
module.exports.index = index;

let out = (obj) => {
    let monitor = true;
    if (monitor) { console.log(obj) }
}

let login = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['token'],
            validFields: ['token','reqByAuthor']
        })

        // get sub grading doc from resp db
        // check if grader and token matches 
        // check if grading allowed,check if this user is allowed
        // create new grader token and send success, with quiz metadata

        let input = { token: req.body.token, }
        let tknSearch = await respdb.view('byGraderToken', 'sessionDetails', { key: input.token })
        utils.checkLength(tknSearch.rows, 'grade404')

        let dt = tknSearch.rows[0].value
        input.quizId = dt.quizId
        input.grader = dt.grader
        input.ref = dt.ref

        if (!dt.gradingEnabled) { throw utils.generateError({ configCode: 'gradeNotEnabled' }); }
        if (!dt.enabled) { throw utils.generateError({ configCode: 'gradeNotAllowed' }); }

        let resp = {finalized:dt.finalized}

        // quiz metadata 
        let meta = await metadb.view("byQuiz", "quizIdToMetaData", { key: input.quizId })
        let m = meta['rows'][0]['value'];
        delete m["credentials"];
        resp["meta"] = m

        // now record this sessions in the grading doc
        let gradeDoc = await respdb.get(dt.docId)
        let newSession = { token: utils.generateTokenN(25), startedOn: utils.getCurrentDateInUTC(), user: input.grader + "-" + input.ref }
        gradeDoc["sessions"][input.ref + "-" + input.grader] = newSession
        await respdb.insert(gradeDoc)

        // generate final grader token 
        resp["graderToken"] = input["token"] + "###" + newSession.token
        resp["grader"] = input.grader;

        // to log grader login 
        let uag;
        let ug = req.useragent
        if (ug) {
            if (ug['source']) { uag = ug['source'] }
            else if (ug['examApp']) { uag = JSON.stringify(ug['useragent']) }
        }
        utils.logEvent("info", `Grader Login: ${input.quizId}-${input.grader}-${input.ref} [User Agent : ${uag}] `)

        // get grader history
        let hist = await plugins.getGraderHistroy(input.quizId, input.ref, input.grader)
        resp["history"] = hist["graded"]
        resp["questionRef"]= input.ref

        res.success(resp)
    } catch (err) {
        console.log(err)
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'meta404' }));
        } else {
            let errMsg = JSON.parse(err.message);
            res.error200(errMsg)
        }

    }
}
module.exports.login = login

let fetchQuestion = async (req, res, next) => {
    try {
        utils.inspectJSON(req.body, { requiredFields: ["queId"], validFields: ["queId","reqByAuthor"], acceptBlank: false })
        let input = {
            grader: req["valildGrader"],
            quiz: req["valildGraderQuiz"],
            ref: req["valildGraderRef"],
            queId: req.body.queId,
            finalized : req["quizFinalized"]
        }

        let data = { sectionKey: 0, queId: "", graded: false, history: [], question: {}, answer: {}, response: {}, rubricSetting: {}, finalized: input.finalized  }
        let quizKey = "";

        let hist = await plugins.getGraderHistroy(input.quiz, input.ref, input.grader)
        data.history = hist["graded"]

        if (input.queId == "random") {
            // cannot get new question after finalization 
            if(input.finalized){throw utils.generateError({ configCode: 'quizFinalized' });}

            if (hist.ungraded.length > 0) {
                // there  are questions that were assigned to this grader but are not yet graded 
                // first show that question to the grader
                let oldQid = hist.ungraded[0]
                let d = oldQid.split("-") // always take the 1 st ungraded questions id
                let docId = d[0];
                let section = d[1];
                let respDoc = await respdb.get(docId);

                data["graded"] = false;
                quizKey = input.quiz + "-" + respDoc["userId"] + "-" + section
                let queResp
                if(respDoc.hasOwnProperty("quizType")&&respDoc["quizType"]=="live"){
                    queResp = respDoc["sections"][section].find(itm => { return itm["ref"] == input.ref })
                }else{
                    queResp = respDoc["sections"][section]["response"].find(itm => { return itm["ref"] == input.ref })
                }
                data.response = queResp;

                data.sectionKey = section
                data.queId = oldQid

            } else {
                // get a random question not yet graded
                let queDb = await respdb.view("byQuizIdQueId", "ungradedSubQue", { key: input.quiz + "-" + input.ref })
                if (queDb.rows.length > 0) {
                    let randId = Math.floor(Math.random() * (queDb.rows.length - 1)) + 1
                    let randQue = queDb.rows.length > 1 ? queDb.rows[randId] : queDb.rows[0]
                    data.response = randQue["value"]["que"];

                    // question id generation 
                    let queIdBase = randQue["id"] + "-" + randQue.value["sect"]+"-"+utils.generateTokenN(4)


                    data.queId = queIdBase
                    data.sectionKey = randQue.value["sect"]

                    let randomQueRespDoc = await respdb.get(randQue["id"])
                    let initialScoreObj = {
                        ref: input.ref,
                        section: randQue.value["sect"],
                        graded: false,
                        grader: input.grader,
                        gradeType: "grader",
                        assignedOn: utils.getCurrentDateInUTC(),
                        questionId: queIdBase,

                        rubrics: [],
                        adjustment: 0,
                        graderNote: " ",
                        gradingIndex: [],
                    }

                    // create a blank initial srore object  and push it 
                    if (!randomQueRespDoc['subScores']) { randomQueRespDoc['subScores'] = [] }
                    randomQueRespDoc['subScores'].push(initialScoreObj);
                    await respdb.insert(randomQueRespDoc)

                    // to log 
                    let uag = "";
                    let ug = req.useragent
                    if (ug) {
                        if (ug['source']) { uag = ug['source'] }
                        else if (ug['examApp']) { uag = JSON.stringify(ug['useragent']) }
                    }
                    utils.logEvent("info", `Grader : ${input.quiz}-${input.grader}-${input.ref} , Assigned :${data.queId}, Useragent : ${uag}`)

                    quizKey = randQue["value"]["exId"];
                } else {
                    throw utils.generateError({ configCode: 'graderDone' });
                }
            }
        } else {
            let d = input.queId.split("-")
            let docId = d[0];
            let section = d[1];
            let respDoc = await respdb.get(docId);
            data["graded"] = true;
            quizKey = input.quiz + "-" + respDoc["userId"] + "-" + section
            let queResp
            if(respDoc.hasOwnProperty("quizType")&&respDoc["quizType"]=="live"){
                queResp = respDoc["sections"][section].find(itm => { return itm["ref"] == input.ref })
            }else{
                queResp = respDoc["sections"][section]["response"].find(itm => { return itm["ref"] == input.ref })
            }
            // let queResp = respDoc["sections"][section]["response"].find(itm => { return itm["ref"] == input.ref })
            data.response = queResp;
            let respGrade = respDoc["subScores"].find(itm => { return itm["ref"] == input.ref && itm["section"] == section })
            data.grade = respGrade

            data.sectionKey = respGrade["section"]
            data.queId = input.queId

            let uag = "";
            let ug = req.useragent
            if (ug) {
                if (ug['source']) { uag = ug['source'] }
                else if (ug['examApp']) { uag = JSON.stringify(ug['useragent']) }
            }
            utils.logEvent("info", `Grader : ${input.quiz}-${input.grader}-${input.ref} , Viewed :${data.queId}, Useragent : ${uag}`)

        }

        // questions content from ex_exam
        let que = await examdb.get(quizKey)
        // console.log(quizKey)
        data.answer = que['answers'][input.ref]

        // correct ans from ex_exam
        let queCont = que["quizdata"]["elements"].find(itm => { return itm["ref"] == input.ref })
        data.question = queCont

        // get latest rubrics 
        data.rubricSetting = await  plugins.getRubrics(input.quiz,input.ref)
        res.success(data)

    } catch (error) { res.error200(error) }
}
module.exports.fetchQuestion = fetchQuestion

let gradeQuestion = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            validFields: ["queId", "index", "adjustment", "rubrics", "note", "reqByAuthor","revId"],
            requiredFields: ["queId", "index", "adjustment"],
            acceptBlank: false,
            acceptBlankArray: true
        })
        let input = {
            queId: req.body.queId,
            grade: req.body.grade,
            grader: req["valildGrader"],
            quiz: req["valildGraderQuiz"],
            ref: req["valildGraderRef"],

            index: req.body["index"],
            adjustment: req.body["adjustment"],
            rubrics: req.body["rubrics"],
            note: req.body["note"],
            update: req.body["update"],
            finalized: req["quizFinalized"],
            revId: req["revId"]
        }
        // if quiz is finalized updates rejected 
        if (input.finalized) { throw utils.generateError({ configCode: 'quizFinalized' }); }

        // check if the revId is latest if not 
        // let gradeMetaDB = await respdb.view("byQuizId", "subGradingMeta", { key: input.quiz })
        // let gradeMeta = gradeMetaDB.rows[0].value
        // if (input.revId != gradeMeta["_rev"]) {
        //     // let newRubrics = record["rubrics"][input.ref]
        //     res.success(
        //         {
        //             updated: false,
        //             reason: "revMismatch",
        //             updatedRubrics: gradeMeta["rubrics"][input.ref],
        //             updatedRevId: gradeMeta["_rev"]
        //         }
        //     )
        //} else {
            //let doc10 = parseInt(input.docId, 8).toString(32)
            //let docId = "0000".concat(doc10).slice(-5);
            let d = input.queId.split("-")
            let docId = d[0];
            let section = d[1];
            let doc = await respdb.get(docId)

            if (doc["quizId"] != input["quiz"]) { throw utils.generateError({ configCode: 'grade404' }) }

            let queExists
            if(doc.hasOwnProperty("quizType")){
                if(doc["quizType"]=="live"){
                    queExists = doc["sections"][section].find(itm => { return itm["ref"] == input.ref })
                }
            }else{
                queExists = doc["sections"][section]["response"].find(itm => { return itm["ref"] == input.ref })
            }
        
            if (queExists) {
                if (!doc["subScores"]) { doc["subScores"] = [] }
                let scoreExists = doc["subScores"].find(itm => { return itm["ref"] == input.ref && itm["section"] == section })
                if (scoreExists) {
                    if (input.grader == scoreExists["grader"]) {
                        if (input.index) { scoreExists["gradingIndex"] = input["index"] };
                        if (input.note) { scoreExists["graderNote"] = input["note"] } else { scoreExists["graderNote"] = "" }
                        if (input.adjustment) { scoreExists["adjustment"] = input["adjustment"] } else { scoreExists["adjustment"] = 0 }
                        if (input.rubrics) { scoreExists["rubrics"] = input["rubrics"] }
                        scoreExists["graded"] = true
                        scoreExists["updatedAt"] = utils.getCurrentDateInUTC()
                    } else { throw utils.generateError({ configCode: 'graderAlreadyGraded' }); }
                } else { throw utils.generateError({ configCode: 'grade404' }); }

                await respdb.insert(doc)

                // to log 
                let uag = "";
                let ug = req.useragent
                if (ug) {
                    if (ug['source']) { uag = ug['source'] }
                    else if (ug['examApp']) { uag = JSON.stringify(ug['useragent']) }
                }
                utils.logEvent("info", `Grader : ${input.quiz}-${input.grader}-${input.ref} , Graded :${input.queId}, Useragent : ${uag}`)

                let hist = await plugins.getGraderHistroy(input.quiz, input.ref, input.grader)
                res.success({ updated:true, "updatedAt": scoreExists["updatedAt"], "message": "Graded", history: hist["graded"] })
            } else { throw utils.generateError({ configCode: 'grade404' }); }
        // }
    } catch (error) { res.error200(error) }
}
module.exports.gradeQuestion = gradeQuestion

let newRubricsRule  = async  (req,res,next) =>{
    try {
        await utils.inspectJSON(req.body, {
            validFields: ["revId", "text", "value","reqByAuthor"],
            requiredFields: ["revId", "text", "value"],
            acceptBlank: false
        })
        let input = {
            grader: req["valildGrader"],
            quiz: req["valildGraderQuiz"],
            ref: req["valildGraderRef"],

            revId: req.body["revId"],
            text: req.body["text"],
            value: req.body["value"],
            finalized: req["quizFinalized"],
        }
        if (input.finalized) { throw utils.generateError({ configCode: 'quizFinalized' }); }
        // get document
        let data = await respdb.view("byQuizId", "subGradingMeta", { key: input.quiz })
        let record = data.rows[0].value
        
        // check if latest version 
        if(input.revId != record["_rev"]){
            // let newRubrics = record["rubrics"][input.ref]
            res.success(
                {
                    updated:false,
                    reason:"revMismatch",
                    updatedRubrics: record["rubrics"][input.ref],
                    updatedRevId : record["_rev"],
                    reqData:req.body
                }
            )
        }else{
            // check if add allwed
            if(!record["rubrics"][input.ref]["editable"]){throw utils.generateError({ configCode: 'addNotEnabled' })}
            let ifExists = record["rubrics"][input.ref]["rules"].find(itm=>{return itm["deleted"]==false && itm["text"]==input.text})
            if(ifExists){throw utils.generateError({ configCode: 'addRuleExists'})}
            let newRuleId =  record["rubrics"][input.ref]["rules"].length+1
            if(newRuleId <= 20){
                // push new rule
                let newDate = utils.getCurrentDateInUTC()
                let newRule = {
                    id: newRuleId,
                    deleted:false,
                    text: input.text,
                    value:input.value,
                    added:{
                        on : newDate  ,
                        by: input.grader
                    },
                    update:{
                        on :newDate ,
                        by:input.grader
                    }
                }
                // insert
                record["rubrics"][input.ref]["rules"].push(newRule)

                let updDoc = await  respdb.insert(record)
                // log 
                let uag = "";
                let ug = req.useragent
                if (ug) {
                    if (ug['source']) { uag = ug['source'] }
                    else if (ug['examApp']) { uag = JSON.stringify(ug['useragent']) }
                }
                utils.logEvent("info", `Grader : ${input.quiz}-${input.grader}-${input.ref} , Added new rule  :${newRule.id}-"${newRule.text}"-"${newRule.value}", Useragent : ${uag}`)

                // return new rule and revId
                res.success({
                    updated:true,
                    addedRubrics :newRule,
                    updatedRevId: updDoc["rev"]
                })
            }else{throw utils.generateError({ configCode: 'maxRubricsRule' })}
        }
    } catch (error) {res.error200(error)}
}
module.exports.newRubricsRule = newRubricsRule

let editRubricsRule = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            validFields: ["revId", "ruleId", "text", "value", "deleted", "reqByAuthor"],
            requiredFields: ["revId", "ruleId"],
            acceptBlank: false
        })
        let input = {
            grader: req["valildGrader"],
            quiz: req["valildGraderQuiz"],
            ref: req["valildGraderRef"],

            ruleId: req.body["ruleId"],
            revId: req.body["revId"],
            text: req.body["text"],
            value: req.body["value"],
            deleted: req.body["deleted"],
            finalized: req["quizFinalized"],

        }
        if (input.finalized) { throw utils.generateError({ configCode: 'quizFinalized' }); }

        // get document
        let data = await respdb.view("byQuizId", "subGradingMeta", { key: input.quiz })
        let record = data.rows[0].value
        
        // check if latest version 
        if (input.revId != record["_rev"]) {
            // let newRubrics = record["rubrics"][input.ref]
            res.success(
                {
                    updated: false,
                    reason: "revMismatch",
                    updatedRubrics: record["rubrics"][input.ref],
                    updatedRevId: record["_rev"],
                    reqData: req.body
                }
            )
        } else {
            // check if add allwed
            if (!record["rubrics"][input.ref]["editable"]) { throw utils.generateError({ configCode: 'addNotEnabled' }) }
            // check if this rule exists
            let ifExists = record["rubrics"][input.ref]["rules"].find(itm => { return itm["deleted"] == false && itm["id"] == input.ruleId })
            if (!ifExists) { throw utils.generateError({ configCode: 'updRuleNotExists' }) }
            else {
                if (input.text) { 
                    textExists = record["rubrics"][input.ref]["rules"].find(itm => { return itm["deleted"] == false && itm["text"] == input.text })
                    if(textExists){
                        if(textExists["id"]!=ifExists["id"]){
                            throw utils.generateError({ configCode: 'updRuleTextExists' })
                        }
                    }else{
                        ifExists["text"] = input.text 
                    }
                }
                if (input.value) { 
                    if(isNaN(input.value)){
                        throw utils.generateError({ configCode: 'updRuleInvalidVal' })
                    }else{
                        if(input.value === 0){
                            throw utils.generateError({ configCode: 'updRuleInvalidVal' })
                        }else{
                            ifExists["value"] = input.value 
                        }
                    }
                }
                if (input.deleted) { ifExists["deleted"] = true }
                let newDate = utils.getCurrentDateInUTC()
                ifExists["update"]["on"] = newDate
                ifExists["update"]["by"] = input.grader

                let updDoc = await respdb.insert(record)

                // log 
                let uag = "";
                let ug = req.useragent
                if (ug) {
                    if (ug['source']) { uag = ug['source'] }
                    else if (ug['examApp']) { uag = JSON.stringify(ug['useragent']) }
                }
                utils.logEvent("info", `Grader : ${input.quiz}-${input.grader}-${input.ref} , Updated  rule  # ${input.ruleId} , Useragent : ${uag}`)
                
                
                res.success({
                    updated: true,
                    updatedRule: ifExists,
                    updatedRevId: updDoc["rev"]
                })
            }
        }
    } catch (error) { res.error200(error) }
}
module.exports.editRubricsRule = editRubricsRule

let ping = (req, res, next) => {
    //out(req.body)
    res.success({ message: "Grader Token is valid" })
}
module.exports.ping = ping