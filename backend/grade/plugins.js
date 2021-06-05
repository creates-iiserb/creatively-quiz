// const config = require('../services/config')
const nano = require('nano')(config.getEnv('dbServer'));
const respdb = nano.db.use('examineer_response')


const utils = require('../services/utilities')

// middleware to check if login allowed
let loginRequired = async (req, res, next) => {
    try {
        let tkn = req.get('authToken')
        if (tkn) {
            let a = tkn.split("###");
            let input = { token: a[0], sessionToken: a[1] }

            let tknSearch = await respdb.view('byGraderToken', 'sessionDetails', { key: input.token })
            if (tknSearch.rows.length == 0) {
                res.json({
                    status: false,
                    error: {
                        code: 'authFailed',
                        type: 'danger',
                        message: "Authentication failed. Invalid token provided"
                    }
                });
            } else {
                let gradDoc = tknSearch.rows[0].value;
                if (!gradDoc.gradingEnabled) { throw utils.generateError({ configCode: 'gradeNotEnabled' }); }
                if (!gradDoc.enabled) { throw utils.generateError({ configCode: 'gradeNotAllowed' }); }
                if (!gradDoc.session) { throw utils.generateError({ configCode: 'grade404' }); }

                if (input.sessionToken != gradDoc["session"]["token"]) { throw utils.generateError({ configCode: 'authError1' }); }
                else {
                    req["quizFinalized"] = gradDoc["finalized"]
                    req["valildGrader"] = gradDoc["grader"];
                    req["valildGraderQuiz"] = gradDoc["quizId"];
                    req["valildGraderRef"] = gradDoc["ref"];
                    next()
                }
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

let getGraderHistroy = async (quizId, ref, grader) => {
    // console.log(quizId+"-"+ref+"-"+grader)
    let hdb = await respdb.view("quizIdRefIdGrader", "history", { key: quizId + "-" + ref + "-" + grader })
    let hist = [];
    let ungr = [];

    // console.log(hdb)
    hdb.rows.map(itm => {
        if (itm.value.graded) {
            let assignedOn = new Date(itm.value.assignedOn).getTime();
            let a = itm.value
            a["assignedOn"] = assignedOn
            hist.push(a)
        } else {
            ungr.push(itm.value.queId)
        }
    })
    hist = hist.sort((a, b) => parseFloat(a.assignedOn) - parseFloat(b.assignedOn)) // .map(d=>d.queId);
    //console.log(JSON.stringify(hist, null, 2))
    return { graded: hist, ungraded: ungr };
}
module.exports.getGraderHistroy = getGraderHistroy

// let resetSubGrades = async (quiz, grader, ref) => {
//     let allQuizzes = await respdb.view("byQuizId", "graderProgess", { key: quiz })
//     let refs = []
//     allQuizzes.rows.map(itm => {
//         if (itm.value.grader == grader && itm.value.ref == ref) {
//             if (refs.indexOf(itm.id) == -1) { refs.push(itm.id) }
//         }
//     })
//     console.log(refs)
//     for (let index = 0; index < refs.length; index++) {
//         const element = refs[index];
//         let respDoc = await respdb.get(element);
//         if (respDoc["subScores"]) {
//             let fI = respDoc["subScores"].findIndex(scr => { return scr["grader"] == grader && scr["ref"] == ref })
//             console.log(fI)
//             if (fI > -1) { respDoc["subScores"].splice(fI, 1); }
//             //  console.log(JSON.stringify(respDoc))
//             await respdb.insert(respDoc)
//             console.log("updated doc " + respDoc["_id"])
//         }
//     }
// }

let getRubrics = async (quizId, queId) => {
    try {
        let data = await respdb.view("byQuizId", "subGradingMeta", { key: quizId })
        if (data) {
            // console.log(JSON.stringify(data, null, 2))
            let rec = data.rows[0].value
            if (rec["rubrics"] && Object.keys(rec["rubrics"]).length != 0 ) {
                let rubData = rec["rubrics"][queId]
                // confirm.log(rubData)
                rubData["revId"] = rec["_rev"]
                return rubData
            } else {
                // if rubrics object does not exists , then by default now allowed to use rubrics 
                return {
                    "adjEnabled": true,
                    "editable": false,
                    "rules": []
                }
            }
        } else {throw new Error("Not found")}
    } catch (error) {throw error}
}
module.exports.getRubrics = getRubrics