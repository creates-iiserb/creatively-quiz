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

let index = async (req, res, next) => {
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
                var submittedOn = data.rows[0].value.submittedOn;
                var quizIds = [];
                var secObj = {}
                data.rows.forEach(doc => {
                    var value = doc.value;
                    var isStartedSec = false;
                    var secAttempted = false;
                    if (value.attempted == true) {
                        // attempted exists means the section is submitted
                        secAttempted = true;
                    } else {
                        // if the value of submittedon exists, the section was not attempted but the quiz was still submitted for grading
                        //  whenever a quiz is graded, all sections will have the same submittedOn timestamp.
                        //  attempted flag for a section tells us whether the responses for that section exists or not which in turn means that whether the user opened that section or not
                        if (value.submittedOn) {
                            secAttempted = true;
                        }
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
                let respCheck = {
                    submitStatus: "not_submitted",
                    isSubmitted: false,
                    submitExists: false
                }

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
                resolve({ respCheck: respCheck, sectionStarted: secObj, started: startedOn, submitted: submittedOn, isAttempted: attempted, quizIds: quizIds, isStarted: isStarted, startedOn: startDate })

            } else {
                reject(utils.generateError({ configCode: 'exam404' }));
            }
        } catch (error) {
            reject(error)
        }
    })
}


