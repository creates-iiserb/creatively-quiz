// this file contains configs and methods to access it
let data = require('./configEnv')

data['configMessage'] = {
    "404": "Document not found",
    "invLang": { type: 'danger', message: "Invalid langauage" },
    "meta404": { code: 'msg_invalidUser', type: 'danger' },
    "maxlogin": { code: 'msg_failedLogin', type: 'warning' },
    "inact": { code: 'msg_quizNotActive', type: 'warning' },
    "notLiveQuiz": { code: 'msg_notLiveQuiz', type: 'danger' },
    "valError1": { code: 'msg_reqFieldMissing', type: 'warning' },
    "valError2": { code: "msg_invalidInput", type: 'warning' },
    "valError3": { code: "msg_emptyInput", type: 'warning' },
    "exam404": { code: "msg_quizNotFound", type: 'danger' },
    "quizNotStarted": { code: "alert_beforeQuizStart", type: "danger" },
    "quizEnded": { code: "alert_afterQuizEnd", type: "danger" },
    "quizNotValid": { code: "alert_afterQuizValidity", type: "danger" },
    "alreadySubmitted": { code: "quiz_already_submitted", type: "danger" },
    "notSubmitted": { code: "quiz_not_submitted", type: "danger" },
    "invalidSummaryType": { code: "invalidsummarytype", type: "danger" }
}
data["cookieMaxAge"] = 1.728e+8;  
data["authToken"] = "authToken";
data["maxFailedLoginAttempts"] = 10;

module.exports.get = (key) => {
    if (!data[key]) {
        
        throw new Error("Config not found");
    }
    return data[key]
};

module.exports.getInner = (key, subKey) => { return data[key][subKey] };