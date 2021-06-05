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
const uplugins = require('../user/plugins')

let index = async (req, res, next) => {
    // let data = await plugins.getQuizAnalytics('AAKN','1','4')
    //res.success(data)
    res.success({ message: "Quiz API. Version 2" })

}
module.exports.index = index;

let getTime = (req, res, next) => {
    var d = new Date();
    // console.log(d);
    res.success({ time: d.getTime() })
}
module.exports.getTime = getTime;

let languageAndCopyright = async (req, res, next) => {
    // returns languge json in input language, if no lang provided english by defualt
    let language = "default"
    let response = {};
    try {
        let cpData = await globaldb.get('copyright');
        delete cpData['_id'];
        delete cpData['_rev']
        response['copyright'] = cpData;
        let lgData = await globaldb.get('languages');
        if (req.body.language) {
            language = req.body.language;
        }
        if (lgData[language]) {
            response.language = lgData[language]
            res.success(response)
        } else {
            throw utils.generateError({ configCode: 'invLang' })
        }
    } catch (err) {
        res.error(err)
    }
}
module.exports.languageAndCopyright = languageAndCopyright;

let out = (obj) => {
    let monitor = false;
    if (monitor) {
        console.log(obj)
    }
}

let checkIfQuizAttempted = (quizid, uname) => {
    // the reduce function
    return new Promise(async (resolve, reject) => {
        try {
            let data = await examdb.view('byQuizUser', 'quizIdToAttempted', { key: quizid + "-" + uname })
            if (data.rows.length > 0) {
                var attempted = false;
                var startedOn = [];
                // since the submitted on date will be same, taking it's value from the first section 
                var submittedOn = data.rows[0].value.submittedOn;
                var quizIds = [];
                var secObj = {}
                data.rows.forEach(doc => {
                    var value = doc.value;
                    var isStartedSec = false;
                    var secAttempted = false;
                    if (value.attempted == true) {
                        // attempted exists means the section is submitted/graded by math server 
                        secAttempted = true;
                    } else {
                        // if the value of submittedon exists, the section was not attempted but the quiz was still submitted for grading
                        //  whenever a quiz is graded, all sections will have the same submittedOn timestamp.
                        //  attempted flag for a section tells us whether the responses for that section exists or not which in turn means that whether the user opened that section or not
                        if (value.submittedOn) { secAttempted = true; }
                    }
                    // detrmining whether the quiz is graded or not  - if either of the section has the "secAttempted" field true, it means the whole quiz is sumbited.
                    attempted = secAttempted || attempted;
                    if (value.startedOn) {
                        // whenever a section is started , started on time stamp is added to it.
                        isStartedSec = true
                        startedOn.push(value.startedOn);
                    }
                    quizIds.push(value.id)
                    secObj[value.id] = isStartedSec;
                })

                let isStarted = false;
                let startDate = "Not attempted";

                if (startedOn.length > 0) {
                    isStarted = true;
                    // calculating start time of the **quiz**, which is the min time among all section start timestamps
                    startDate = utils.quizStartDate(startedOn)
                }
                // checking in the response documnent for submitStatus flag ...
                let respCheck = { submitStatus: "not_submitted", isSubmitted: false, submitExists: false }
                let submitExists = false;
                let data1 = await respdb.view('forResponseDoc', 'quizIdUserIdToSubmitStatus', { key: quizid + "-" + uname })
                if (data1.rows.length > 0) {
                    // resp doc exists
                    let respStatusDoc = data1.rows[0].value;
                    if (respStatusDoc.submitStatus) {
                        respCheck.submitExists = true;
                        let subKeyWords = ['submitted', 'graded', 'regrade']
                        respCheck['submitStatus'] = respStatusDoc.submitStatus;
                        if (subKeyWords.indexOf(respStatusDoc.submitStatus) > -1) {
                            respCheck['isSubmitted'] = true;
                        }
                    }
                }
                if (respCheck.submitExists == true) {
                    attempted = attempted || respCheck['isSubmitted']
                }
                // console.log({ respCheck: respCheck, sectionStarted: secObj, started: startedOn, submitted: submittedOn, isAttempted: attempted, quizIds: quizIds, isStarted: isStarted, startedOn: startDate })
                /**
                 * respCheck: {  // response documnet check 
                 *  submitStatus:"the value , can either be submitted,graded,regrade",
                 *  isSubmitted:"whether the quiz is submitted or not",
                 *  submitExists: "true, if user has asked to submit the quiz"
                 * }, 
                 * sectionStarted: "object of whether section has started {"1":true,"2":false,...}",  
                 * started: "array of all section start date ["2020..",...]", 
                 * submitted: "date at which quiz was submitted", 
                 * isAttempted: attempted, "whether the quiz is sumbitted or not "
                 * quizIds: ["AAIR-1-1",...] array of all quiz ids, 
                 * isStarted: "whether the quiz was started or not i.e altest one timestamp exists ", 
                 * startedOn: "time in utc at which the quiz was started, calculated as min of all section" 
                 */
                resolve({
                    respCheck: respCheck,
                    sectionStarted: secObj,
                    started: startedOn,
                    submitted: submittedOn,
                    isAttempted: attempted,
                    quizIds: quizIds,
                    isStarted: isStarted,
                    startedOn: startDate
                })
            } else {
                // either quizes not yet created or some other error
                reject(utils.generateError({ configCode: 'exam404' }));
            }
        } catch (error) { reject(error) }
    })
}

let login = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['quizId', 'uname'],
            validFields: ['quizId', 'uname', 'pwd', 'reqByAuthor', 'altPwd']
        })

        if (!req.body.hasOwnProperty("altPwd")) {
            await utils.inspectJSON(req.body, {
                requiredFields: ['quizId', 'uname', 'pwd'],
                validFields: ['quizId', 'uname', 'pwd', 'reqByAuthor', 'altPwd']
            })
        }

        let authorLogin = false;
        if (req.body.reqByAuthor) {
            if (req.body.reqByAuthor[0] == true) {
                // TODO validate reqbyauthor
                authorLogin = true;
                //res.cookie('reqByAuthor', reqCookie, config.get('reqByAuthorCookie'));
            }
        }

        let examData = {};  // will contain data fetched from  exam_exam
        let metaData = {} // will contain data  fetched form exam_meta
        let usrTkn;
        let password = req.body.pwd;

        if (req.body.altPwd) {
            // if logging in through user accounrt
            // 1. check if login token is valid
            let checkTkn = await respdb.view("byUserEmailToken", "sessionDetail", { key: req.body["altPwd"] })
            console.log(JSON.stringify(checkTkn))
            if (checkTkn["rows"].length > 0) {
                let vUser = await uplugins.getUserDoc(checkTkn["rows"][0]["value"]["email"],false)
                //console.log(vUser)
                let qDet = vUser.quiz.find(itm => { return itm["quizId"] == req.body.quizId && itm["userName"] == req.body.uname })
                //console.log(qDet)
                if (qDet) {
                    password = qDet.pwd;
                    let uag = req.useragent;
                    vUser.user["logs"].push({ date: utils.getCurrentDateInUTC(), note: "Quiz login " + req.body.quizId, userAgent: uag["source"] })
                    await respdb.insert(vUser.user)
                } else { throw utils.generateError({ configCode: 'invalidLogin' }) }
            } else { throw utils.generateError({ configCode: 'invalidLogin' }) }
        }

        let input = {
            quiz: req.body.quizId,
            user: req.body.uname,
            password: password
        }

        // Part 1 : Pre checks 
        // let quizMetaCheck;
        // this view take quizid and returns quiz metadata
        let metadbView = await metadb.view("byQuiz", "quizIdToMetaData", { key: input.quiz })
        if (metadbView.rows.length > 0) {
            metaData = metadbView.rows[0].value
        } else {
            // quiz does not exists, throw err
            throw utils.generateError({ configCode: 'meta404' })
        }
        // let quizMetaCheck = await metadb.get(input.quiz)

        if (metaData['security'] == 'chromeOnly') {
            // check if security is chromeonly, loginrequest is coming from chrome. This happens only on the login request nowhere else 
            let isChromeCheck = req.useragent['isChrome'] == true;
            let isDesktopCheck = req.useragent['isDesktop'] == true;
            let check = isChromeCheck && isDesktopCheck;
            if (check == false) { throw utils.generateError({ configCode: 'chromeOnly' }) }
        }

        // to check if the quiz was deleted
        if (metaData.author == 'unknown') { throw utils.generateError({ configCode: 'meta404' }) }

        if (metaData.status != 'active') {
            // to check if the quiz is active 
            // instructors allowed to login even if quiz is inactive 
            if (!req.body.reqByAuthor) { throw utils.generateError({ configCode: 'inact' }) }
        }

        // check if user even exists in the records or not
        // this prevent unnecessary token doc generation for user that does not even exists 
        if (metaData['credentials'].indexOf(input.user) == -1) { throw utils.generateError({ configCode: 'meta404' }) }

        // Part 2 : password check 

        let metaDBData = await metadb.view('byQuizUser', 'authentication', { key: [input.quiz, input.user, input.password] })
        let loginAttemptSuccessful = false;
        let studentData;
        if (metaDBData.rows.length > 0) {
            // record with given quizid, uname and password exists => password matched
            loginAttemptSuccessful = true;
            // store student metadata
            studentData = metaDBData.rows[0].value
        }

        let tokenData = await addOrModifyRespTokenDoc({
            loginAttemptSuccessful: loginAttemptSuccessful,
            user: input.user,
            quiz: input.quiz,
            uname: input.user,
            quizId: input.quiz,
            useragent: req.useragent,
            authorLogin: authorLogin,
            beginTime: metaData.beginTime,
            endTime: metaData.endTime
        });

        if (!tokenData.loginAllowed) {
            throw utils.generateError({ configCode: 'meta404' })
        } else {
            // login allowed 
            // get additional data
            usrTkn = tokenData.token
            examData = await checkIfQuizAttempted(input.quiz, input.user)
            // build response here
            // first check if the quiz is even active or not 

            let responseData = {
                beginTime: metaData['beginTime'],
                endTime: metaData['endTime'],
                title: metaData['title'],
                isSections: metaData['isSections'],
                loginTime: metaData['loginTime'],
                sections: metaData['sections'],
                author: metaData['authorName'],
                calc: metaData['calc'],
                duration: metaData['duration'],
                instruction: metaData['instruction'],
                quizType: metaData['quizType'] || "sectioned",
                allowFC: metaData['allowFC'],
                allowStats: metaData['allowStats']
            }

            if (studentData['userData']) {
                responseData['userData'] = studentData['userData']
            }

            if (metaData.isSections == true) {
                // later this will be available in the conn's view
                let userArray = [];
                metaData.sections.forEach((item, index) => {
                    //userArray.push(req.body.quizId + "-" + req.body.uname + '-' + (index + 1))
                    metaData.sections[index]['sectionId'] = input.quiz + "-" + input.user + '-' + (index + 1)
                })
                //responseData['userid'] = userArray
            } else {
                //responseData["userid"] = req.body.quizId + '-' + req.body.uname;
                metaData.sections[0]['sectionId'] = input.quiz + "-" + input.user
            }
            var today = new Date();
            var beginDate = new Date(metaData.beginTime);
            var endDate = new Date(metaData.endTime);

            // checking if the quiz has started i.e. whether the user can start giving the quiz
            // user is still allowed to login and view instructions even if the quiz has not yet started
            //responseData.isBegin = (beginDate > today) ? true : false

            // check if the quiz is over
            //responseData.isEnd = (endDate > today) ? true : false

            // check if the user is already attempted the quiz
            // if yes, at the front end the user must be redirected to the summary page
            // if not, display the instruction page
            responseData.quizAttempted = examData.isAttempted;
            // if not attempted i.e submitted check if statrted
            if (!responseData.quizAttempted) {
                responseData.startedOn = null;
                responseData.isStarted = false;
                if (examData.started.length > 0) {
                    responseData.isStarted = true;
                    // calculating start time of the quiz
                    responseData.startedOn = utils.quizStartDate(examData.started)
                }
            }

            responseData.token = usrTkn;  //tokenData.token 
            // if (responseData.quizAttempted) {
            //   // quiz already submitted, redirect to summary page
            //   res.success({ quizAttempted: true, token: usrTkn })
            // } else {
            //   res.success(responseData)
            // }
            res.success(responseData)
        }
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


