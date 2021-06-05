// const config = require('../services/config')
const nano = require('nano')(config.getEnv('dbServer'));
const examdb = nano.db.use('examineer_exam')
const metadb = nano.db.use('examineer_metadata')
const respdb = nano.db.use('examineer_response')


const utils = require('../services/utilities')

// middleware to check if login allowed
let loginRequired = async (req, res, next) => {
    try {
        let tkn = req.get('loginToken')
        if (tkn) {
            let input = { loginToken: tkn }
            let tknSearch = await respdb.view('byUserEmailToken', 'sessionDetail', { key: input.loginToken })
            if (tknSearch.rows.length == 0) {
                res.json({
                    status: false,
                    error: {
                        code: 'authFailed',
                        type: 'danger',
                        message: "Authentication failed. Invalid login token provided"
                    }
                });
            } else { 
                let userDoc = tknSearch.rows[0].value;
                // console.log(userDoc)
                let current = new Date();
                let loginDate =  new Date(userDoc["loginOn"])
                diffTime = Math.abs(current - loginDate);
                diffHours = Math.ceil(diffTime / (1000 * 60 * 60 ));
                if(diffHours > 48){
                    res.json({
                        status: false,
                        error: {
                            code: 'authFailed',
                            type: 'danger',
                            message: "Authentication failed. Invalid login token provided"
                        }
                    });
                }else{
                    req["valildUserEmail"] = userDoc["email"];
                    next()
                }
            }
        } else {
            res.json({
                status: false,
                error: {
                    code: 'authFailed',
                    type: 'danger',
                    message: "Authentication failed. No login token provided"
                }
            });
        }
    } catch (error) {
        console.log(error)
        res.error200(error)
        //console.log(error)
        // res.json({
        //     status: false,
        //     error: {
        //         code: 'internalError',
        //         type: 'danger',
        //         message: "Internal error"
        //     }
        // });
    }

}
module.exports.loginRequired = loginRequired;

let getNewRespDBid = () => {
    return new Promise((resolve, reject) => {
        //out("Searching for a new id in response db")
        respdb.view('byAdmin', 'getAvailableId')
            .then(data => {
                // out(data)
                let id = data.rows[0].value;
                let num = (id < 0) ? -id : id + 1;
                let availableId = "0000".concat(num.toString(36)).slice(-5);
                //out("available id =" + availableId)
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

let getUserDoc = async (userEmail, delPwd = true) => {
    try {
        // fromUserEmail/_view/userDetails
        let ud = await respdb.view("fromUserEmail", "userDetails", { key: userEmail })
        let user, qzs;
        qzs = await metadb.view("byUserEmail", "userDetails", { "key": userEmail })
        if (ud.rows.length == 0) {
            console.log("does not exists")
            // user does not exists...create a new user doc
            // check if email is mapped to atleast 1 quiz 
            if (qzs.rows.length == 0) { throw utils.generateError({ configCode: 'noQuizMapping' }) }
            let newId = await getNewRespDBid()
            let newUser = {
                _id: newId["_id"],
                userEmail: userEmail,
                createdOn: utils.getCurrentDateInUTC(),
                login: {},
                logs: []
            }
            if (newId["_rev"]) { newUser["_rev"] = newId['_rev'] }
            let newd = await respdb.insert(newUser)
            user = newUser
            user["_rev"] = newd["rev"]
            // console.log(newd)
        } else { user = ud.rows[0].value }
        let a = []
        qzs.rows.map(itm => {
            if (delPwd) { delete itm["value"]["pwd"] }
            itm["value"]["beginTimeTS"] = new Date(itm["value"]["beginTime"]).getTime()
            itm["value"]["endTimeTS"] = new Date(itm["value"]["endTime"]).getTime()
            a.push(itm.value)
        })
        return { user: user, quiz: a }
    } catch (error) {
        console.log("in user fn")
        throw error
    }
}
module.exports.getUserDoc = getUserDoc