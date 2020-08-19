// this file contains definitions of common utility functions which can be used in middleweres as well as route handlers
// var config = require('./config');
var request = require('request')
const nano = require('nano')(config.getEnv('dbServer'));
const respdb = nano.db.use('examineer_response')
const examdb = nano.db.use('examineer_exam')
let generateError = (options) => {
    // options
    // use this method to respond with an error object inside route handlers
    let message = {};
    if (options.configCode) {
        message = config.getInnerSync('configMessage', options.configCode)
    }
    let optCopy = JSON.parse(JSON.stringify(options));
    if (optCopy.configCode) {
        delete optCopy.configCode;
    }
    if (optCopy) {
        Object.keys(optCopy).map((itm) => {
            message[itm] = optCopy[itm]
        })
    }
    return new Error(JSON.stringify(message));
};
module.exports.generateError = generateError;

let inspectJSON = (input, config1) => {
    // to inspect a javascript object , config1 can take - requiredFields(array), validFields(array),acceptBlank(boolean)
    return new Promise(function (resolve, reject) {
        if (config1.requiredFields) {
            let allReqFields = true;
            let reqFieldMissing = [];
            config1.requiredFields.forEach((element) => {
                // loop throught all required fields to check wheter they exist in the JSON or not
                if (input[element] == undefined) {
                    allReqFields = false;
                    reqFieldMissing.push("" + element);
                }
            });
            if (!allReqFields) {
                // some required fields are missing
                reject(generateError({ configCode: 'valError1', reqFields: reqFieldMissing }));
            }
        }
        let varfields = config1.validFields;
        let invalid = false, ifields = "";

        // check if input is blank, error if blank
        if (!input || Object.keys(input).length <= 0) {
            if (config1.acceptBlank == true) {
                resolve();
            } else {
                reject(generateError({ configCode: 'valError3' }));
            }
        }

        Object.keys(input).forEach(function (key) {
            if (input[key].length == 0) {
                invalid = true;
                ifields += key + " , ";
            }
            else if (!varfields.includes(key)) {
                invalid = true;
                ifields += key + " , ";
            }
        });
        // if invalid flag is set, some invalid fields exists in the json
        if (invalid) {
            reject(generateError({
                configCode: "valError2",
                invalidFields: ifields,
                validFields: config1.validFields
            }));
        } else {
            let jsonValid = true;
            if (jsonValid) {
                resolve()
            }
        }
    });
}
module.exports.inspectJSON = inspectJSON;

let checkLength = (anArray, errCode) => {
    if (anArray.length <= 0) {
        // no elements in array
        throw generateError({ configCode: errCode });
    }
}
module.exports.checkLength = checkLength;

let generateToken = () => {
    var text = "";
    var length = 125;
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$%*-";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}
module.exports.generateToken = generateToken;

let requestToQuizServer = (type, data) => {
    return new Promise(async (resolve, reject) => {
        let dataToSend = { type: type, data: data };
        let reqBody = {
            url: await config.get('quizServer'),
            timeout: 25000,
            method: "POST",
            body: '**jsonBegin' + JSON.stringify(dataToSend) + 'jsonEnd*****11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111'
        };
        //console.log(reqBody)
        request(reqBody, function (error, response, body) {
            //console.log(response)
            if (error) {
                reject(error);
            } else {
                //console.log(response);
                let responseBody = JSON.parse(body);
                if (responseBody.error) {
                    reject(responseBody.error)
                } else {
                    if (responseBody.result.error) {
                        reject(responseBody.result.error)
                    } else {
                        resolve(responseBody.result)
                    }
                }
            }
        })
    })
}
module.exports.requestToQuizServer = requestToQuizServer;

let quizLog = (options) => {
    //examId, type, level, data, useragent, 
    if (type == 'db') {
        // save it in db
    } else if (type == 'log') {
        // save it in log file
    } else if (type = 'both') {
        // save it at both the places
    }
}
module.exports.quizLog = quizLog;

let month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let getCurrentDateInUTC = () => {
    // get the current date in db format
    let dt = new Date();
    let cdate = month[dt.getUTCMonth()] + " " + dt.getUTCDate() + " " + dt.getUTCFullYear() + " " + dt.getUTCHours() + ":" + dt.getUTCMinutes() + ":" + dt.getUTCSeconds() + " UTC"
    return cdate;
}
module.exports.getCurrentDateInUTC = getCurrentDateInUTC;

let convertDateInUTC = (date) => {
    // to convert a given date into the format in which the date is being stored in the database 
    // Example - Jan 12 10 2018 12:23:00 UTC 
    let dt = new Date(date);
    let cdate = month[dt.getUTCMonth()] + " " + dt.getUTCDate() + " " + dt.getUTCFullYear() + " " + dt.getUTCHours() + ":" + dt.getUTCMinutes() + ":" + dt.getUTCSeconds() + " UTC"
    return cdate;
}
module.exports.convertDateInUTC = convertDateInUTC;

let generateLogObject = (options) => {
    let logObj = {
        action: options.action,
        message: options.message,
        priority: options.priority,
        timeStamp: getCurrentDateInUTC()
    }
    if (options.useragent) {
        if (options.useragent.examApp) {
            logObj.useragent = options.useragent;
        } else {
            logObj.useragent = options.useragent;
        }
    }
    if (options.authorLogin) {
        logObj['message'] = logObj['message'] + " (by Admin) ";
        logObj['authorLogin'] = true;
    }
    //console.log("-----------------------------------")
    //console.log(logObj)
    return logObj;
}
module.exports.generateLogObject = generateLogObject;

let dbLog = async (options) => {
    return new Promise((resolve, reject) => {
        // options -  quizId, uname , action, userAgent
        let logObj;
        respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: options.quizId + '-' + options.uname })
            .then((dta) => {
                if (dta.rows.length > 0) {
                    let doc = dta.rows[0].value;
                    if (!doc.log) {
                        doc.log = [];
                    }
                    logObj = generateLogObject(options);
                    doc.log.push(logObj)
                    return respdb.insert(doc)
                }
            })
            .then(async () => {
                // emitting different kinds of events based on the log obj action 
                if (logObj.action == 'entered') {
                    logObj['startedOn'] = getCurrentDateInUTC();
                }
                if (logObj.action == 'submitted') {
                    // console.log("submitted flag set ")
                    let examdata = await examdb.view('byQuizUser', 'quizIdToPerfSummary', { key: options.quizId })
                    //  + "-" + options.uname
                    let summRec = examdata.rows.filter((itm) => { return itm.value.userid == options.uname })
                    // let b ;
                    // if(summRec.length==1){
                    //     b = [summRec];
                    // }else{
                    //     b= summRec
                    // }
                    logObj['summary'] = summRec;
                    //
                }
                let fl = ['logged_in_failure', 'logged_in_blocked2', 'logged_in_blocked1']
                if (fl.indexOf(logObj.action) > -1) {
                    let tkndata = await respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: options.quizId + "-" + options.uname })
                    logObj['failedLogin'] = tkndata['rows'][0].value.failedLogin;
                }
                //console.log(JSON.stringify(logObj))
                emitEvent(options.quizId, options.uname, logObj)
                resolve()
            })
            .catch(err => {
                console.log(err)
                resolve(err)
            })
    })
}
module.exports.dbLog = dbLog;
// dbLog({ quizId: 'AAGX', uname: '2', userAgent: { 'a': 'A' } , action: 'Sample log....' })