var logFailedAttempt = async (options) => {
    // just send email
    // console.log("will send email...........")
    try {
        // fetch quiz details  options.quiz + '-' + options.uname
        let quizData = await metadb.get(options.quiz); // TODO use a view later 
        let author = { send: false, email: '', body: '', logMsg: '', data: {} };
        let student = { send: false, email: '', body: '', logMsg: {}, data: {} }
        if (quizData.sendMail) {
            //onsole.log(quizData.users)
            // get email if student 
            let userCol = quizData['users']['userCol']
            let emailCol = quizData['users']['emailCol']
            if (quizData['users']['userData'][options.uname]) {
                if (quizData['users']['userData'][options.uname][emailCol]) {
                    student.send = true;
                    student.email = quizData['users']['userData'][options.uname][emailCol]
                    let tokenDocRows = await respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: options.quiz + '-' + options.uname })
                    let tokenData = JSON.parse(JSON.stringify(tokenDocRows.rows[0].value))
                    let newEmailToken = utils.generateTokenN(20)
                    tokenData['resetEmailToken'] = newEmailToken;
                    tokenData['resetEmailDate'] = utils.getCurrentDateInUTC();
                    // console.log(tokenData);
                    await respdb.insert(JSON.parse(JSON.stringify(tokenData)))
                    let link = await config.get('frontEndResetEmail') + '?quizId=' + options.quiz + '&uname=' + options.uname + '&token=' + newEmailToken;

                    student.data = {
                        quizId: options.quiz,
                        resetLink: link
                    }
                    //student.body = "<p> Dear user <br>You have reached the maximum attempts to log in the quiz <%-quizId%>. Your quiz is locked. </p> <p> Click <a href='<%-resetLink%>'>here</a> to unlock your account.</p> "
                    student.logMsg = { action: 'reset_email_sent', priority: 1, message: 'Instructions to reset password sent to email :' + student.email, quizId: options.quiz, uname: options.uname }
                }
            }
        }
        // fetch email of author
        // send email to author with reset instructions
        if (quizData.authorEmail) {
            author.send = true;
            author.email = quizData.authorEmail;

            author.data = {
                authorName: quizData.authorName,
                uname: options.uname,
                quizId: options.quiz,
                stEmailSet: student.email,
                stEmail: student.email,
            }
            author.logMsg = { action: 'reset_email_sent', priority: 1, message: 'Instructions to reset password sent to email :' + author.email, quizId: options.quiz, uname: options.uname }

        }

        if (author.send) {
            await utils.dbLog(author.logMsg)
            let msg = await utils.composeMail("quizAuthorUnlock", author.data)
            utils.requestToQuizServer('send_mail', { to: author.email, sub: msg.subject, body: msg.body })
        }

        if (student.send) {
            await utils.dbLog(student.logMsg)
            let msg1 = await utils.composeMail("quizStudentUnlock", student.data)
            utils.requestToQuizServer('send_mail', { to: student.email, sub: msg1.subject, body: msg1.body })
        }
        return
    } catch (error) {
        console.log(error)
        throw error
    }
}

var addOrModifyRespTokenDoc = (options) => {
    return new Promise(async (resolve, reject) => {
        // inputs -   loginAttemptSuccessful, user, quiz, uname, quizId, useragent, author login
        // outputs -  token (new token, on successful login) , loginAllowed (boolean , whether allowed to login)
        try {
            let maxFailedLoginAttempts = await config.get('maxFailedLoginAttempts')
            // check if token doc exists
            let tokenDBDoc = await respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: options.quiz + "-" + options.user });
            let tokenDoc1 = {}; // common token db
            if (tokenDBDoc.rows.length == 0) {
                // token doc does not exists => first time login => create a new token doc
                // get new response doc id 
                let newIdDetails = await getNewRespDBid();
                // new doc
                tokenDoc1 = {
                    _id: newIdDetails._id,
                    token: utils.generateToken(),
                    quizId: options.quiz,
                    userId: options.user,
                    failedLogin: 0, //options.loginAttemptSuccessful ? 0 : 1,
                    log: []
                }
                // if old id is being reused, you also need the rev id
                if (newIdDetails._rev) { tokenDoc1._rev = newIdDetails._rev; }
                out("will create new token doc id = " + newIdDetails._id)
            } else {
                // token doc exists
                let existingTokenData = tokenDBDoc.rows[0].value;
                if (!existingTokenData.log) { existingTokenData.log = [] }
                existingTokenData['token'] = utils.generateToken()
                tokenDoc1 = existingTokenData
                out("token doc exists id = " + tokenDoc1['_id'])
                if (tokenDoc1['failedLogin'] >= maxFailedLoginAttempts) {
                    if (options.authorLogin == false) {
                        //  after 11 aattempts , request will be rejected and not logged in the token doc
                        return reject(utils.generateError({ configCode: 'maxlogin' }))
                    }
                }
            }

            // deadline check
            let dlLoginNotAllowed = false; // flag to check if the deadlne is over and response does not exists , do not allow login 
            var today = new Date();
            var beginDate = new Date(options.beginTime);
            var endDate = new Date(options.endTime);

            if (today > endDate) {
                // newpolicy :  login is allowed after deadline
                // quiz deadline is over
                // check if response doc for that quiz exists
                // if not , login not allowed
                // let qRes = await respdb.view('forResponseDoc', 'quizIdUserIdToResponse1', { key: options.quiz + '-' + options.uname })
                let cAttempt = await checkIfQuizAttempted(options.quiz, options.user)
                if (cAttempt.isStarted == false) {
                    // quiz not started
                    dlLoginNotAllowed = true; // login not allowed
                    if (options.authorLogin == true) {
                        // author logging in
                        if (cAttempt.isAttempted == true) { dlLoginNotAllowed = false; }
                    }
                }
            }

            out("deadline not allowed flag " + dlLoginNotAllowed)
            let lobj;
            let sendEmailLink = false; // to send email to student  with a link to unlock account 

            if (options.loginAttemptSuccessful) {
                out("login attempte successful ")
                let accBlocked = false; // flag, set if  account is blocked
                if (tokenDoc1['failedLogin'] < maxFailedLoginAttempts) {
                    accBlocked = false;
                } else { accBlocked = true; }

                out("accBlock status " + accBlocked)

                if (options.authorLogin) {
                    out("author login...")
                    if (accBlocked) {
                        //  author loggin in a blocked acc
                        lobj = utils.generateLogObject({ action: "logged_in", priority: 1, message: "Login into a blocked account ", useragent: options.useragent, authorLogin: options.authorLogin })
                    } else {
                        // author login , normal
                        lobj = utils.generateLogObject({ action: "logged_in", priority: 2, message: "Logged in", useragent: options.useragent, authorLogin: options.authorLogin })
                    }
                } else {
                    out("student login...")
                    if (accBlocked) {
                        // student login in blocked acc rehected
                        lobj = utils.generateLogObject({ action: "logged_in_blocked2", priority: 1, message: "Login request rejected. Account blocked", useragent: options.useragent, authorLogin: options.authorLogin })
                    } else {
                        // student login , normal 
                        tokenDoc1['failedLogin'] = 0;
                        out(".... setting faliledLogin to 0")
                        if (dlLoginNotAllowed) {
                            // if the quiz deadline allow them to still login 
                            out("logging in after deadline... rejected")
                            lobj = utils.generateLogObject({ action: "logged_in", priority: 2, message: "Login after quiz deadline", useragent: options.useragent, authorLogin: options.authorLogin })
                        } else {
                            lobj = utils.generateLogObject({ action: "logged_in", priority: 2, message: "Logged in", useragent: options.useragent, authorLogin: options.authorLogin })
                        }

                    }
                }
            } else {
                // login failure
                // assuming author will never login with incorrect credentials
                tokenDoc1['failedLogin']++
                out("incremented faliedLogin")
                if (tokenDoc1['failedLogin'] == 10) {
                    // log account blocked and send email
                    sendEmailLink = true;
                    lobj = utils.generateLogObject({ action: "logged_in_blocked1", message: "More than 10 failed login attempts. Account blocked", priority: 1, useragent: options.useragent, authorLogin: options.authorLogin })
                } else {
                    lobj = utils.generateLogObject({ action: "logged_in_failure", priority: 1, message: "Failed login attempt", useragent: options.useragent, authorLogin: options.authorLogin })
                }
            }

            out("final falidLogin = " + tokenDoc1.failedLogin)
            tokenDoc1.log.push(lobj)
            await respdb.insert(tokenDoc1)
            await utils.emitEvent(options.quiz, options.user, lobj)

            if (sendEmailLink) {
                await logFailedAttempt(options);
            }
            // if (dlLoginNotAllowed) {
            //     out("...rejecting")
            //     reject(utils.generateError({ configCode: 'afterDeadline' }))
            // } else {
            if (tokenDoc1.failedLogin >= maxFailedLoginAttempts) {
                // allow the author to login even after max login 
                if (options.authorLogin) {
                    // allow author
                    out("...resolving")
                    resolve({ dlNotSub: dlLoginNotAllowed, token: tokenDoc1.token, loginAllowed: options.loginAttemptSuccessful })
                } else {
                    // reject student
                    out("...rejecting")
                    reject(utils.generateError({ configCode: 'maxlogin' }))
                }
            } else {
                out("...resolving")
                resolve({ dlNotSub: dlLoginNotAllowed, token: tokenDoc1.token, loginAllowed: options.loginAttemptSuccessful })
            }
            //}
        }
        catch (err) {
            //console.log(err['error']=='not_found' && err['reason']=='missing')
            if (err['error'] == 'not_found' && err['reason'] == 'missing') {
                //console.log("exam id not found")
                reject(utils.generateError({ configCode: 'meta404' }))
            } else {
                reject(err)
            }
        }
    })
}

