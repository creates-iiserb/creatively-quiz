
var cfg = require('./config');
var request = require('request')
const nano = require('nano')(cfg.get('dbServer'));
const respdb = nano.db.use('examineer_response')
const examdb = nano.db.use('examineer_exam')

let generateError = (options) => {
   
    let message = {};
    if (options.configCode) {
        message = cfg.getInner('configMessage', options.configCode)
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

let inspectJSON = (input, config) => {
    
    return new Promise(function (resolve, reject) {
        if (config.requiredFields) {
            let allReqFields = true;
            let reqFieldMissing = [];
            config.requiredFields.forEach((element) => {
               
                if (input[element] == undefined) {
                    allReqFields = false;
                    reqFieldMissing.push("" + element);
                }
            });
            if (!allReqFields) {
              
                reject(generateError({ configCode: 'valError1', reqFields: reqFieldMissing }));
            }
        }
        let varfields = config.validFields;
        let invalid = false, ifields = "";

      
        if (!input || Object.keys(input).length <= 0) {
            if (config.acceptBlank == true) {
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
       
        if (invalid) {
            reject(generateError({
                configCode: "valError2",
                invalidFields: ifields,
                validFields: config.validFields
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


let successRes = (data) => {
    return {
        status: true,
        data: data
    };
};

module.exports.successRes = successRes;


let errorRes = (data) => {
    
    let dt = {}

    if (data.message) {
        try{
            dt = JSON.parse(data.message);
        }catch(err){
            dt = data.message;
        }
        
    } else {
        dt = data
    }

    return {
        status: false,
        error: dt
    };
}

module.exports.errorRes = errorRes;

let checkLength = (anArray, errCode) => {
    if (anArray.length <= 0) {
       
        throw generateError({ configCode: errCode });
    }
}
module.exports.checkLength = checkLength;

let generateToken = (length=125) => {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
module.exports.generateToken = generateToken;

let requestToQuizServer = (type, data) => {
    
    return new Promise((resolve, reject) => {
        let dataToSend = { type: type, data: data };
        let reqBody = {
            url: cfg.get('quizServer'),
            timeout: 25000,
            method: "POST",
            body: '**jsonBegin' + JSON.stringify(dataToSend) + 'jsonEnd*****11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111'
        };
       
        request(reqBody, function (error, response, body) {
           
            if (error) {
                reject(error);
            } else {
              
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
  
    if (type == 'db') {
       
    } else if (type == 'log') {
    
    } else if (type = 'both') {
       
    }
}
module.exports.quizLog = quizLog;

let month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let getCurrentDateInUTC = () => {
  
    let dt = new Date();
    let cdate = month[dt.getUTCMonth()] + " " + dt.getUTCDate() + " " + dt.getUTCFullYear() + " " + dt.getUTCHours() + ":" + dt.getUTCMinutes() + ":" + dt.getUTCSeconds() + " UTC"
    return cdate;
}
module.exports.getCurrentDateInUTC = getCurrentDateInUTC;

let currTime = () =>{ 
    var d = new Date();
    return d.getTime();
} 
module.exports.currTime = currTime;

let convertDateInUTC = (date) => {
   
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
    
    return logObj;
}
module.exports.generateLogObject = generateLogObject;

let dbLog = (options) => {
  
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
           
            if (logObj.action == 'entered') {
                logObj['startedOn'] = getCurrentDateInUTC();
            }
            if (logObj.action == 'submitted') {
               
                let examdata = await examdb.view('byQuizUser', 'quizIdToPerfSummary', { key: options.quizId })
              
                let summRec = examdata.rows.filter((itm) => { return itm.value.userid == options.uname })
               
                logObj['summary'] = summRec;
                
            }
            let fl = ['logged_in_failure', 'logged_in_blocked2', 'logged_in_blocked1']
            if (fl.indexOf(logObj.action) > -1) {
                let tkndata = await respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: options.quizId + "-" + options.uname })
                logObj['failedLogin'] = tkndata['rows'][0].value.failedLogin;
            }
          
            emitEvent(options.quizId, options.uname, logObj)
        })
        .catch(err => {
            console.log(err)
        })
}
module.exports.dbLog = dbLog;


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