let login = async (req, res, next) => {
    try {
        await utils.inspectJSON(req.body, {
            requiredFields: ['quizId', 'uname', 'pwd'],
            validFields: ['quizId', 'uname', 'pwd', 'reqByAuthor']
        })

        let authorLogin = false;

        if (req.body.reqByAuthor) {
            if (req.body.reqByAuthor[0] == true) {
                // todo validate reqbyauthor
                authorLogin = true;
                //let reqCookie = req.body.reqByAuthor[2] + ":" + req.body.reqByAuthor[1];
                //res.cookie('reqByAuthor', reqCookie, config.get('reqByAuthorCookie'));
            }
        }
        let examData = {};  // will contain data fetched from  exam_exam
        let metaData = {} // will contain data  fetched form exam_meta
        let usrTkn;
        let input = {
            quiz: req.body.quizId,
            user: req.body.uname,
            password: req.body.pwd
        }
        // check if password matches 
        // credential are stored in examineer_metadata quiz record

        let quizMetaCheck = await metadb.get(input.quiz)

        //pre check
        if(quizMetaCheck['security']=='chromeOnly'){
            // check useragent&appagent header, allowed - 
            // req.useragent
            let isChromeCheck =  req.useragent['isChrome'] == true;
            let isDesktopCheck = req.useragent['isDesktop'] == true;
            //let isTabletCheck = req.useragent['isTablet'] == true;
            //let check = isChromeCheck && (isDesktopCheck || isTabletCheck );
            let check = isChromeCheck && isDesktopCheck;
            if(check==false){
                throw utils.generateError({ configCode: 'chromeOnly' })
            }
        }

        if (quizMetaCheck.author == 'unknown') {
            throw utils.generateError({ configCode: 'meta404' })
        }

        if (quizMetaCheck.status != 'active') {
            let code = await config.getInner('configMessage', 'inact')
            if (!req.body.reqByAuthor) {
                throw utils.generateError({ configCode: 'inact' })
            }
        }

        if (!quizMetaCheck['credentials'][input.user]) {
            throw utils.generateError({ configCode: 'meta404' })
        }

        let metaDBData = await metadb.view('byQuizUser', 'authentication', { key: [input.quiz, input.user, input.password] })
        let loginAttemptSuccessful = false;

        if (metaDBData.rows.length > 0) {
            // record with given quizid, uname and password exists => password matched
            loginAttemptSuccessful = true;
            // store quiz metadata
            metaData = metaDBData.rows[0].value
        }

        let tokenData = await addOrModifyRespTokenDoc({
            loginAttemptSuccessful: loginAttemptSuccessful,
            user: input.user,
            quiz: input.quiz,
            uname: input.user,
            quizId: input.quiz,
            useragent: req.useragent,
            authorLogin: authorLogin,
            beginTime: quizMetaCheck.beginTime,
            endTime: quizMetaCheck.endTime
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
            if (metaData.status != 'active') {
                let code = await config.getInner('configMessage', 'inact')
                // res.error200(code)
                //throw utils.generateError()
                if (!req.body.reqByAuthor) {
                    // if req.body.reqByAuthor exists , author is trying to login from authoring(manage quiz)
                    throw utils.generateError({ configCode: 'inact' })
                }
            }

            let allowFC = false;
            if (quizMetaCheck.hasOwnProperty('allowFC')) {
                allowFC = quizMetaCheck['allowFC'];
            }

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
                quizType: quizMetaCheck['quizType'] || "sectioned",
                allowFC: allowFC,
                allowStats: metaData['allowStats']
            }

            if (metaData['userData']) {
                responseData['userData'] = metaData['userData']
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
        let author = { send: false, email: '', body: '', logMsg: '' };
        let student = { send: false, email: '', body: '', logMsg: {} }
        if (quizData.sendMail) {
            //onsole.log(quizData.users)
            // get email if student 
            let userCol = quizData['users']['userCol']
            let emailCol = quizData['users']['emailCol']
            if(quizData['users']['userData'][options.uname]){
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
                    student.body = `
            <p> Dear user <br>
                You have reached the maximum attempts to log in the quiz ${options.quiz}. Your quiz is locked. </p> <p> Click <a href="${link}">here</a> to unlock your account.</p> `

                    student.logMsg = { action: 'reset_email_sent', priority: 1, message: 'Instructions to reset password sent to email :' + student.email, quizId: options.quiz, uname: options.uname }
                }
            }
        }
        // fetch email of author
        // send email to author with reset instructions
        if (quizData.authorEmail) {
            author.send = true;
            author.email = quizData.authorEmail;
            author.body = `
             <p>   Dear ${quizData.authorName} , <br>
                The user : <b>${options.uname}</b> has reached the maximum login attempt limit and cannot log in the quiz : <b>${options.quiz}</b>.</p>
                `
            if (student.email) {
                author.body += `<p>We have already sent an email to the user at ${student.email} with a link to unlock the account. You can also unlock the user </p> `
            }

            author.body += ` <br> <p>To unlock the user, go to the quiz dashboard of the quiz ${options.quiz}. Click on  'Manage quiz' button. A new page will open. Search for the user : "${options.uname}" and click on the unlock button. Please note that by doing this the data of this student will not be lost.</p>  `
            author.logMsg = { action: 'reset_email_sent', priority: 1, message: 'Instructions to reset password sent to email :' + author.email, quizId: options.quiz, uname: options.uname }

        }

        if (author.send) {
            await utils.dbLog(author.logMsg)
            utils.requestToQuizServer('send_mail', { to: author.email, sub: "Unlock quiz", body: await config.get("emailHead")+ author.body + await config.get("emailTail")})
        }

        if (student.send) {
            await utils.dbLog(student.logMsg)
            utils.requestToQuizServer('send_mail', { to: student.email, sub: "Unlock quiz", body: await config.get("emailHead")+ student.body+ await config.get("emailTail") })
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
            out("token fun....................................")
            let maxFailedLoginAttempts = await  config.get('maxFailedLoginAttempts')
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
                if (newIdDetails._rev) {
                    // if old id is being reused, you also need the rev id
                    tokenDoc1._rev = newIdDetails._rev;
                }

                out("will create new token doc id = " + newIdDetails._id)
            } else {
                // token doc exists
                let existingTokenData = tokenDBDoc.rows[0].value;
                if (!existingTokenData.log) {
                    existingTokenData.log = []
                }
                existingTokenData['token'] = utils.generateToken()
                tokenDoc1 = existingTokenData
                out("token doc exists id = " + tokenDoc1['_id'])
                if (tokenDoc1['failedLogin'] >= maxFailedLoginAttempts) {
                     // console.log("falied limit exceeded")
                     if (options.authorLogin==false) {
                         //  to block the student to send login request after more than 11 incorrect attempts
                         //  after 11 aattempts , request will be rejected and not logged
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
                // quiz deadline is over
                // check if response doc for that quiz exists
                // if not , login not allowed
                let qRes = await respdb.view('forResponseDoc', 'quizIdUserIdToResponse1', { key: options.quiz + '-' + options.uname })
                let cAttempt = await checkIfQuizAttempted(options.quiz, options.user)
                if (cAttempt.isStarted == false) {
                    // quiz not started
                    dlLoginNotAllowed = true; // login not allowed
                    if (options.authorLogin == true) {
                        // author logging in
                        if (cAttempt.isAttempted == true) {
                            dlLoginNotAllowed = false;
                        }
                    }
                }
            }

            out("deadline not allowed flag " + dlLoginNotAllowed)

            let lobj;
            let sendEmailLink =false; // to send email to student  with a link to unlock account 

            if (options.loginAttemptSuccessful) {
                // login success

                out("login attempte successful ")
                let accBlocked = false; // flag, set if  account is blocked
                if (tokenDoc1['failedLogin'] < maxFailedLoginAttempts) {
                    accBlocked = false;
                } else {
                    accBlocked = true;
                }

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
                        lobj = utils.generateLogObject({ action: "logged_in", priority: 2, message: "Logged in", useragent: options.useragent, authorLogin: options.authorLogin })
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

            if (dlLoginNotAllowed) {
                // if the quiz deadline is over then only deadline over message will be emmited
                // logging in after deadline is over
                out("logging in after deadline... rejected")
                lobj = utils.generateLogObject({ action: "logged_in_blocked3", priority: 1, message: "Login request rejected. Deadline over", useragent: options.useragent, authorLogin: options.authorLogin })
            }

            out("final falidLogin = " + tokenDoc1.failedLogin)
            tokenDoc1.log.push(lobj)
            await respdb.insert(tokenDoc1)
            await utils.emitEvent(options.quiz, options.user, lobj)

            if(sendEmailLink){
               await  logFailedAttempt(options);
            }
            if (dlLoginNotAllowed) {
                out("...rejecting")
                reject(utils.generateError({ configCode: 'afterDeadline' }))
            } else {
                if (tokenDoc1.failedLogin >= maxFailedLoginAttempts) {
                    // allow the author to login even after max login 
                    if (options.authorLogin) {
                        // allow author
                        out("...resolving")
                        resolve({ token: tokenDoc1.token, loginAllowed: options.loginAttemptSuccessful })
                    } else {
                        // reject student
                        out("...rejecting")
                        reject(utils.generateError({ configCode: 'maxlogin' }))
                    }
                } else {
                    out("...resolving")
                    resolve({ token: tokenDoc1.token, loginAllowed: options.loginAttemptSuccessful })
                }
            }
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


let createResponseDoc = (options) => {
    // to create new exam_response doc recod
    return new Promise((resolve, reject) => {
        getNewRespDBid()
            .then(resId => {
                let newDoc = {
                    quizId: options.quizId,
                    userId: options.userId,
                }

                if (options.isSection) {
                    newDoc['sections'] = { "1": { meta: {}, response: [] } }
                } else {
                    newDoc['response'] = []
                }

                newDoc._id = resId._id;
                if (resId._rev) {
                    newDoc._rev = resId._rev;
                }
                return respdb.insert(newDoc)
            })
            .then((data) => {
                resolve()
            })
            .catch(err => {
                reject(err)
            })
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
                        if(itm.type=='info'){ 
                            infoType++ 
                        }else{ 
                            totalGrad++;
                            // if the item is not info type and is locked , increment this counter
                            if(itm.lock){
                                gradAtt++;
                            }else{
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

                            if(itm.type=='info'){ 
                                infoType++ 
                            }else{ 
                                totalGrad++;
                                // if the item is not info type and is locked , increment this counter
                                if(itm.lock){
                                    gradAtt++;
                                }else{
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
                await utils.requestToQuizServer('start_examineer_quiz', { 'quizid': inputQuizId })
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
                if(itm['type'] !== "sub"){
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
                }else
                if(itm['type'] === "sub"){
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
        await utils.inspectJSON(req.body, { requiredFields: ['quizId', 'uname', 'isSection'], validFields: ['quizId', 'uname', 'isSection', 'reqByAuthor'] })
        // await checkIfQuizIsActive(req.body.quizId)
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
                    if (dta.response.length > 0) {
                        await utils.requestToQuizServer('submit_examineer_response', { 'quizid': req.body.quizId + '-' + req.body.uname, response: dta.response })
                    } else {
                        let blankresponse = await generateBlankRespPlainQuiz(req.body.quizId, req.body.uname)
                        //out(blankresponse)
                        await utils.requestToQuizServer('submit_examineer_response', { 'quizid': req.body.quizId + '-' + req.body.uname, response: blankresponse })
                    }
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
                    }

                    // await utils.requestToQuizServer('submit_sectioned_quiz', { regrade: false, 'quizid': req.body.quizId, 'userid': req.body.uname, responseSections: dta.sections })
                }
            } else {
                // resp obj does not exists , proceed with blank response 
                if (req.body.isSection) {
                    await utils.requestToQuizServer('submit_sectioned_quiz', { regrade: false, 'quizid': req.body.quizId, 'userid': req.body.uname, responseSections: {} })
                } else {
                    out("plain quiz, blank quiz from server")
                    let blankresponse = await generateBlankRespPlainQuiz(req.body.quizId, req.body.uname)

                    //out(blankresponse)
                    await utils.requestToQuizServer('submit_examineer_response', { 'quizid': req.body.quizId + '-' + req.body.uname, response: blankresponse })
                }
            }

            await utils.dbLog({ uname: req.body.uname, quizId: req.body.quizId, priority: 1, message: "Quiz submitted", action: "submitted", useragent: req.useragent })
            res.success({ "message": "Quiz submitted. Redirect to quiz summary page." })
        }
    } catch (err) {
        res.error200(err)
    }
}
module.exports.submitQuiz = submitQuiz;


let generateSummaryData = async (uid, qid) => {
    try {
        let data = { summary: [], meta: {}, submission: {}, summObjs: {}, summaryGenerated: false }
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
                                if(itm.hasOwnProperty("partialGrading")){
                                    summObj['partialGrading'] = itm["partialGrading"]
                                }else{
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
                        console.log(summObj)
                        if (summObj) {
                            summObj['title'] = itm.title;
                            summObj['helpAllowed'] = itm.helpAllowed;
                            summObj['isAttempted'] = attempted[key];
                            if(itm.hasOwnProperty("partialGrading")){
                                summObj['partialGrading'] = itm["partialGrading"]
                            }else{
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
        let summaryStats = await plugins.sectionWiseSummary(req.body.quizId,req.body.uname) // TODO re position it to make i more otimized

        
        if (req.body.reqByAuthor) {
            // res.json({  summary: summaryData, status: 'allow', scoreStatus: 'submission', reviewStatus: 'allowed' });
            resObj = { summaryStats:summaryStats, summaryGenerated: cdata['summaryGenerated'], summary: summary, status: 'allow', metadata: metadata, scoreStatus: 'submission', reviewStatus: 'allowed' }
        } else {

            // TODO do not send summary when not required
            switch (metadata.score) {
                case 'submission':
                    resObj = { summaryGenerated: cdata['summaryGenerated'], summaryStats:summaryStats, summary: summary, status: 'allow', metadata: metadata, scoreStatus: metadata.score, reviewStatus: metadata.review }
                    break;
                case 'deadline':
                    var ct = new Date();
                    if (ct > endDt) {
                        resObj = { summaryGenerated: cdata['summaryGenerated'], summaryStats:summaryStats, summary: summary, metadata: metadata, status: 'allow', scoreStatus: metadata.score, reviewStatus: metadata.review }
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
            res.success({ status: "unallowed", msg: 'You can check your review after ' + endDt });
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
            resObj.quizData = data.quizdata;
            resObj.response = data.response;
            resObj.meta = data.meta;

            // to check if the author is viewing response
            let reqByAuthor = false;
            if (req.body.reqByAuthor) {
                reqByAuthor = true;
            }

            let quizDetails = examIdToDetails(req.body.examId)

            let logObj = {
                authorLogin: reqByAuthor,
                quizId: quizDetails.quizId,
                uname: quizDetails.uname,
                action: "view_response",
                message: quizDetails.isSection ? "Viewed response of Section " + quizDetails.secId + " " : "Viewed response",
                prioirty: 2,
                useragent: req.useragent
            }


            await utils.dbLog(logObj)

            // question statistics
            let parts= req.body.examId.split("-")
            resObj['statistics'] = await plugins.getQuizAnalytics(parts[0],parts[1],parts[2])
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
            if(tdoc.resetEmailToken){
                if(tdoc.resetEmailToken == req.body.token){
                    tdoc['failedLogin'] = 0;
                    tdoc['token'] = utils.generateToken();
                    delete  tdoc['resetEmailToken'];
                    delete  tdoc['resetEmailDate'];
                    await respdb.insert(tdoc)
                    await utils.dbLog({ uname: req.body.uname, priority: 1, quizId: req.body.quizId, action: "account_unlocked", message: "Account unlocked", useragent: req.useragent })

                    res.success({'message':'Account unlocked'})
                }else{
                    throw utils.generateError({ configCode: 'unauthReq' });
                }
            }else{
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

let captchaCheck = async (captcha,remoteip)=>{
    try {
        
        const secretKey = '6LdpvDEUAAAAAHszsgB_nnal29BIKDsxwAqEbZzU';

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
        console.log(gResp)
        if (gResp.success !== undefined && !gResp.success){
            throw utils.generateError({ configCode: 'captchaFalse' })
        }
        return
    } catch (error) {
        throw error
    }
}

let sendLoginCredentials = async (req, res, next) =>{
    try {
        await utils.inspectJSON(req.body, { requiredFields: ['user', 'quizId','captcha'], acceptBlank: false, validFields: ['user', 'quizId','captcha'] })
        
        // check captcha 
        await captchaCheck(req.body['captcha'],req.connection.remoteAddress)

        let input = {quizId:req.body.quizId,user:req.body.user}
        let quizDoc = await  metadb.get(input.quizId)

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

        if(quizDoc.users.sendEmail==false){
            throw utils.generateError({ configCode: 'sendEmailFalse' })
        }

        // if sendEmail option is set to true , find and generate an array of username and email id

        let uObjs = []
        Object.keys(quizDoc.users.userData).map(ky =>{
            let user = {
                user: ky,
                email : quizDoc.users.userData[ky][quizDoc.users['emailCol']]
            }
            uObjs.push(user)
        })
        // console.log(uObjs)

        // first 
        let foundUser ;
        let findByUser = uObjs.find(itm=>{return itm['user']==input['user']})
        if(!findByUser){
            //console.log("not found by user")
            let findByEmail = uObjs.find(itm=>{return itm['email']==input['user']})
            if(!findByEmail){ 
                //console.log("not found by email")
                throw utils.generateError({ configCode: 'meta404_1' })
            }else{
                foundUser = findByEmail;
            }
        }else{
            foundUser = findByUser;
        }

        if(!foundUser){
            throw utils.generateError({ configCode: 'meta404_1' })
        }

        let emailBody = `
        ${await config.get("emailHead")}
      
          Hi, <p>Welcome to Examineer!</p> 
 <p> ${quizDoc['authorName']} <a href="mailto:${quizDoc['authorEmail']}" style="color: #000000;">${quizDoc['authorEmail']}</a> has created an Examineer Quiz for you. You will find details below. Quiz is valid only for a limited time. Make sure that you LOGIN and SUBMIT your quiz within the validity period.
</p>             
<p>
                <table class="summary-table" border="0" cellspacing="0" cellpadding="8">
                    <tr>
                        <td><b>Quiz Title</b></td>
                        <td>${quizDoc['title']}</td> 
                    
                    </tr>
                    <tr>
                        <td><b>Valid From</b></td>
                        <td>${quizDoc['beginTime']}</td> 
                    </tr>
                    <tr>
                        <td><b>Valid Upto</b></td>
                        <td>${quizDoc['endTime']}</td> 
                       
                    </tr>
                    <tr>
                        <td><b>Duration</b></td>
                        <td>${quizDoc['duration']}</td> 
                        
                    </tr>
                </table>
</p>
<p>
To access your quiz go to
<a href="https://examineer.in" target="_blank" style="font-family: 'proxima_nova _softmedium', Helvetica, Arial, sans-serif; text-decoration: none; color: #000000;" class="hover">examineer.in</a>
and use the following credentials to LOG IN:
</p><p>
<table class="summary-table" border="0" cellspacing="0" cellpadding="8">
<tr> <td><b>Quiz Id</b></td>
                        <td>${quizDoc['_id']}</td> 
</tr>
<tr>
    <td><b>User Id</b></td> 
    <td><a href="" style="color: #000000;"> ${foundUser['user']} </a></td> 
</tr>
<tr><td><b>Password</b></td> 
                        <td>${quizDoc['credentials'][foundUser.user]}</td>
</tr>
</table>
</p>
We hope you enjoy your experience.
</p>
${await config.get("emailTail")}`

// console.log(emailBody)
    let userEmail  = foundUser['email']// quizDoc.users.userData[foundUser.user][quizDoc.users['emailCol']]
    let emailHeader = `Examineer.in Credentials for Quiz by ${quizDoc['authorName']}`
    //console.log(userEmail)
    //console.log(emailBody)
    await utils.requestToQuizServer('send_mail', { to: userEmail, sub: emailHeader, body: emailBody })
    await utils.dbLog({ uname: foundUser['user'], quizId: quizDoc['_id'], message: "Credentials sent to email", action: "credentials_sent", priority: 2, useragent: req.useragent })

    let smsg = await config.getInner("configMessage","credentials_sent")
    
    let protect_email = function (user_email) {
        var avg, splitted, part1, part2;
        splitted = user_email.split("@");
        part1 = splitted[0];
         part2 = splitted[1]
        avg1 = part1.length / 2;
        avg2 = part2.length / 2;
        part1 = part1.substring(0, (part1.length - avg1));
        part2 = part2.substring(0,(part2.length - avg2))
        return part1 + "...@" + part2+"...";
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