let getNewRespDBid = () => {
    return new Promise((resolve, reject) => {
        out("Searching for a new id in response db")
        respdb.view('byAdmin', 'getAvailableId')
            .then(data => {
                // out(data)
                let id = data.rows[0].value;
                let num = (id < 0) ? -id : id + 1;
                let availableId = "0000".concat(num.toString(36)).slice(-5);
                out("available id =" + availableId)
                if (id < 0) {
                    // resuing old doucment , rev id required
                    return respdb.get(availableId)
                } else {
                    // fresh id
                    resolve({ _id: availableId })
                }
            })
            .then((data) => {
                resolve({
                    _id: data._id,
                    _rev: data._rev
                })
            })
            .catch(err => {
                reject(err)
            })
    })
}

let checkIfQuizIsActive = (quizId) => {
    return new Promise((resolve, reject) => {
        metadb.get(quizId)
            .then((quizData) => {
                // out(quizData)
                let today = new Date();
                let beginTime = new Date(quizData.beginTime);
                let endTime = new Date(quizData.endTime);
                let validTime = new Date(quizData.validUpto);
                let isActive = true;

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

                if (isActive) {
                    resolve()
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


let genBlankQueResObj = (queId, qType) => {
    let res = {};
    res['ref'] = queId
    res['type'] = qType
    res['timeTaken'] = 0
    res['helpUsed'] = 0
    res['lock'] = false
    res['review'] = 0
    res['answerId'] = -1
    res['tempAns'] = -1
    return res
}

let createResponseDoc = (options) => {
    // to create new exam_response doc recod
    return new Promise((resolve, reject) => {
        getNewRespDBid()
            .then(async resId => {
                let newDoc = { quizId: options.quizId, userId: options.userId }

                let allQuizDB = await examdb.view("byQuizUser", "quizIdUserIdToDoc", { key: options.quizId + "-" + options.userId })
                let blankSection = {}; // { "1": { meta: {}, response: [] } }
                allQuizDB.rows.map(quizRecord1 => {
                    let quizRecord = quizRecord1['value']
                    // initalize each section object, 
                    let blankResp = [];
                    quizRecord["quizdata"]["elements"].map(que => {
                        blankResp.push(genBlankQueResObj(que["ref"], que["type"]))
                    })
                    blankSection[quizRecord["meta"]["section"]] = { meta: { saveType: "blankInitBySystem" }, response: blankResp }
                })

                if (options.isSection) {
                    newDoc['sections'] = blankSection
                } else { newDoc['response'] = [] }

                newDoc._id = resId._id;

                if (resId._rev) {
                    newDoc._rev = resId._rev;
                }
                return respdb.insert(newDoc)
            })
            .then((data) => { resolve() })
            .catch(err => { reject(err) })
    })

}

let getQuizTimings = async (req, res, next) => {
    // returns info related to quiz timings
    // quizid,uname
    let input = {}
    let output = {};
    let inputQuizId;
    let secSummary = {}
    let tt = 0;
    try {
        await utils.inspectJSON(req.body, { requiredFields: ['quizId', 'uname'], validFields: ['quizId', 'uname', 'reqByAuthor'], acceptBlank: false })
        input = {
            quiz: req.body.quizId,
            user: req.body.uname,
        }
        inputQuizId = input.quiz + '-' + input.user;

        let examDb = await checkIfQuizAttempted(input.quiz, input.user)
        output.sectionStarted = examDb.sectionStarted;
        output.isStarted = examDb.isStarted;
        output.startedOn = examDb.startedOn;

        // if quiz has started, calculate the total time by adding time spent in all the sections of the quiz
        let respDb = await respdb.view('forResponseDoc', 'quizIdUserIdToResponse1', { key: inputQuizId })
        if (respDb.rows.length > 0) {
            let resp = respDb.rows[0].value;
            if (resp.response) {
                let ans = 0;
                let infoType = 0
                let gradAtt = 0;
                let totalGrad = 0;
                let gradedSkip = 0;
                secSummary[inputQuizId] = {}
                if (resp.response.length > 0) {
                    resp.response.forEach(itm => {
                        tt += itm.timeTaken;
                        if (itm.lock) { ans++ }
                        if (itm.type == 'info') {
                            infoType++
                        } else {
                            totalGrad++;
                            // if the item is not info type and is locked , increment this counter
                            if (itm.lock) {
                                gradAtt++;
                            } else {
                                gradedSkip++;
                            }
                        }
                    })
                    secSummary[inputQuizId]['time'] = tt;
                    secSummary[inputQuizId]['attempted'] = ans;
                    secSummary[inputQuizId]['skipped'] = resp.response.length - ans;
                    secSummary[inputQuizId]['ungraded'] = infoType
                    secSummary[inputQuizId]['total'] = resp.response.length
                    secSummary[inputQuizId]['gradedAttempted'] = gradAtt;
                    secSummary[inputQuizId]['totalGraded'] = totalGrad;
                    secSummary[inputQuizId]['gradedSkip'] = gradedSkip;

                }
            } else if (resp.sections) {
                Object.keys(resp.sections).map((key) => {
                    if (resp.sections[key]['response']) {
                        resp.sections[key].response.map(itm => {
                            tt += itm.timeTaken;
                        })
                    }

                    let newkey = inputQuizId + "-" + key;
                    if (resp.sections[key]['response'].length > 0) {
                        secSummary[newkey] = {}
                        let tts = 0;
                        let attempted = 0;
                        let infoType = 0;
                        let gradAtt = 0;
                        let totalGrad = 0;
                        let gradedSkip = 0;
                        resp.sections[key].response.map(itm => {
                            tts += itm.timeTaken;
                            if (itm.lock) {
                                attempted++
                            }

                            if (itm.type == 'info') {
                                infoType++
                            } else {
                                totalGrad++;
                                // if the item is not info type and is locked , increment this counter
                                if (itm.lock) {
                                    gradAtt++;
                                } else {
                                    gradedSkip++;
                                }
                            }
                        })
                        secSummary[newkey]['time'] = tts;
                        secSummary[newkey]['attempted'] = attempted;
                        secSummary[newkey]['skipped'] = resp.sections[key].response.length - attempted;
                        secSummary[newkey]['ungraded'] = infoType;
                        secSummary[newkey]['total'] = resp.sections[key]['response'].length;
                        secSummary[newkey]['gradedAttempted'] = gradAtt;
                        secSummary[newkey]['totalGraded'] = totalGrad;
                        secSummary[newkey]['gradedSkip'] = gradedSkip;

                    }
                })
            }
        }
        output['secSummary'] = secSummary
        output['timeTaken'] = tt;

        res.success(output)
    } catch (err) {
        res.error200(err)
    }
}
module.exports.getQuizTimings = getQuizTimings;

let examIdToDetails = (examId) => {
    // return isSection, quizId, uname
    let quizDetails = { isSection: false }
    let qid = examId.split('-');
    quizDetails.quizId = qid[0]
    quizDetails.uname = qid[1]
    if (qid.length == 3) {
        quizDetails.isSection = true;
        quizDetails.secId = qid[2]
    }
    // {isSection,quizId,uname,secId}
    return quizDetails
}


let quizData = async (req, res, next) => {
    let output = {};
    let inputQuizId;
    let details;
    let quizDetails = { isSection: false }

    try {
        await utils.inspectJSON(req.body, { requiredFields: ['examId'], validFields: ['examId', 'reqByAuthor'], acceptBlank: false })

        inputQuizId = req.body.examId;

        let quizDetails = examIdToDetails(inputQuizId)

        await checkIfQuizIsActive(quizDetails.quizId)

        // get quiz data
        let exDb = await examdb.view('byQuizUser', 'quizIdToData', { key: inputQuizId })
        utils.checkLength(exDb.rows, 'exam404')
        output = exDb.rows[0].value;

        // if starting the quiz for the first time, send request to math server
        if (!output.startedOn) {
            if (quizDetails.isSection) {
                await utils.requestToQuizServer('start_sectioned_quiz_section', { 'quizid': inputQuizId })
            } else {
                throw utils.generateError({ configCode: 'internalError' });
                // await utils.requestToQuizServer('start_examineer_quiz', { 'quizid': inputQuizId })
            }
        }

        // fetching the response object 
        let respDbKey = quizDetails.quizId + "-" + quizDetails.uname;
        let respDbData = await respdb.view('forResponseDoc', 'quizIdUserIdToResponse1', { key: respDbKey })
        if (respDbData.rows.length > 0) {
            // response doc exists
            let tt = 0, lastQue = 1, resp;
            let dbresp = respDbData.rows[0].value

            if (quizDetails.isSection) {
                // sectional quiz
                let sectId = quizDetails.secId
                if (dbresp.sections[sectId]) {
                    resp = dbresp.sections[sectId]['response'] ? dbresp.sections[sectId]['response'] : [];
                    if (dbresp.sections[sectId]['meta']['lastQue']) {
                        lastQue = dbresp.sections[sectId]['meta']['lastQue'];
                    }
                } else {
                    resp = []
                }

                Object.keys(dbresp.sections).map((key) => {
                    if (dbresp.sections[key]['response']) {
                        dbresp.sections[key].response.map(itm => {
                            // out(itm);
                            tt += itm.timeTaken;
                        })
                    }
                })
            } else {
                // old quiz, single response exists
                resp = dbresp.response;
                dbresp.response.map(itm => {
                    tt += itm.timeTaken;
                })
                if (dbresp['lastQue']) {
                    lastQue = dbresp['lastQue']
                }
            }
            output['timeTaken'] = tt;
            output['lastQue'] = lastQue
            output['response'] = resp
            output.isResponse = true; // response document exists

        } else {
            // response doc does not exists, create a new one
            output.timeTaken = 0;
            output.response = [];
            output.isResponse = false;
            output['lastQue'] = 1

            await createResponseDoc({
                quizId: quizDetails.quizId,
                userId: quizDetails.uname,
                isSection: quizDetails.isSection
            })
        }

        let action;
        if (quizDetails.isSection) {
            action = 'Entered section ' + quizDetails.secId
        } else {
            action = "Entered quiz"
        }


        await utils.dbLog({ uname: quizDetails.uname, quizId: quizDetails.quizId, message: action, action: "entered", priority: 2, useragent: req.useragent })

        res.success(output)
    } catch (err) {
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}
module.exports.quizData = quizData;

let saveQuizResponse = async (req, res, next) => {
    try {
        let inputExamId, examIdParts;
        await utils.inspectJSON(req.body, { requiredFields: ['examId', 'resData'], validFields: ['examId', 'resData', 'lastQue', 'exit', 'reqByAuthor', 'saveType'], acceptBlank: false })

        let quizDetails = examIdToDetails(req.body.examId);

        let quizStatus = await checkIfQuizAttempted(quizDetails.quizId, quizDetails.uname)

        // response check 
        let isRespError = { status: false, errors: [] };
        req.body.resData.response.map((itm, index) => {
            // console.log(itm)
            if (itm.lock == true) {
                if (itm['type'] !== "sub") {
                    let eq = JSON.stringify(itm['answerId']) == JSON.stringify(itm['tempAns'])
                    if (eq == false) {
                        // if question is unlocked, answerId must be -1 
                        // console.log(JSON.stringify(req.body.resData.response))
                        isRespError.status = true;
                        isRespError.errors.push({
                            msg: "Question locked, but answer does not match with tempans ",
                            item: JSON.stringify(itm),
                            i: index
                        })
                        // setting answerid to -1 
                        itm['answerId'] = itm['tempAns']
                    }
                } else
                    if (itm['type'] === "sub") {
                        itm['answerId'] = 1;
                    }

            } else {
                if (itm.answerId != -1) {
                    // if question is unlocked, answerId must be -1 
                    // console.log(JSON.stringify(req.body.resData.response))
                    isRespError.status = true;
                    isRespError.errors.push({
                        msg: "Question unlocked, but answer id is not -1 ",
                        item: JSON.stringify(itm),
                        i: index
                    })
                    // setting answerid to -1 
                    itm['answerId'] = -1
                }
            }
        })

        if (quizStatus.isAttempted) {
            // quiz already submitted error
            throw utils.generateError({ configCode: 'alreadySubmitted' });
        } else {
            inputExamId = req.body.examId;
            examIdParts = inputExamId.split('-');

            let respDBKey = examIdParts[0] + '-' + examIdParts[1];
            let respDB = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { key: respDBKey })
            utils.checkLength(respDB.rows, 'exam404')
            let respDoc = respDB.rows[0].value;

            // at this point we are asuming that the response document for the quiz exists.
            //  Since our policy is to create a response document when the user vists the quiz for the first time. 
            // and this route is called only from the inside of the quiz. so it is safe to assume that the response document exists. 
            //out(respDoc)
            if (examIdParts.length == 2) {
                // normal quiz
                // will save in the old format only
                respDoc.response = req.body.resData.response;
                if (req.body.lastQue) {
                    respDoc['lastQue'] = req.body.lastQue;
                }

                if (req.body.saveType) {
                    respDoc['saveType'] = req.body.saveType;
                }

            } else {
                // sectional quiz
                if (!respDoc['sections'][examIdParts[2]] || respDoc['sections'][examIdParts[2]] == {}) {
                    out("init blank")
                    respDoc['sections'][examIdParts[2]] = { response: [], meta: {} }
                }
                respDoc['sections'][examIdParts[2]]['response'] = req.body.resData.response;
                if (req.body.lastQue) {
                    respDoc['sections'][examIdParts[2]]['meta']['lastQue'] = req.body.lastQue;
                }
                // let sectionIndex = examIdParts[2] - 1;
                // respDoc.response[sectionIndex] = req.body.resData.response;

                if (req.body.saveType) {
                    respDoc['sections'][examIdParts[2]]['meta']['saveType'] = req.body.saveType;
                }

            }


            respDoc['lastSaveAt'] = utils.getCurrentDateInUTC()

            if (isRespError.status == true) {
                isRespError['docId'] = respDoc['_id']
                isRespError['examId'] = inputExamId
                await utils.logEvent("error", JSON.stringify(isRespError))
            }

            await respdb.insert(respDoc);

            if (req.body.exit == true) {
                let action
                if (examIdParts.length == 2) {
                    action = "Exited quiz"
                } else {
                    action = "Exited section " + examIdParts[2]
                }
                await utils.dbLog({ uname: examIdParts[1], quizId: examIdParts[0], message: action, action: "exited", priority: 2, useragent: req.useragent })
            }
            res.success("Response saved")
        }
    } catch (err) {
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}
module.exports.saveQuizResponse = saveQuizResponse;


let generateBlankRespPlainQuiz = async (quizId, uname) => {
    //out(quizId)
    let data1 = await examdb.view('byQuizUser', 'quizIdToData', { key: quizId + "-" + uname })
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
        return resp

    } else {
        return []
    }
}

let submitQuiz = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, { requiredFields: ['quizId', 'uname', 'isSection'], validFields: ['quizId', 'uname', 'isSection', 'reqByAuthor', 'submitReason'] })
        // await checkIfQuizIsActive(req.body.quizId)
        let subMsg = "Quiz submitted"

        let data = await checkIfQuizAttempted(req.body.quizId, req.body.uname)
        if (data.isAttempted) {
            // quiz already submitted error
            throw utils.generateError({ configCode: 'alreadySubmitted' });
        } else {
            // fetch response document 
            //throw utils.generateError({ configCode: 'alreadySubmitted' });--test
            let data1 = await respdb.view('forResponseDoc', 'quizIdUserIdToResponse1', { key: req.body.quizId + '-' + req.body.uname })
            // out(data1)
            if (data1.rows.length > 0) {
                // response doc for this quiz exists 
                let dta = data1.rows[0].value;
                if (dta.response) {
                    // THIS CODE SHOULD NEVER BE EXECTUTED - PLAIN QUIZ IS DISCONTINUED
                    // if (dta.response.length > 0) {
                    //     await utils.requestToQuizServer('submit_examineer_response', { 'quizid': req.body.quizId + '-' + req.body.uname, response: dta.response })
                    // } else {
                    //     let blankresponse = await generateBlankRespPlainQuiz(req.body.quizId, req.body.uname)
                    //     //out(blankresponse)
                    //     await utils.requestToQuizServer('submit_examineer_response', { 'quizid': req.body.quizId + '-' + req.body.uname, response: blankresponse })
                    // }
                    console.log("PLAIN QUIZ SUBMIT CODE EXECUTED, REJECTED" + JSON.stringify(req.body))
                    throw utils.generateError({ configCode: 'internalError' });
                    // submit old quiz
                    //await utils.requestToQuizServer('submit_examineer_response', { 'quizid': req.body.quizId + '-' + req.body.uname, response: dta.response })
                } else if (dta.sections) {
                    //submit sectional quiz
                    // new method to submit quiz 
                    if (dta.submitStatus) {
                        if (dta.submitStatus == "submitted") {
                            // this quiz is already submitted, waiting for quiz to be graded 
                            throw utils.generateError({ configCode: 'submissionInProcess' });
                        } else if (dta.submitStatus == "graded") {
                            throw utils.generateError({ configCode: 'alreadySubmitted' });
                        }
                    } else {
                        // new resp doc, to submit for grading add flag and submittedon date
                        let respDoc = await respdb.get(dta['docId']);
                        // console.log(respDoc);
                        respDoc['submitStatus'] = "submitted";
                        respDoc['submittedOn'] = utils.getCurrentDateInUTC()
                        await respdb.insert(respDoc)

                        if (req.body["submitReason"]) {
                            let msg = {
                                "autoDeadline": " (auto submitted, deadline over)",
                                "autoTimeup": " (auto submitted, time over)",
                                "manual": " ",
                                "appDeadline": " (deadline over)",
                                "appTimeup": " (time over)",
                            }
                            subMsg += msg[req.body["submitReason"]]
                        }

                    }
                    // await utils.requestToQuizServer('submit_sectioned_quiz', { regrade: false, 'quizid': req.body.quizId, 'userid': req.body.uname, responseSections: dta.sections })
                }
            } else {
                // resp obj does not exists , proceed with blank response 
                if (req.body.isSection) {
                    console.log("SECTIONAL QUIZ SUBMITTED WITHOUT RESP DOC,REJECTED" + JSON.stringify(req.body))
                    //await utils.requestToQuizServer('submit_sectioned_quiz', { regrade: false, 'quizid': req.body.quizId, 'userid': req.body.uname, responseSections: {} })
                } else {
                    console.log("PLAIN QUIZ SUBMIT CODE EXECUTED, REJECTED" + JSON.stringify(req.body))
                    //out("plain quiz, blank quiz from server")
                    //let blankresponse = await generateBlankRespPlainQuiz(req.body.quizId, req.body.uname)
                    //out(blankresponse)
                    //await utils.requestToQuizServer('submit_examineer_response', { 'quizid': req.body.quizId + '-' + req.body.uname, response: blankresponse })
                }
                throw utils.generateError({ configCode: 'internalError' });
            }
            await utils.dbLog({ uname: req.body.uname, quizId: req.body.quizId, priority: 1, message: subMsg, action: "submitted", useragent: req.useragent })
            res.success({ "message": "Quiz submitted. Redirect to quiz summary page." })
        }
    } catch (err) {
        res.error200(err)
    }
}
module.exports.submitQuiz = submitQuiz;


let generateSummaryData = async (uid, qid) => {
    try {
        let data = { tickets: [],summary: [], meta: {}, submission: {}, summObjs: {}, summaryGenerated: false }
        let cdata = await checkIfQuizAttempted(qid, uid);
        data.submission = JSON.parse(JSON.stringify(cdata))

        if (cdata.isAttempted) {
            if (cdata['respCheck']['submitExists'] == true) {
                if (cdata['respCheck']['submitStatus'] == 'graded') {
                    data['summaryGenerated'] = true;
                    let metadata = await metadb.get(qid);
                    data.meta = JSON.parse(JSON.stringify(metadata));

                    let examdata = await examdb.view('byQuizUser', 'quizIdUserIdToSummary', { key: qid + "-" + uid })
                    utils.checkLength(examdata.rows, 'exam404')
                    //out(examdata.rows)
                    let findSectionSummary = (key) => {
                        out(key)
                        findSect = (item) => {
                            return item.id == key
                        }
                        let s = examdata.rows.find(findSect)
                        return s.value;
                    }


                    var isSection = false;
                    if (data.meta.sections) {
                        if (data.meta.sections[0].hasOwnProperty('displayInstruction')) {
                            isSection = true;
                        }
                    }

                    //out(isSection)

                    let attempted = data.submission.sectionStarted
                    if (data.meta.sections) {
                        data.meta.sections.forEach((itm, idx) => {
                            let key;
                            let index = idx + 1
                            if (isSection) {
                                //out(key)
                                //out("8888888")
                                key = data.meta._id + '-' + uid + '-' + index
                            } else {
                                key = data.meta._id + '-' + uid
                            }
                            let summObj = JSON.parse(JSON.stringify(findSectionSummary(key)));
                            // out(summObj)
                            if (summObj) {
                                summObj['title'] = itm.title;
                                summObj['helpAllowed'] = itm.helpAllowed;
                                summObj['isAttempted'] = attempted[key];
                                if (itm.hasOwnProperty("partialGrading")) {
                                    summObj['partialGrading'] = itm["partialGrading"]
                                } else {
                                    summObj['partialGrading'] = false
                                }
                                data.summary.push(summObj)
                                data.summObjs[key] = summObj
                            }
                        })
                    } else {
                        let key = data.meta._id + '-' + uid
                        let summObj = JSON.parse(JSON.stringify(findSectionSummary(key)));
                        if (summObj) {
                            summObj['title'] = " ";
                            summObj['helpAllowed'] = data.meta.helpAllowed;
                            summObj['isAttempted'] = true;
                            data.summary.push(summObj)
                            data.summObjs[key] = summObj
                        }
                    }
                    data.userdata = data.meta.users.userData[uid]
                    data.userCol = data.meta.users.userCol;
                    if (!data.userdata) {
                        // in case of sample1,2,3 userdata does not exists
                        data.userdata = { "A": uid }
                    }
                    delete data.meta.users
                    delete data.meta.credentials;
                    delete data.meta.sections

                    // get tkts forResponseDoc/_view/quizIdUserIdToResponse1 uid, qid
                    let respDb12 = await  respdb.view("forResponseDoc","quizIdUserIdToResponse1",{key:qid+"-"+uid})
                    data.tickets = respDb12.rows[0].value.tickets
                    // console.log(JSON.stringify(respDb12,null,2))

                } else {
                    data['summaryGenerated'] = false;
                    // throw utils.generateError({ configCode: 'submissionInProcess' })
                }
            } else {
                data['summaryGenerated'] = true;
                let metadata = await metadb.get(qid);
                data.meta = JSON.parse(JSON.stringify(metadata));

                let examdata = await examdb.view('byQuizUser', 'quizIdUserIdToSummary', { key: qid + "-" + uid })
                utils.checkLength(examdata.rows, 'exam404')
                //out(examdata.rows)
                let findSectionSummary = (key) => {
                    out(key)
                    findSect = (item) => {
                        return item.id == key
                    }
                    let s = examdata.rows.find(findSect)
                    return s.value;
                }


                var isSection = false;
                if (data.meta.sections) {
                    if (data.meta.sections[0].hasOwnProperty('displayInstruction')) {
                        isSection = true;
                    }
                }

                //out(isSection)

                let attempted = data.submission.sectionStarted
                if (data.meta.sections) {
                    data.meta.sections.forEach((itm, idx) => {
                        let key;
                        let index = idx + 1
                        if (isSection) {
                            //out(key)
                            //out("8888888")
                            key = data.meta._id + '-' + uid + '-' + index
                        } else {
                            key = data.meta._id + '-' + uid
                        }
                        let summObj = JSON.parse(JSON.stringify(findSectionSummary(key)));
                        // out(summObj)
                        // console.log(summObj)
                        if (summObj) {
                            summObj['title'] = itm.title;
                            summObj['helpAllowed'] = itm.helpAllowed;
                            summObj['isAttempted'] = attempted[key];
                            if (itm.hasOwnProperty("partialGrading")) {
                                summObj['partialGrading'] = itm["partialGrading"]
                            } else {
                                summObj['partialGrading'] = false
                            }
                            data.summary.push(summObj)
                            data.summObjs[key] = summObj
                        }
                    })
                } else {
                    let key = data.meta._id + '-' + uid
                    let summObj = JSON.parse(JSON.stringify(findSectionSummary(key)));
                    if (summObj) {
                        summObj['title'] = " ";
                        summObj['helpAllowed'] = data.meta.helpAllowed;
                        summObj['isAttempted'] = true;
                        data.summary.push(summObj)
                        data.summObjs[key] = summObj
                    }
                }
                data.userdata = data.meta.users.userData[uid]
                data.userCol = data.meta.users.userCol;
                if (!data.userdata) {
                    // in case of sample1,2,3 userdata does not exists
                    data.userdata = { "A": uid }
                }
                delete data.meta.users
                delete data.meta.credentials;
                delete data.meta.sections

            }

            // console.log(JSON.stringify(data,null,2))
            //utils.saveFile({success:true,data:data},"pdfSummData_"+uid+"_"+qid) 
            return data
        } else {
            throw utils.generateError({ configCode: 'notSubmitted' })
        }
    } catch (err) {
        throw err
    }
}






let getQuizSummary = async (req, res, next) => {
    //will return quiz summary
    let metadata;
    let summary;

    try {
        await utils.inspectJSON(req.body, { requiredFields: ['quizId', 'uname'], validFields: ['quizId', 'uname', 'reqByAuthor'] })
        let metadbdata = await metadb.view('exam_meta', 'idToAdvanced', { key: req.body.quizId });
        utils.checkLength(metadbdata.rows, 'exam404')
        metadata = metadbdata.rows[0].value;
        // let viewData = await examdb.view('byQuizUser', 'quizIdUserIdToSummary', { key: req.body.quizId + '-' + req.body.uname })
        // utils.checkLength(viewData.rows, 'notSubmitted')
        // viewData.rows.map(itm => {
        //     if (itm.value) {
        //         summary[itm.id] = itm.value
        //     }
        // })
        let cdata = await generateSummaryData(req.body.uname, req.body.quizId);
        summary = cdata.summObjs;
        var alertMsg = '';
        var endDt = new Date(metadata.endTime.toString());
        let resObj = {};


        if (req.body.reqByAuthor) {
            let summaryStats = await plugins.sectionWiseSummary(req.body.quizId, req.body.uname) // TODO re position it to make i more otimized
            // res.json({  summary: summaryData, status: 'allow', scoreStatus: 'submission', reviewStatus: 'allowed' });
            
            cdata.tickets.map(tkt=>{
                let ky = req.body.quizId+"-"+req.body.uname+"-"+tkt["section"]
                if(tkt["resolved"]==false){
                    if(!summary[ky]["tickets"]){summary[ky]["tickets"] = 0}
                    summary[ky]["tickets"]++
                }
            })
            
            
            resObj = { summaryStats: summaryStats, summaryGenerated: cdata['summaryGenerated'], summary: summary, status: 'allow', metadata: metadata, scoreStatus: 'submission', reviewStatus: 'allowed' }
        } else {

            // TODO do not send summary when not required
            switch (metadata.score) {
                case 'submission':
                    let summaryStats = {}
                    if (cdata['summaryGenerated']) {
                        summaryStats = await plugins.sectionWiseSummary(req.body.quizId, req.body.uname) // TODO re position it to make i more otimized
                    }
                    resObj = { summaryGenerated: cdata['summaryGenerated'], summaryStats: summaryStats, summary: summary, status: 'allow', metadata: metadata, scoreStatus: metadata.score, reviewStatus: metadata.review }
                    break;
                case 'deadline':
                    var ct = new Date();
                    if (ct > endDt) {
                        let summaryStats = {}
                        if (cdata['summaryGenerated']) {
                            summaryStats = await plugins.sectionWiseSummary(req.body.quizId, req.body.uname) // TODO re position it to make i more otimized
                        }
                        resObj = { summaryGenerated: cdata['summaryGenerated'], summaryStats: summaryStats, summary: summary, metadata: metadata, status: 'allow', scoreStatus: metadata.score, reviewStatus: metadata.review }
                    } else {
                        alertMsg = 'You can check your performance summary after ' + endDt;
                        resObj = { summaryGenerated: cdata['summaryGenerated'], summary: summary, metadata: metadata, status: 'unallowed', alert: alertMsg, allowDate: endDt, scoreStatus: metadata.score, reviewStatus: metadata.review }
                    }
                    break;
                case 'unallowed':
                    alertMsg = 'Please contact quiz administrator for performance summary.';
                    resObj = { summaryGenerated: cdata['summaryGenerated'], summary: summary, metadata: metadata, status: 'unallowed', alert: alertMsg, scoreStatus: metadata.score, reviewStatus: metadata.review }
                    break;
            }

        }

        res.success(resObj)

    } catch (err) {
        res.error200(err)
    }
}
module.exports.getQuizSummary = getQuizSummary;

let quizReview = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, { requiredFields: ['quizId'], validFields: ['quizId', 'reqByAuthor'] })

        if (req.body.reqByAuthor) {
            // todo authenticate reqbyauthor
            out("reqbyauthr exists")
            return res.success({ status: "allowed", path: '/quiz-response' });
        } else {
            out("reqbyauthr does not exists")
        }


        let metadb1 = await metadb.view('exam_meta', 'idToAdvanced', { key: req.body.quizId })
        // let exammeta = await metadb.view('ByQuizApp','idToQuizMeta',{ key: req.body.quizId })
        utils.checkLength(metadb1.rows, 'exam404')
        let metadata = metadb1.rows[0].value;
        // metadata['calculator'] = exammeta.rows[0].value.calculator
        var ct = new Date();
        var endDt = new Date(metadata.endTime.toString());
        if (ct > endDt) {
            if (metadata.review == "allowed") {
                res.success({ status: "allowed", path: '/quiz-response' });
            } else if (metadata.review == "unallowed") {
                res.success({ status: "unallowed", msg: 'Review mode is not allowed.' });
            }
        } else {
            res.success({ endTime: metadata.endTime, caption: "caption_isReview", status: "unallowed", msg: 'You can check your review after ' + endDt });
        }
    } catch (err) {
        res.error200(err)
    }
}
module.exports.quizReview = quizReview




