// const config = require('../services/config')
const nano = require('nano')(config.getEnv('dbServer'));
const examdb = nano.db.use('examineer_exam')
const metadb = nano.db.use('examineer_metadata')

// for questions wise statistics 
let getQuestionData = async (quizId) => {
    // loadJSON 
    try {
        let data = await examdb.view('byQuizId', 'questionAnalytics', { key: quizId })
        let metadbdata = await metadb.view('exam_meta', 'idToAdvanced', { key: quizId });
        metadata = metadbdata.rows[0].value;
        let sectData = await metadb.view('ByAuthor', 'idToSectionData', { key: quizId });
        let sect = sectData.rows[0].value;
        let partialGrading = {}
        sect['sections'].map((itm,index)=>{
            if(itm.hasOwnProperty("partialGrading")){
                partialGrading[index+1] = itm['partialGrading']
            }else{
                partialGrading[index+1] = false
            }
        })
        let vals = []
        data['rows'].map(itm => { 
            // to include partial scores to scores 
            if(partialGrading[itm['value']['section']]==true){
                if(itm['value'].hasOwnProperty("partial")){
                    itm['value']['score'] += itm['value']['partial']
                }
            }
            vals.push(itm['value']) 
        })
        return { rows: vals, gradingMatrix: metadata['gradingMatrix'], partialGrading:partialGrading }
    } catch (error) {
        throw error
    }
}