let quizStartDate = (examData) => {
    let sectionStartDates = [];
    examData.map((itm) => {
        sectionStartDates.push(new Date(itm))
    });
    let minStartDate;
    if (sectionStartDates.length > 0) {
        minStartDate = sectionStartDates.reduce(function (a, b) { return a < b ? a : b; });
    }
    return minStartDate
}
module.exports.quizStartDate = quizStartDate;

const log4js = require('log4js');

let logger; //  = log4js.getLogger('default');

var logConfigured = false;

let emitEvent = async (quizId, uname, logObj) => {
    if (!logConfigured) {
        console.log("log configure insode emit...must not happed")
        let fileName = await config.get('logFilePath')
        let lev = await config.get('logLevel')
        log4js.configure({
            appenders: { quiz: { type: 'file', filename: fileName }, quizConsole: { type: 'console' } },
            categories: { default: { appenders: ['quiz', 'quizConsole'], level: lev } },
            pm2: true
        });
        logger = log4js.getLogger('default');
        logConfigured = true
    }
    if (!logger) {
        console.log("error: logger not loaded")
    }
    // console.log(logObj)
    let message = quizId + "-" + uname + " : " + logObj.message
    let uAgent = await config.get('logUserAgent')
    if (uAgent) {
        let uag;
        if (logObj['useragent']) {
            if (logObj['useragent']['source']) {
                uag = logObj['useragent']['source']
            } else if (logObj['useragent']['examApp']) {
                uag = JSON.stringify(logObj['useragent'])
            }
        }
        message += "\n  Useragent : " + uag
    }
    if (logObj.priority == 1) {
        logger.warn(message)
    } else {
        logger.info(message)
    }


    let reqBody = {
        url: await config.get('realTimeServer'),
        timeout: 25000,
        method: "POST",
        json: true,
        body: { quizId: quizId, uname: uname, logObj: logObj }
    };
    //console.log(reqBody)
    // request(reqBody, function (error, response, body) {
    //     // console.log(response)
    // })
    //console.log(reqBody)
    try {
        let emailreq = await request(reqBody);
        // console.log(emailreq);
        if (emailreq.error) {
            console.log("real time server not working")
        }
    } catch (error) {
        console.log(error)
        console.log("real time server not working")
    }
}
module.exports.emitEvent = emitEvent;

var logEvent = async (type, msg) => {
    if (!logConfigured) {
        let fileName = await config.get('logFilePath')
        let lev = await config.get('logLevel')
        log4js.configure({
            appenders: { quiz: { type: 'file', filename: fileName }, quizConsole: { type: 'console' } },
            categories: { default: { appenders: ['quiz', 'quizConsole'], level: lev } },
            pm2: true
        });
        logger = log4js.getLogger('default');
        logConfigured = true
    }

    if (!logger) {
        console.log("error in logEvent function : logger not loaded")
    }
    switch (type) {
        case "trace":
            logger.trace(msg);
            break;
        case "debug":
            logger.debug(msg);
            break;
        case "info":
            logger.info(msg);
            break;
        case "warn":
            logger.warn(msg);
            break;
        case "error":
            logger.error(msg);
            break;
        case "fatal":
            logger.fatal(msg);
            break;
    }
}
module.exports.logEvent = logEvent;

let generateTokenN = (length) => {
    var text = "";
    var possible = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
module.exports.generateTokenN = generateTokenN

const fs = require('fs');

let saveFile = (data, fileName) => {
    let uniqFile = fileName + "_" + Date.now() + ".json";
    var jsonContent = JSON.stringify(data,null,2);
    // console.log(jsonContent);
    fs.writeFile("./tempFiles/"+uniqFile, jsonContent, 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }
        console.log("JSON file has been saved.");
    });
}
module.exports.saveFile = saveFile