let quizLog = async (req, res, next) => {
    respdb.view('forTokenDoc', 'quizIdToLog', { key: req.body.quizId })
        .then(data => {
            res.success(data.rows)
        })
}
module.exports.quizLog = quizLog;

let quizResponse = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['examId'],
            validFields: ['examId', 'reqByAuthor']
        })

        let data = await examdb.get(req.body.examId)
        let resObj = {};

        // code to check if a quiz is submitted or not
        // a quiz is considered submitted when either attempted is true or when the submittedon field exists
        let attempted = false;
        if (data.attempted) {
            attempted = true;
        } else {
            if (data.submittedOn) {
                attempted = true;
            }
        }

        if (attempted == true) {
            let quizDetails = examIdToDetails(req.body.examId)
            resObj.quizData = data.quizdata;
            resObj.response = data.response;
            resObj.meta = data.meta;
            // resObj.rubrics = await plugins.getQuizRubrics(quizDetails.quizId)
            // to check if the author is viewing response
            let reqByAuthor = false;
            if (req.body.reqByAuthor) {reqByAuthor = true}

            let parts = req.body.examId.split("-")
            resObj['statistics'] = await plugins.getQuizAnalytics(parts[0], parts[1], parts[2])


            // additional response data
            let respDBKey = quizDetails.quizId + '-' + quizDetails.uname;
            let respDB = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { key: respDBKey })
            utils.checkLength(respDB.rows, 'exam404')
            let respDoc = respDB.rows[0].value;

            if (!respDoc['tickets']) { respDoc['tickets'] = [] }
            if (!respDoc['feedback']) { respDoc['feedback'] = [] }
            if (!respDoc['corrections']) { respDoc['corrections'] = [] }

            // tickets 
            let secTkt = respDoc['tickets'].filter(itm => { return itm["section"] == quizDetails.secId })
            secTkt.map(tkt => {
                let findQue = resObj.response.findIndex(it => { return it["ref"] == tkt["ref"] })
                let que = resObj.response[findQue];
                if (tkt["resolved"]) {
                    // if tkt is resolved
                    // check if syn is required
                    if (tkt.hasOwnProperty("scoreCorrection")) {
                        // sync required
                        //check if synced
                        // look for correction object 
                        let cObjIx = respDoc['corrections'].findIndex(itm => { return itm["section"] == quizDetails.secId && itm["ref"] == tkt["ref"] })
                        //console.log(cObjIx)
                        if (cObjIx > -1) {
                            if (respDoc['corrections'][cObjIx]["sync"]) {
                                //sync is done - display to both teacher 
                                tkt["note"] = "resolved-syncReq-synced-30minchecknotreq-showBoth"
                                resObj.response[findQue]["ticket"] = tkt
                            } else {
                                tkt["note"] = "resolved-syncReq-notSynced-showAuthorFull-showStudentfalse"
                                // sync not done
                                // display only to authors , not to students
                                if (reqByAuthor) {
                                    // the author will be able to see everything 
                                    tkt["authorOnly"] = true; // this will only be visisble to author
                                } else {
                                    tkt["resolved"] = false
                                    delete tkt["response"];
                                    delete tkt["resolvedOn"];
                                }
                                resObj.response[findQue]["ticket"] = tkt
                            }
                        } else {
                            console.log("errorr")
                        }
                    } else {
                        // sync not required
                        let resolvedDate = new Date(tkt["resolvedOn"]);
                        let showStudentDate = utils.addMinutesToUTCDate(resolvedDate, 30);
                        let current = new Date(utils.getCurrentDateInUTC());
                        //console.log(resolvedDate)
                        //console.log(showStudentDate)
                        //console.log(current)
                        //console.log(current > showStudentDate)
                        if (current > showStudentDate) {
                            // show to student 
                            tkt["note"] = "resolved-syncNotReq-30minPassed-showBoth"
                        } else {
                            // show to teacher with message that it will be availae in 30 min
                            tkt["note"] = "resolved-syncNotReq-30minNotPassed-showAuthor-showStudentFalse"
                            if (reqByAuthor) {
                                // the author will be able to see everything 
                                tkt["authorOnly"] = true; // this will only be visisble to author
                                tkt["studentVisibilityDate"] = showStudentDate;
                            } else {
                                tkt["resolved"] = false
                                delete tkt["response"];
                                delete tkt["resolvedOn"];
                            }
                        }
                        resObj.response[findQue]["ticket"] = tkt
                    }

                } else {
                    // tkt not resolved
                    // if the tkt is not yet resolved, show it as it is 
                    tkt["note"] = "notResolved-showBoth"
                    resObj.response[findQue]["ticket"] = tkt
                }
            })

            // feedback
            let fbTkt = respDoc['feedback'].filter(itm => { return itm["section"] == quizDetails.secId })
            fbTkt.map(fb => {
                let findQue = resObj.response.findIndex(it => { return it["ref"] == fb["ref"] })

                let rfbDate = new Date(fb["updatedOn"]);
                let showStudentDate = utils.addMinutesToUTCDate(rfbDate, 30);
                let current = new Date(utils.getCurrentDateInUTC());

                if (current > showStudentDate) {
                    // show to student
                    resObj.response[findQue]["feedback"] = fb
                } else {
                    // show to teacher with message that it will be availae in 30 min
                    if (reqByAuthor) {
                        // the author will be able to see everything 
                        fb["authorOnly"] = true; // this will only be visisble to author
                        resObj.response[findQue]["feedback"] = fb
                    }
                    //else{
                    //   resObj.response[findQue]["feedback"] = {"note":""}
                    //}
                }
                // else{// data stored in examineer_exam record ... show to everyone }
            })
            // corrections
            let crrs = respDoc['corrections'].filter(itm => { return itm["section"] == quizDetails.secId })
            crrs.map(cr => {
                let findQue = resObj.response.findIndex(it => { return it["ref"] == cr["ref"] })
                let que = resObj.response[findQue];

                // todo delete later : just to simulate correction exist
                // if (cr["sync"]) { que["correction"] = cr["correction"] }

                if (reqByAuthor) {
                    // the author will be able to see correctionReq 
                    cr["authorOnly"] = true; // this will only be visisble to author
                    resObj.response[findQue]["correctionReq"] = cr
                }
            })

            // adding adjustment score, grader remarks in subjective questions 
            // this needs to be done only when sub finalized is done 
            let metadbView = await metadb.view("byQuiz", "quizIdToMetaData", { key: quizDetails.quizId })
            let metaData;
            if (metadbView.rows.length > 0) {
                metaData = metadbView.rows[0].value
            } else {throw utils.generateError({ configCode: 'meta404' })}
            if(metaData.subFinalized){
                // if the quiz is finalized, read adjustment, rubrics, grder notes from ex_resp db  
                // also fetch rubrics values 
                let gradingView ,gradingDoc
                gradingView = await respdb.view("byQuizId","subGradingMeta",{key:quizDetails.quizId})
                gradingDoc = gradingView.rows[0].value
                // resObj["subGradingRubrics"] = gradingDoc["rubrics"]
                resObj.response.map(question=>{
                    if(question.lock && question.type=="sub"){
                        let subData = respDoc['subScores'].find(itm=>{return itm['ref']==question['ref']&& itm["section"] == quizDetails.secId })
                        question["grader"] = {}
                        question["grader"]["rubrics"]= subData["rubrics"]
                        question["grader"]["adjustment"]= subData["adjustment"]
                        question["grader"]["note"]= subData["graderNote"]
                        question["grader"]["queRubrics"] = gradingDoc["rubrics"][question['ref']] ? gradingDoc["rubrics"][question['ref']] :  {"adjEnabled": true,"editable": false,"rules": []}
                    }
                })
                
            }
            let logObj = {
                authorLogin: reqByAuthor,
                quizId: quizDetails.quizId,
                uname: quizDetails.uname,
                action: "view_response",
                message: quizDetails.isSection ? "Reviewed Section " + quizDetails.secId + " " : "Reviewed quiz",
                prioirty: 2,
                useragent: req.useragent
            }
            await utils.dbLog(logObj)


            res.success(resObj)
        } else {
            throw utils.generateError({ configCode: 'notSubmitted' })
        }

    } catch (err) {
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}