let getQuizAnalytics = async (quizId, user, sectionId) => {
    try {
        let quizData = await getQuestionData(quizId)
        // console.log(JSON.stringify(quizData,null,2))
        let quesIds = []
        quizData['rows'].map(itm => {
            // generate list of all questions ids in a section 
            if (itm['user'] == user && itm['section'] == sectionId) { quesIds.push(itm['ref']) }
        })
        // value_data contins responses of all quiz takers
        let value_data = quizData['rows'];


        let stats = {} //  key of this obj is question ref and its value is the stats generate for that questions
        //  e.g. - {'00001':{correct...},'0002':{corret:...}}


        quesIds.map(ref => {
            // generate statistics for each question in this section 

            let Status = {};
            let gradeFlag = false;
            let time =0, score =0 
            let correct = 0, incorrect = 0, skipped = 0;
            let Nohelp = 0, hintonly = 0, Bothused = 0;

            let correct_Helpused = 0, Incorrect_Helpused = 0, skipped_Helpused = 0
            let correct_nohelpused = 0, Incorrect_nohelpused = 0, skipped_nohelpused = 0;

            let GM = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
            var Sumtime = 0, SumScore = 0,Mintime =0,Maxtime=0,Minscore =0 ,Maxscore=0; 

            // part 1: to generate data for the user 

            // looking for a questions which is not info type or subjective 
            // skipping all  subjective questions for now
            let userData = value_data.find(itm => { return itm['ref'] == ref && itm['user'] == user && itm['type'] !== "info" && itm['type'] !== "sub" });
            // TODO see if we need to check lock value of not
            if (userData) {
                // data found 
                time =  userData.timeTaken ;
                score=   userData.score;
                Status['queType'] = userData.type
                Status['userTimeTaken'] = userData.timeTaken
                Status['userScore'] = userData.score
                if (userData.hasOwnProperty('gradingIndex')) {
                    // stat are calculated on the basis of the gradingIndex in each response. 
                    // if gradingIndex is not available, stats do not exists 
                    gradeFlag = true;
                }

                // TODO check if required 
                if (gradeFlag) {
                    let ansStr = ""
                    if (userData.gradingIndex[0] === 0)
                        ansStr = "<span class='text-success text-center'> <span class='fa fa-check'> </span> Correct </span>";
                    else if (userData.gradingIndex[0] === 1)
                        ansStr = "<span class='text-warning text-center'> <span class='fa fa-minus-circle'</span>  Skipped </span>";
                    else if (userData.gradingIndex[0] === 2)
                        ansStr = "<span class='text-danger text-center'> <span class='fa fa-times'> </span> Incorrect </h3>";
                    Status['userAnswer'] = ansStr
                }
            }
            else {
                // if queType == na , no stats are displayed
                Status['queType'] = "na"
            }

            // part 2 : generate statistics 
            // if gradeFlag exists i.e. grading index exists , gen stats 
            if (gradeFlag) {
                value_data.forEach(function (element) {
                    // also skipping subjective questions here 
                    if (element.ref === ref && element.type !== "info" && element['type'] !== "sub") {
                        GM[element.gradingIndex[0]][element.gradingIndex[1]]++
                        SumScore += element.score;
                        Minscore = element.score < Minscore ? element.score : Minscore
                        Maxscore = element.score > Maxscore ? element.score : Maxscore
                        Mintime = element.timeTaken < Mintime ? element.timeTaken : Mintime
                        Maxtime = element.timeTaken > Maxtime ? element.timeTaken : Maxtime
                        //console.log(element.timeTaken)
                        Sumtime += Number(element.timeTaken);

                        //console.log(element)
                        // console.log(Sumtime)
                        if (element.gradingIndex[0] === 0) {
                            correct++;
                            if (element.helpUsed === 1 | element.helpUsed === 2)
                                correct_Helpused++;
                            else
                                correct_nohelpused++;
                        }
                        else if (element.gradingIndex[0] === 2) {
                            incorrect++;

                            if (element.helpUsed === 1 | element.helpUsed === 2)
                                Incorrect_Helpused++;
                            else
                                Incorrect_nohelpused++;
                        }
                        else if (element.gradingIndex[0] === 1) {
                            skipped++;
                            if (element.helpUsed === 1 | element.helpUsed === 2)
                                skipped_Helpused++;
                            else
                                skipped_nohelpused++;
                        }
                        if (element.helpUsed === 0) {
                            Nohelp++;
                        }
                        else if (element.helpUsed === 1) {
                            hintonly++;
                        }
                        else {
                            Bothused++;
                        }
                    }
                    else {
                        // console.log("data 404")
                    }
                });
            }

            let Averagescore = 0, averageTime = 0, Total = 0;
            if (correct !== 0 | incorrect !== 0 | skipped !== 0) {
                Total = correct + incorrect + skipped;
                averageTime = +(Sumtime / Total).toFixed(2);
                //  console.log(averageTime)
                Status['averagetime'] = averageTime;
                Averagescore = +(SumScore / Total).toFixed(2);
                Status['averagescore'] = Averagescore;
            }

            // show stat only  if gradingIndexExists 
            Status['gradingIndexExists'] = gradeFlag
            Status.correct = correct;
            Status.incorrect = incorrect;
            Status.skipped = skipped;
            Status.Nohelp = Nohelp;
            Status.hintonly = hintonly;
            Status.Bothused = Bothused;
            Status.GradMatrix = GM;
            Status.Total = Total
            Status.Time =
            {
              Min : Mintime,
              Max : Maxtime,
              Avg : averageTime,
              yours: time
            }
            Status.Score=
            {
              
              Min : Minscore,
              Max : Maxscore,
              Avg : Averagescore,
              yours: score
            }
            stats[ref] = Status
        })
        return stats
    } catch (error) {
        return error
    }
}
module.exports.getQuizAnalytics = getQuizAnalytics;


// for section wise analytics 

let getSectionSummaryData = async (quizId) => {
    try {
        // returns score of all sections 
        let data = {records: [], meta: {} }
        let viewData = await examdb.view('ByQuizId', "summaryPlus", { key: quizId })
        viewData['rows'].map(itm => {
            data.records.push(itm.value)
        })
        let metaview = await metadb.view("ByAuthor", "idToSectionData", { key: quizId })
        data.meta = metaview.rows[0]['value']
        //delete data.meta['students'];
        //delete data.meta['quizInst'];
        return data
    } catch (error) {
        console.log(error)
        return error
    }
}
// getSectionSummaryData("AANX").then(data => { console.log( JSON.stringify(data,null,2)   ) })


let NumberofSeconds = (tdata) => {
    let onesectime = 0
    if (tdata != '') {
        let timelist = tdata.split(':')
        onesectime = Number(timelist[0]) * 3600 + Number(timelist[1]) * 60 + Number(timelist[2])
    }
    return onesectime
}

