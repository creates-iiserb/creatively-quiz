//const config = require('../services/config')
const random = require('random')
const utils = require('../services/utilities')
const pdfsumm = require('../services/pdfGenerator');
const plugins = require('./plugins')

const request = require('request');
const nano = require('nano')(config.getEnv('dbServer'));
const globaldb = nano.db.use('global');
const metadb = nano.db.use('examineer_metadata')
const respdb = nano.db.use('examineer_response')
const examdb = nano.db.use('examineer_exam')

let index = async (req, res, next) => { res.success({ message: "User login API. Version 1" }) }
module.exports.index = index;

let out = (obj) => {
    let monitor = true;
    if (monitor) { console.log(obj) }
}

let generateOTP = () => {
    return random.int(min = 1000000, max = 9999999)
}

let verifyGoogleToken = async (data)=>{
    try {
        // TODO add  check 
        return
    } catch (error) {throw error}
}

let login = async (req, res, next) => {
    try {
        let allValid = ['loginType', 'email', 'google', 'continueLogin', 'emailOTP','reqByAuthor']
        await utils.inspectJSON(req.body, {
            requiredFields: ['loginType'],
            validFields: allValid
        })


        let input = {
            loginType: req.body.loginType,
            email: req.body.email,
            continueLogin: req.body.continueLogin,
            google: req.body.google,
            emailOTP: req.body.emailOTP,
        }

        let validType = await config.get("validUserLogin");
        if (validType.indexOf(input.loginType) == -1) { throw utils.generateError({ configCode: 'invalidLogin' }); }

        if (input.loginType == "emailOTP") {
            await utils.inspectJSON(req.body, {
                requiredFields: ['loginType', 'email'],
                validFields: allValid
            })
            let userDet = await plugins.getUserDoc(input.email)
            let user = userDet["user"]

            if (input.continueLogin == true) {
                // to continue login .... by verifying otp
                if (!user["login"]) { throw utils.generateError({ configCode: 'otpNotGenerated' }) }
                if (user["login"]["type"] != "emailOTP") { throw utils.generateError({ configCode: 'otpNotGenerated' }) }

                let current = new Date().getTime();
                let loginDate =  new Date(user["login"]["generatedOn"]).getTime()
                diffTime = Math.abs(current - loginDate);
                diffMin = Math.ceil(diffTime / (1000 * 60 ));
                // console.log(diffMin)
                if(diffMin > 15){ throw utils.generateError({ configCode: 'otpValidOver' })}

                if (user["login"]["otp"] != input.emailOTP) { throw utils.generateError({ configCode: 'otpInvalid' }) }
                let loginToken = utils.generateTokenN(60)
                user["login"] = {
                    "type": "emailOTP",
                    "otp": "reset" + utils.getUNIXTimeStamp(),
                    "loginOn": utils.getCurrentDateInUTC(),
                    "loginToken": loginToken
                }
                let uag = req.useragent;
                user["logs"].push({
                    date: utils.getCurrentDateInUTC(),
                    note: "Successful login via email OTP",
                    userAgent: uag["source"]
                })
                await respdb.insert(user)
                res.success({ loginToken: loginToken })
            } else {
                // first time login ,send otp to email 
                let newOTP = generateOTP();
                user["login"] = {
                    "type": "emailOTP",
                    "otp": newOTP,
                    "generatedOn": utils.getCurrentDateInUTC()
                }
                let uag = req.useragent;
                user["logs"].push({
                    date: utils.getCurrentDateInUTC(),
                    note: "Login request via Email OTP",
                    userAgent: uag["source"]
                })
                let msg = await utils.composeMail("quizUserLoginOTP", { user: input.email, otp: newOTP })
                await utils.requestToQuizServer('send_mail', { to: input.email, sub: msg.subject, body: msg.body })

                user["logs"].push({
                    date: utils.getCurrentDateInUTC(),
                    note: "OTP sent to email"
                })
                //console.log(user)
                await respdb.insert(user)
                res.success({ "msg": "OTP sent to email" })
            }
        } else if (input.loginType == "google") {
            await utils.inspectJSON(req.body, {
                requiredFields: ['loginType', 'google','email'],
                validFields: allValid
            })
            let userDet = await plugins.getUserDoc(input.email)
            let user = userDet["user"]

            await verifyGoogleToken(input.google)

            let loginToken = utils.generateTokenN(60)
            user["login"] = {
                "type": "google",
                "loginOn": utils.getCurrentDateInUTC(),
                "loginToken": loginToken
            }
            let uag = req.useragent;
            user["logs"].push({
                date: utils.getCurrentDateInUTC(),
                note: "Direct login via Google",
                userAgent: uag["source"]
            })
            // console.log(google)
            user["google"] =  input.google
            await respdb.insert(user)
            res.success({ loginToken: loginToken })
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

let fetchDetails = async (req, res, next) => {
    try {
        let usr = await plugins.getUserDoc(req["valildUserEmail"])
        res.success(usr)
    } catch (error) { res.error200(error) }
}
module.exports.fetchDetails = fetchDetails

let ping = (req, res, next) => {
    //out(req.body)
    res.success({ message: "User Login Token is valid" })
}
module.exports.ping = ping