module.exports.quizResponse = quizResponse

let ping = (req, res, next) => {
    //out(req.body)
    res.success({ message: "Token is valid" })
}
module.exports.ping = ping

let logonreload = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['uname', 'quizId', 'message'],
            validFields: ['uname', 'quizId', 'message']
        })
        let msg = " "
        let action = "logged_out"
        let reqmsg = req.body['message'];
        if (reqmsg) {
            switch (reqmsg) {
                case 'loggedOut':
                    msg = " "
                    break;
                case 'loggedOutSessionExpired':
                    msg = " (Session expired) "
                    action = "logged_out_sessionExpired"
                    break;
                case 'windowChanged':
                    msg = " (switched to different window)"
                    break;
                case 'windowClosed':
                    msg = " (window closed)"
                    break;
                case 'reload':
                    msg = " (window reloaded)"
                    break;
                case 'serverErr':
                    msg = " (Server error)"
                    break;
                case 'appPaused':
                    msg = " (App minimized)"
                    break;
                default:
                    break;
            }
        }

        let authorLogin = false;
        if (req.body.reqByAuthor) {
            if (req.body.reqByAuthor[0] == true) {
                authorLogin = true;
            }
        }



        await utils.dbLog({ uname: req.body.uname, quizId: req.body.quizId, action: action, message: "Logged out " + msg, prioirty: 2, useragent: req.useragent, authorLogin: authorLogin })
        res.success({ message: "Log out recorded" })

    } catch (err) {
        res.error200(err)
    }
}
module.exports.logonreload = logonreload