let secondToString = (given_seconds) => {
    hours = Math.floor(given_seconds / 3600);
    minutes = Math.floor((given_seconds - (hours * 3600)) / 60);
    seconds = Math.floor(given_seconds - (hours * 3600) - (minutes * 60));
    timeString = hours.toString().padStart(2, '0') + ':' +
        minutes.toString().padStart(2, '0') + ':' +
        seconds.toString().padStart(2, '0');
    return timeString
}

let sectionWiseSummary = async (quizId, user) => {
    let data = await getSectionSummaryData(quizId);
   // console.log(JSON.stringify(data,null,2))
    //FinalOutput
    let resultData = {
        generatedOn: new Date(),
        stats: {}
    }

    let totalsectime = 0
    let totalsecscore = 0;

    //getting uniques section numbers from JSON data
    let uniqueSec = Array.from(Array(data.meta.sections.length), (x, index) => index + 1)

    // console.log(uniqueSec)
    //Looping over each section's data
    uniqueSec.forEach(Section => {
        let sectiondata = [], minT = '', maxT = '', minS = 0, maxS = 0
        // console.log(Section)
        if (!resultData['stats'][Section]) {
            resultData['stats'][Section] = {
                Time: {Min: 0, Max: 0,Avg: 0,your: 0},
                Score: {Min: 0,Max: 0,Avg: 0,your: 0},
                Count:{
                    Total: 0, // total number of students who took part in the quiz 10 meta.student.length
                    Submitted: 0, // total number of students who have submitted the quiz i.e. submittedOn exists 
                    Attempted: 0 // total number of students who attempted the section i.e.  startedOn exists 
                },
                partialGrading: false
            }
        }

        //Storing each section data in to "sectiondata" 
        sectiondata = data.records.filter(item => (item.section) === Section)
        //Storing summary data of each section in "secSummaryData" 
        secSummaryData = sectiondata.filter(item => item.hasOwnProperty('summary'))

        //setting initial values for min and max comparison
        initminT = (secSummaryData[0].summary.time)
        initmaxT = (secSummaryData[0].summary.time)
        initminS = (secSummaryData[0].summary.score)
        initmaxS = (secSummaryData[0].summary.score)

        //Min and Max of time and Score  
        resultData['stats'][Section].Time.Min = secSummaryData.reduce((min, p) => p.summary.time < min ? p.summary.time : min, initminT)
        resultData['stats'][Section].Time.Max = secSummaryData.reduce((max, p) => p.summary.time > max ? p.summary.time : max, initmaxT)
        resultData['stats'][Section].Score.Min = secSummaryData.reduce((min, p) => p.summary.score < min ? p.summary.score : min, initminS)
        resultData['stats'][Section].Score.Max = secSummaryData.reduce((max, p) => p.summary.score > max ? p.summary.score : max, initmaxS)
        resultData['stats'][Section].partialGrading = data.meta.sections[Section - 1].partialGrading ? data.meta.sections[Section - 1].partialGrading : false

        /* 
        For each section , all the below are calculated
        1.average time , score.
        2.user's time taken and score.
        3.total number of students
        3.total no. of students who submitted the quiz (quizId)
        4.total no. of students who attempted each section
        */
        sectiondata.forEach(rec => {
            if (rec.summary != undefined) {
                totalsectime += NumberofSeconds(rec.summary.time)
                totalsecscore += rec.summary.score + rec.summary.partialScores ? (resultData['stats'][Section].partialGrading) : rec.summary.score
                if (rec.taker == user) {
                    resultData['stats'][Section].Time.your = rec.summary.time
                    resultData['stats'][Section].Score.your = rec.summary.score
                }
            }

            resultData['stats'][Section].Count.Submitted += (Object.keys(rec).indexOf('submittedOn') > -1) ? 1 : 0
            resultData['stats'][Section].Count.Attempted += (Object.keys(rec).indexOf('startedOn') > -1) ? 1 : 0
        })
        resultData['stats'][Section].Count.Total = sectiondata.length
        resultData['stats'][Section].Time.Avg = secondToString((totalsectime / sectiondata.length).toFixed(2))
        resultData['stats'][Section].Score.Avg = Number((totalsecscore / sectiondata.length).toFixed(2))
    })
    // console.log(resultData.stats)
    return resultData
}
module.exports.sectionWiseSummary = sectionWiseSummary;