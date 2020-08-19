// this file contains all the middlewares
// const cfg = require("./config")
responseHandler = (req, res, next) => {
    /*
     * This middleware adds two methods in the response object - success and error.
     * These functions must be used in the API controllers to respond to a request. 
     */
    res.success = (data) => {
        var d = new Date();
        res.json({
            status: true,
            data: data,
            time: d.getTime() 
        });
    };

    res.error200 = (data) => {
        var d = new Date();
        console.log(data)
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
        res.json({
            status: false,
            error: dt,
            time: d.getTime() 
        });
    }

    res.error = (err, code, message) => {
        // console.log(err)
        if (err) {
            next(err);
        } else {
            next(Error(code + "#@#" + message));
        }
    }

    next();
}
module.exports.responseHandler = responseHandler;

let enableCORS = async (req, res, next) => {
    var origin = req.get('origin');
    // console.log("   ---- origin is ---" + origin);

    if (!origin) {
        if(!req.get('appagent')){
            console.log("unauth req")
            return res.status(200).json({'message':'blocked. Are you using postman or curl ?'});
        }
    } 
    res.header("Access-Control-Allow-Origin", await config.get("allowOrigin"));
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept,authToken,appagent");
    if (req.method === 'OPTIONS') {
        res.header("Access-Control-Allow-Methods", "PUT,POST,PATCH,DELETE,GET")
        return res.status(200).json({});
    }
    next();
}

module.exports.enableCORS = enableCORS;

// let config = require('./config');
const nano = require('nano')(config.getEnv('dbServer'));

const respdb = nano.db.use('examineer_response')
const authorDb = nano.db.use('authors')

let needAuthentication = async (req, res, next) => {
    // todo validate reqbyauthor here only
    // console.log(req.body.reqByAuthor)
    if (req.body.reqByAuthor) {
        let reqByAuthor = req.body.reqByAuthor
        var authorReq = req.body.reqByAuthor // reqByAuthor.split(":");
        // console.log(authorReq)
        let body = await authorDb.view("getUserData", "oauth_token", { key: [authorReq[1], authorReq[2]] })
        // console.log(body)
        if (body.rows.length < 1) {
            return res.json({
                status: false,
                error: {
                    code: 'authFailed',
                    type: 'danger',
                    message: "Authorization failed. Access denied. Author token invalid"
                }
            });
        }
        else {
            if (body.rows[0].value.token != authorReq[2]) {
                return res.json({
                    status: false,
                    error: {
                        code: 'authFailed',
                        type: 'danger',
                        message: "Authorization failed. Access denied"
                    }
                });
            }
        }
    }


    let tknhdr = req.get('authToken')   //req.headers['authToken']
    if (tknhdr) {
        //  next();
        let buff = Buffer.from(req.get('authToken'), 'base64').toString('ascii');
        let utoken = buff.split("###")      // quizId###userid###token
        if (utoken.length == 3) {
            let tokenId = utoken[0] + '-' + utoken[1];
            respdb.view('forTokenDoc', 'quizIdUserIdToDoc', { key: utoken[0] + '-' + utoken[1] })
                .then(data => {
                    if (data.rows.length > 0) {
                        let resDoc = data.rows[0].value;
                        if (resDoc.token == utoken[2]) {
                            let authorized = false;
                            // console.log(req.body)
                            if (req.body.quizId) {
                                if (utoken[0] == req.body.quizId) {
                                    authorized = true;
                                }
                                if (req.body.uname) {
                                    if (utoken[1] === req.body.uname) {
                                        authorized = true;
                                    } else {
                                        authorized = false;
                                    }
                                }
                            } else if (req.body.examId) {
                                let exmid = req.body.examId.split('-');
                                let qid, uid;
                                qid = exmid[0], uid = exmid[1]
                                if (utoken[0] == qid) {
                                    authorized = true;
                                } else {
                                    authorized = false;
                                }
                                if (utoken[1] == uid) {
                                    authorized = true;
                                } else {
                                    authorized = false;
                                }
                            }

                            if (authorized) {
                                next()
                            } else {
                                res.json({
                                    status: false,
                                    error: {
                                        code: 'authFailed',
                                        type: 'danger',
                                        message: "Authorization failed. Access denied"
                                    }
                                });
                            }

                        } else {
                            //console.log("no match")
                            res.json({
                                status: false,
                                error: {
                                    code: 'authFailed',
                                    type: 'danger',
                                    message: "Authentication failed. Invalid token"
                                }
                            });
                        }
                    } else {
                        res.json({
                            status: false,
                            error: {
                                code: 'authFailed',
                                type: 'danger',
                                message: "Authentication failed. Invalid user"
                            }
                        });
                    }
                })
                .catch(err => {
                    console.log(err)
                })
        } else {
            res.json({
                status: false,
                error: {
                    code: 'authFailed',
                    type: 'danger',
                    message: "Authentication failed. Invalid token provided"
                }
            });
        }
    } else {
        res.json({
            status: false,
            error: {
                code: 'authFailed',
                type: 'danger',
                message: "Authentication failed. No token provided"
            }
        });
    }
}
module.exports.needAuthentication = needAuthentication