exportSummary = async (req, res, next) => {
    let type = req.params.type;
    let uid = req.body.uname;
    let qid = req.body.quizId;
    try {
        await utils.inspectJSON(req.body, { requiredFields: ['quizId', 'uname'], validFields: ['quizId', 'uname', 'email', 'reqByAuthor'] })
        let data = await generateSummaryData(uid, qid)

        // out(data);
        let pdfbf = await pdfsumm.generatePdfSummary(data)

        // reqby author check
        let reqByAuthor = false;
        if (req.body.reqByAuthor) {
            reqByAuthor = true;
        }


        if (type == 'pdf') {
            await utils.dbLog({ uname: uid, quizId: qid, action: "down_summ", priority: 3, message: "Downloaded quiz summary ", useragent: req.useragent, authorLogin: reqByAuthor })
            //  quizId, uname , action, useragent
            /// out(pdfbf)
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Length': pdfbf.length
            });
            res.end(pdfbf);
        } else {
            var data1 = {
                summary_file: pdfbf.toString('base64'),
                email: req.body.email,
                quizId: qid,
                token: await config.get("mailServerAuth")
            };
            var options = {
                uri: await config.get("mailServer"),
                method: 'POST',
                json: true,
                body: data1
            }
            let emailreq = await request(options);
            await utils.dbLog({ uname: uid, priority: 3, quizId: qid, action: "email_summ", message: "Email summary sent to email: " + req.body.email, useragent: req.useragent, authorLogin: reqByAuthor })
            res.success({ message: "Email sent" })
        }
    } catch (err) {
        console.log(err)
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}
module.exports.exportSummary = exportSummary;


let studentResetLoginCounter = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, { srequiredFields: ['uname', 'quizId', 'token'], acceptBlank: false, validFields: ['uname', 'quizId', 'token'] })
        let tkdb = await respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: req.body.quizId + '-' + req.body.uname })
        utils.checkLength(tkdb.rows, 'exam404')
        let tdoc = JSON.parse(JSON.stringify(tkdb.rows[0].value));
        if (tdoc.failedLogin >= 10) {
            // still locked
            if (tdoc.resetEmailToken) {
                if (tdoc.resetEmailToken == req.body.token) {
                    tdoc['failedLogin'] = 0;
                    tdoc['token'] = utils.generateToken();
                    delete tdoc['resetEmailToken'];
                    delete tdoc['resetEmailDate'];
                    await respdb.insert(tdoc)
                    await utils.dbLog({ uname: req.body.uname, priority: 1, quizId: req.body.quizId, action: "account_unlocked", message: "Account unlocked", useragent: req.useragent })

                    res.success({ 'message': 'Account unlocked' })
                } else {
                    throw utils.generateError({ configCode: 'unauthReq' });
                }
            } else {
                throw utils.generateError({ configCode: 'unauthReq' });
            }
        } else {
            throw utils.generateError({ configCode: 'tokenAlreadyReset' });
        }
    } catch (error) {
        res.error200(error)
    }
}
module.exports.studentResetLoginCounter = studentResetLoginCounter

let captchaCheck = async (captcha, remoteip) => {
    try {


        // // Verify URL
        const query = JSON.stringify({
            secret: await config.get('googleCaptchaSecret'),
            response: captcha,
            remoteip: remoteip
        });
        const verifyURL = `https://google.com/recaptcha/api/siteverify?${query}`;


        let reqBody = {
            url: verifyURL,
            timeout: 25000,
            method: "GET",
            json: true
        };
        let gResp = await request(reqBody);
        // console.log(gResp)
        if (gResp.success !== undefined && !gResp.success) {
            throw utils.generateError({ configCode: 'captchaFalse' })
        }
        return
    } catch (error) {
        throw error
    }
}

let sendLoginCredentials = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, { requiredFields: ['user', 'quizId', 'captcha'], acceptBlank: false, validFields: ['user', 'quizId', 'captcha'] })

        // check captcha 
        await captchaCheck(req.body['captcha'], req.connection.remoteAddress)

        let input = { quizId: req.body.quizId, user: req.body.user }
        let quizDoc = await metadb.get(input.quizId)

        if (quizDoc.author == 'unknown') {
            throw utils.generateError({ configCode: 'meta404' })
        }

        if (quizDoc.status != 'active') {
            throw utils.generateError({ configCode: 'inact' })
        }

        // if (!quizDoc['credentials'][input.user]) {
        //     throw utils.generateError({ configCode: 'meta404' })
        // } 



        // var today = new Date();
        // var beginDate = new Date(quizDoc.beginTime);
        // var endDate = new Date(quizDoc.endTime);
        // if (today > endDate) {
        //    throw utils.generateError({ configCode: 'afterDeadline' }) 
        // }

        if (quizDoc.users.sendEmail == false) {
            throw utils.generateError({ configCode: 'sendEmailFalse' })
        }

        // if sendEmail option is set to true , find and generate an array of username and email id

        let uObjs = []
        Object.keys(quizDoc.users.userData).map(ky => {
            let user = {
                user: ky,
                email: quizDoc.users.userData[ky][quizDoc.users['emailCol']]
            }
            uObjs.push(user)
        })
        // console.log(uObjs)

        // first 
        let foundUser;
        let findByUser = uObjs.find(itm => { return itm['user'] == input['user'] })
        if (!findByUser) {
            //console.log("not found by user")
            let findByEmail = uObjs.find(itm => { return itm['email'].toLowerCase() == input['user'].toLowerCase() })
            if (!findByEmail) {
                //console.log("not found by email")
                throw utils.generateError({ configCode: 'meta404_1' })
            } else {
                foundUser = findByEmail;
            }
        } else {
            foundUser = findByUser;
        }

        if (!foundUser) {
            throw utils.generateError({ configCode: 'meta404_1' })
        }

        let convertDateToTimeZone = (date,timeZoneFromDB) => {
            var targetTime = new Date(date);
            var tzDifference = timeZoneFromDB * 60 + targetTime.getTimezoneOffset();
            var offsetTime = new Date(targetTime.getTime() + tzDifference * 60 * 1000);
            var convrtString = offsetTime.toString();
            var showDate = convrtString.slice(4, 25);
            return showDate;
        }
        let convertToTz = (i) => {
            let integerPart = Math.abs(parseInt(i));
            let decimalPart = Math.abs(parseFloat(i));
            let seconds = (decimalPart - integerPart) * 60;
            let part2 = seconds;
            if (seconds < 10) {part2 = "0" + seconds;}
            let part1 = parseInt(i);
            let sign = (part1 < 0) ? "-" : "+"
            let hour = integerPart;
            if (integerPart <= 10) {hour = "0" + integerPart}
            let str = "GMT" + sign + hour + part2
            return str;
        }

        var localTimeZone = convertToTz(quizDoc['timeZone']);
        var localStartDate = convertDateToTimeZone( quizDoc['beginTime'],quizDoc['timeZone'])  ;
        var localEndDate = convertDateToTimeZone(quizDoc['endTime'],quizDoc['timeZone']) 

        let emailData = {
            authorName: quizDoc['authorName'],
            authorEmail: quizDoc['authorEmail'],
            quizTitle: quizDoc['title'],
            beginTime: quizDoc['beginTime'],
            localStartDate: localStartDate+localTimeZone,
            localEndDate:localEndDate+localTimeZone,
            endTime: quizDoc['endTime'],
            duration: quizDoc['duration'],
            quizId: quizDoc['_id'],
            quizUser: foundUser['user'],
            quizPwd: quizDoc['credentials'][foundUser.user],
            timeZone: quizDoc['timeZone']
        }

        let userEmail = foundUser['email']// quizDoc.users.userData[foundUser.user][quizDoc.users['emailCol']]

        let msg = await utils.composeMail("quizSendCredentials", emailData)

        await utils.requestToQuizServer('send_mail', { to: userEmail, sub: msg.subject, body: msg.body })
        await utils.dbLog({ uname: foundUser['user'], quizId: quizDoc['_id'], message: "Credentials sent to email", action: "credentials_sent", priority: 2, useragent: req.useragent })

        let smsg = await config.getInner("configMessage", "credentials_sent")

        let protect_email = function (user_email) {
            var avg, splitted, part1, part2;
            splitted = user_email.split("@");
            part1 = splitted[0];
            part2 = splitted[1]
            avg1 = part1.length / 2;
            avg2 = part2.length / 2;
            part1 = part1.substring(0, (part1.length - avg1));
            part2 = part2.substring(0, (part2.length - avg2))
            return part1 + "...@" + part2 + "...";
        };

        smsg['email'] = protect_email(userEmail)

        res.success(smsg)

    } catch (err) {
        console.log(err)
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}
module.exports.sendLoginCredentials = sendLoginCredentials

let raiseTicket = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['examId', 'ref', 'issue'],
            acceptBlank: false,
            validFields: ['examId', 'ref', 'issue', 'index']
        })

        let input = { index: req.body.index, examId: req.body.examId, ref: req.body.ref, issue: req.body.issue }
        if (input['issue'].length>1000) {throw utils.generateError({ "code":"msg_tktLength","type":"danger" })}

        let quizDetails = examIdToDetails(input.examId)
        //   {isSection,quizId,uname,secId}

        let exMetaRec = await metadb.view("byQuiz","quizIdToMetaData",{key:quizDetails.quizId}) 
        let ex = exMetaRec.rows[0].value
        let maxTkts = Math.max(ex.nQue*0.10,3) // max(10% of number of questions in the quiz , 3)
        // console.log(maxTkts)
        let quizStatus = await checkIfQuizAttempted(quizDetails.quizId, quizDetails.uname)

        if (quizStatus.isAttempted) {
            // fetch response doc
            let respDBKey = quizDetails.quizId + '-' + quizDetails.uname
            // quizDetails.quizId, quizDetails.uname
            let respDB = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { key: respDBKey })
            utils.checkLength(respDB.rows, 'exam404')
            let respDoc = respDB.rows[0].value;

            if(!respDoc["quizType"]){
                if (respDoc['submitStatus'] != "graded") {throw utils.generateError({ configCode: 'notSubmitted' })}
            }
            

            let searchRef
            if(respDoc.hasOwnProperty("quizType")&&respDoc["quizType"]=="live"){
                searchRef = respDoc["sections"][quizDetails["secId"]].find(it => { return it["ref"] == input["ref"] })
            }else{
                searchRef = respDoc["sections"][quizDetails["secId"]]["response"].find(it => { return it["ref"] == input["ref"] })
            }

            if (!searchRef) { throw utils.generateError({ configCode: 'queNotFound' }) }
            if(searchRef["type"]=="info"){throw utils.generateError({ "code":"msg_infoTicket","type":"danger" })}
            
            if (respDoc.hasOwnProperty("tickets") == false) { respDoc["tickets"] = [] }

            if(respDoc["tickets"].length >= maxTkts){throw utils.generateError({ "code":"msg_maxTicket","type":"danger",maxTickets:maxTkts })}

            let searchTicket = respDoc["tickets"].find(itm => {
                return itm["ref"] == input["ref"] && itm["section"] == quizDetails["secId"]
            })

            if (!searchTicket) {
                let blankTicket = {
                    ref: input["ref"],
                    section: quizDetails["secId"],
                    issue: input["issue"],
                    resolved: false,
                    raisedOn: utils.unixTime()
                }
                respDoc["tickets"].push(blankTicket)
                await respdb.insert(respDoc);
                res.success({ index: input.index, message: "Ticket raised", ticket: blankTicket })

            } else {throw utils.generateError({ configCode: 'ticketAlreadyRaised' })}
        } else {throw utils.generateError({ configCode: 'notSubmitted' })}
    } catch (err) {
        // console.log(err)
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {res.error200(err)}
    }
}
module.exports.raiseTicket = raiseTicket

let validateCorrection = (val,gm)=>{
    let getMax = (a)=>{return Math.max(...a.map(e => Array.isArray(e) ? getMax(e) : e));}
    let getMin = (a)=>{return Math.min(...a.map(e => Array.isArray(e) ? getMin(e) : e));}
    
    let absMax =  getMax(gm)
    let absMin = getMin(gm)
    if(absMin <= val && val  <= absMax){return true}
    else{throw utils.generateError({ configCode: 'invalidScore' })}
}


let resolveTicket = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['examId', 'ref', 'response', 'reqByAuthor'],
            acceptBlank: false,
            validFields: ['examId', 'ref', 'response', 'reqByAuthor', 'scoreCorrection', 'correction', 'index']
        })
        let input = { 
            index: req.body.index, 
            examId: req.body.examId, 
            ref: req.body.ref, 
            response: req.body.response, 
            scoreCorrection: req.body.scoreCorrection, 
            correction: req.body.correction 
        }
        let quizDetails = examIdToDetails(input.examId)
        // //   {isSection,quizId,uname,secId}
        let quizStatus = await checkIfQuizAttempted(quizDetails.quizId, quizDetails.uname)
        if (quizStatus.isAttempted) {
            let respDBKey = quizDetails.quizId + '-' + quizDetails.uname;
            let respDB = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { key: respDBKey })
            utils.checkLength(respDB.rows, 'exam404')
            let respDoc = respDB.rows[0].value;
            if(!respDoc["quizType"]){
                if (respDoc['submitStatus'] != "graded") {throw utils.generateError({ configCode: 'notSubmitted' })}
            }
            if (respDoc.hasOwnProperty("tickets") == false) { respDoc["tickets"] = [] }
            let searchTicket = respDoc["tickets"].findIndex(itm => {
                return itm["ref"] == input["ref"] && itm["section"] == quizDetails["secId"]
            })

            if (searchTicket > -1) {
                let itm = respDoc["tickets"][searchTicket]
                if (itm.hasOwnProperty("resolved")) {
                    if (itm["resolved"] == true) {
                        throw utils.generateError({ configCode: 'ticketAlreadyResolved' });
                    }
                }
                let dt = utils.unixTime();
                let scCorr = false
                let corrObj;
                if (input.scoreCorrection) {
                    scCorr = true;
                    respDoc["tickets"][searchTicket]["scoreCorrection"] = true;

                    if (respDoc.hasOwnProperty("corrections") == false) { respDoc["corrections"] = [] }
                    //  to see if correction already exists 
                    let searchCorrection = respDoc["corrections"].findIndex(itm => {
                        return itm["ref"] == input["ref"] && itm["section"] == quizDetails["secId"]
                    })
                    if (searchCorrection > -1) {
                        // update text
                        respDoc["corrections"][searchCorrection]["correction"] = input.correction;
                        respDoc["corrections"][searchCorrection]["correctedOn"] = dt;
                        respDoc["corrections"][searchCorrection]["note"] = "tkt_res_with_corr"

                        // if sync flag exists or is set to true, delete it to resync
                        if (respDoc["corrections"][searchCorrection].hasOwnProperty("sync")) {
                            delete respDoc["corrections"][searchCorrection]["sync"]
                        }
                        corrObj = respDoc["corrections"][searchCorrection];
                    } else {
                        let newCorrection = {
                            ref: input["ref"],
                            section: quizDetails["secId"],
                            correction: input["correction"],
                            correctedOn: dt,
                            note: "tkt_res_with_corr"
                        }
                        corrObj = newCorrection
                        respDoc["corrections"].push(newCorrection)
                    }
                }
                respDoc["tickets"][searchTicket]["resolved"] = true;
                respDoc["tickets"][searchTicket]["resolvedOn"] = dt;
                respDoc["tickets"][searchTicket]["response"] = input.response;
                await respdb.insert(respDoc);
                let retObj = { index: input.index, message: "Ticket resolved", ticket: respDoc["tickets"][searchTicket] }
                if (scCorr) {
                    retObj["correctionReq"] = corrObj
                }
                res.success(retObj)
            } else {
                throw utils.generateError({ configCode: 'ticketNotFound' });
            }
        } else {
            // quiz not yet submitted 
            throw utils.generateError({ configCode: 'notSubmitted' });
        }
    } catch (err) {
        // console.log(err)
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}
module.exports.resolveTicket = resolveTicket

// TODO reqby author required
let queFeedback = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['examId', 'ref', 'reqByAuthor'],
            acceptBlank: false,
            validFields: ['examId', 'ref', 'text', 'reqByAuthor']
        })
        let input = { index: req.body.index, examId: req.body.examId, ref: req.body.ref, text: req.body.text ? req.body.text : '' }
        let quizDetails = examIdToDetails(input.examId)
        // //   {isSection,quizId,uname,secId}
        let quizStatus = await checkIfQuizAttempted(quizDetails.quizId, quizDetails.uname)
        if (quizStatus.isAttempted) {
            let respDBKey = quizDetails.quizId + '-' + quizDetails.uname;
            let respDB = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { key: respDBKey })
            utils.checkLength(respDB.rows, 'exam404')
            let respDoc = respDB.rows[0].value;
            if(!respDoc["quizType"]){
                if (respDoc['submitStatus'] != "graded") {throw utils.generateError({ configCode: 'notSubmitted' })}
            }
            let searchRef
            if(respDoc.hasOwnProperty("quizType")&&respDoc["quizType"]=="live"){
                searchRef = respDoc["sections"][quizDetails["secId"]].find(it => { return it["ref"] == input["ref"] })
            }else{
                searchRef = respDoc["sections"][quizDetails["secId"]]["response"].find(it => { return it["ref"] == input["ref"] })
            }
            if (!searchRef) { throw utils.generateError({ configCode: 'queNotFound' }); }        
            if (respDoc.hasOwnProperty("feedback") == false) { respDoc["feedback"] = [] }
            let searchFeedback = respDoc["feedback"].findIndex(itm => {
                return itm["ref"] == input["ref"] && itm["section"] == quizDetails["secId"]
            })
            if (searchFeedback > -1) {
                // update text
                let itm = respDoc["feedback"][searchFeedback]
                respDoc["feedback"][searchFeedback]["text"] = input.text;
                respDoc["feedback"][searchFeedback]["updatedOn"] = utils.unixTime();
                await respdb.insert(respDoc);
                res.success({ message: "Feedback updated", feedback: itm })
            } else {
                let newFeedBack = {
                    ref: input["ref"],
                    section: quizDetails["secId"],
                    text: input["text"],
                    updatedOn: utils.unixTime()
                }
                respDoc["feedback"].push(newFeedBack)
                await respdb.insert(respDoc);
                res.success({ message: "Feedback added", feedback: newFeedBack })
                // add new feedback
                // throw utils.generateError({ configCode: 'ticketNotFound' });
            }
        } else {
            // quiz not yet submitted 
            throw utils.generateError({ configCode: 'notSubmitted' });
        }
    } catch (err) {
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}
module.exports.queFeedback = queFeedback

// TODO reqby author required
// TODO  validate correction
let queCorrection = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['examId', 'ref', 'correction', 'reqByAuthor'],
            acceptBlank: false,
            validFields: ['examId', 'ref', 'correction', 'reqByAuthor', 'index']
        })
        let input = { index: req.body.index, examId: req.body.examId, ref: req.body.ref, correction: req.body.correction }
        let quizDetails = examIdToDetails(input.examId)
        // //   {isSection,quizId,uname,secId}
        let quizStatus = await checkIfQuizAttempted(quizDetails.quizId, quizDetails.uname)
        if (quizStatus.isAttempted) {
            let respDBKey = quizDetails.quizId + '-' + quizDetails.uname;
            let respDB = await respdb.view('forResponseDoc', 'quizIdUserIdToDoc1', { key: respDBKey })
            utils.checkLength(respDB.rows, 'exam404')
            let respDoc = respDB.rows[0].value;
            if(!respDoc["quizType"]){
                if (respDoc['submitStatus'] != "graded") {throw utils.generateError({ configCode: 'notSubmitted' })}
            }
            let searchRef
            if(respDoc.hasOwnProperty("quizType")&&respDoc["quizType"]=="live"){
                searchRef = respDoc["sections"][quizDetails["secId"]].find(it => { return it["ref"] == input["ref"] })
            }else{
                searchRef = respDoc["sections"][quizDetails["secId"]]["response"].find(it => { return it["ref"] == input["ref"] })
            }
            if (!searchRef) { throw utils.generateError({ configCode: 'queNotFound' }); }
            if (respDoc.hasOwnProperty("corrections") == false) { respDoc["corrections"] = [] }
            let searchCorrection = respDoc["corrections"].findIndex(itm => {
                return itm["ref"] == input["ref"] && itm["section"] == quizDetails["secId"]
            })
            let msg, obj;
            if (searchCorrection > -1) {
                // update text
                let itm = respDoc["corrections"][searchCorrection]
                respDoc["corrections"][searchCorrection]["correction"] = input.correction;
                respDoc["corrections"][searchCorrection]["correctedOn"] = utils.unixTime();
                respDoc["corrections"][searchCorrection]["note"] = "manual";

                if (respDoc["corrections"][searchCorrection].hasOwnProperty("sync")) {
                    delete respDoc["corrections"][searchCorrection]["sync"]
                }

                msg = "Correction updated"
                obj = itm
            } else {
                let newCorrection = {
                    ref: input["ref"],
                    section: quizDetails["secId"],
                    correction: input["correction"],
                    correctedOn: utils.unixTime(),
                    note: "manual"
                }
                respDoc["corrections"].push(newCorrection)
                msg = "Correction added"
                obj = newCorrection
                // add new 
                // throw utils.generateError({ configCode: 'ticketNotFound' });
            }
            await respdb.insert(respDoc);
            res.success({ message: msg, correctionReq: obj, index: input.index })
        } else {
            // quiz not yet submitted 
            throw utils.generateError({ configCode: 'notSubmitted' });
        }
    } catch (err) {
        if (err.statusCode == 404) {
            res.error200(utils.generateError({ configCode: 'exam404' }));
        } else {
            res.error200(err)
        }
    }
}
module.exports.queCorrection = queCorrection