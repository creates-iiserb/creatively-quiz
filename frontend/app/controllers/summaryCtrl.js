
app.controller('summaryCtrl',['$scope', '$http', '$rootScope', '$location', '$interval','$timeout','$window','$filter','dataService','helperService','requestService' ,function ($scope, $http, $rootScope, $location, $interval,$timeout,$window,$filter,dataService,helperService,requestService) {
   
    $scope.lang = $rootScope.language;
    $scope.downloadText = 'Download';
    $scope.isDownloading = false;
    let summTimeout = null;
    
    $scope.reqBy = 'std';
    if(dataService.getData('reqByAuthor')){
        $scope.reqBy = 'auth';
    }

   
    $scope.loggedOut = function () {
        dataService.loggoutWithReason('loggedOut');
    }

   
    $scope.$on('$stateChangeStart', function(e, toState, toParams, fromState, fromParams) {
        if(fromState.name=='quiz-summary' && (toState.name=='root' || toState.name=="quiz" )){
                e.preventDefault();   
                history.pushState(null,null, window.location.origin + window.location.pathname+"#livequiz");                
                swal({
                    text: 'Back button is disabled.',
                    buttonsStyling: false,
                    confirmButtonClass: "btn btn-warning btn-fill"
                });
        }
                 
    });
    

    $scope.emailRegex =/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    
    $scope.alertMSG = 0;
    $scope.showSumm = false;
    // to get quiz summary
    $scope.summary = function () {
        var reqdata = { 'uname': dataService.getData('USER'), 'quizId': dataService.getData('QUIZID') };
        requestService.request('POST',true,'/summary',reqdata).then(function(response){
            var result = response.data;
            

            if (result.status) {
                var data = result.data;
                if (data.scoreStatus == 'submission') {
                   
                    $scope.showSumm = true;   
                    if(data.hasOwnProperty('summaryGenerated')){
                        $scope.isSummaryGenerated(data.summaryGenerated); 
                    }
                                        
                } else if (data.scoreStatus == 'deadline' && data.status == 'allow') {
                   
                    $scope.showSumm = true;  
                    if(data.hasOwnProperty('summaryGenerated')){
                        $scope.isSummaryGenerated(data.summaryGenerated); 
                    }

                }
                else if (data.scoreStatus == 'deadline' && data.status == 'unallowed') {
                    
                    var begindate1 = new Date(data.allowDate);
                    var time3 = begindate1.toString().split(" ")[4];
                    var month =[ "Jan", "Feb", "Mar", "Apr","May", "Jun", "Jul", "Aug","Sep", "Oct", "Nov","Dec"];
                    var getstartDate3 = begindate1.getDate();
                    var getstartMonth3 = month[begindate1.getMonth()];
                    var getstartFullYear3 = begindate1.getFullYear();
                    if (getstartDate3 < 10){
                        getstartDate3 = "0" + getstartDate3;
                    }   
                    var date3 = getstartDate3 + " " + getstartMonth3 + " " + getstartFullYear3;
                    var deadLineDate = date3 + " " + time3.substring(0, 5);
                    $scope.deadLineDate = deadLineDate;
                   
                    $scope.showSumm = false; 
                    $scope.alertMSG = 1;                      
                }
                else if (data.scoreStatus == 'unallowed' && data.reviewStatus == 'unallowed') {   $scope.alertMSG = 2;  
                                          
                }

                if ($scope.showSumm) {
                    $scope.summaryDetailsObj = data.summary;
                    
                    
                    var summKeys = Object.keys($scope.summaryDetailsObj);
                    $scope.isPartialFields = data.summary[summKeys[0]].hasOwnProperty('pending')?true:false;
                    
                    if(summKeys.length>1){
                        $scope.summArr = [];
                        $scope.totalScore = 0;
                        $scope.totalMaxScore = 0;                            
                        $scope.totalGraded = 0;
                        $scope.sectionAttempted = 0;
                        $scope.totalContent = 0;
                        $scope.totalUngraded = 0;
                        $scope.totalAttempted=0;
                        $scope.totalSkipped=0;
                        $scope.totalIncorrect = 0;
                        $scope.totalCorrect = 0;
                        $scope.totalHelpUsed = 0;
                        $scope.totalSub = 0;
                        $scope.totalGradableContent = 0;
                        $scope.totalPendingForGrade = 0;

                        var date = new Date(1970,0,1);
                        var allSec = 0;
                        summKeys.forEach((key,index) =>{
                            let allowPartialGrading = $rootScope.sections[index].partialGrading;
                            var summData = {};
                            summData = $scope.summaryDetailsObj[key];

                            if(allowPartialGrading){
                                $scope.totalScore += summData.score + summData.partialScores; 
                                summData.score += summData.partialScores;
                                summData['allowPartialGrading'] = true;
                            }else{
                                $scope.totalScore += summData.score; 
                                summData['allowPartialGrading'] = false;
                            }

                            $scope.totalMaxScore += summData.max;
                            var correct = isNaN(summData.correct)?0:summData.correct;
                            var incorrect = isNaN(summData.incorrect)?0:summData.incorrect;
                            var help = isNaN(summData.help)?0:summData.help;

                            $scope.totalGraded += summData.graded;
                            $scope.totalContent+= summData.total;
                            $scope.totalUngraded+= summData.ungraded;
                            $scope.totalAttempted+= summData.attempted; 
                            $scope.totalSkipped+= summData.skipped;
                            $scope.totalIncorrect+=incorrect;
                            $scope.totalCorrect+= correct;
                            $scope.totalHelpUsed+= help;
                          
                            var dArr = summData.time.split(":");
                            allSec = allSec+  (+dArr[0]) * 60 * 60 + (+dArr[1]) * 60 + (+dArr[2]);
                            var secIndex = $scope.sections.findIndex(x=>x.sectionId == key );
                            summData.secTitle = $scope.sections[secIndex].secTitle;
                            summData.secId = key;
                            if(summData.isAttempted){
                                $scope.sectionAttempted++;
                            }

                            if(summData.hasOwnProperty('gradable')){
                                $scope.totalGradableContent += summData.gradable;
                            }
                            if(summData.hasOwnProperty('pending')){
                                $scope.totalPendingForGrade += summData.pending;
                            }

                            if(summData.hasOwnProperty('totalSub')){
                                $scope.totalSub +=  summData.totalSub;
                            }
                            
                            $scope.summArr.push(summData);
                        });

                        
                        
                        date.setSeconds(allSec);
                        var allTimeTaken = date.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
                        $scope.totalTimeTaken =allTimeTaken;
                        $scope.summaryStats = {};
                        if(data.hasOwnProperty('summaryStats')){
                            $scope.summaryStats = data.summaryStats;
                            $scope.generateSummarGraph(data.summaryStats,'sectioned');
                        }
                    }else{
                       
                        $scope.summaryStats = {};
                        $scope.summaryDetailsObj = data.summary[summKeys[0]];
                        let allowPartialGrading = $rootScope.sections[0].partialGrading;
                        if(allowPartialGrading){
                            $scope.summaryDetailsObj["score"] = $scope.summaryDetailsObj["score"] + $scope.summaryDetailsObj["partialScores"];
                            $scope.summaryDetailsObj["allowPartialGrading"] = true;
                        }else{
                            $scope.summaryDetailsObj["allowPartialGrading"] = false;
                        }
                        $scope.plainSecID = summKeys[0];
                        if(data.hasOwnProperty('summaryStats')){
                            $scope.summaryStats = data.summaryStats.overview;
                            $scope.generateSummarGraph(data.summaryStats,'plain');
                        }
                        
                    }
                                        
                }

                

            } else {
              
                $scope.alertMSG = 3;
                requestService.dbErrorHandler(result.error.code,result.error.type);
            }
            $(".pageLoader").fadeOut("slow");
        },function(responseError){
           console.log('Server Error');
           console.log(JSON.stringify(responseError,null,2));
           if(summTimeout){
            $timeout.cancel(summTimeout); 
            summTimeout = null;
           }
           dataService.swalAndRedirect('Unable to connect to the server. Please check your internet connection','warning','btn-warning','serverErr');
        });
    }

    $scope.isSummaryGenerated = function(summaryGenerated){
        if(summTimeout){
            $timeout.cancel(summTimeout); 
            summTimeout = null;
        }

        if(!summaryGenerated) {
            $scope.showSumm = false; 
            $scope.alertMSG = 4;
            let afterCall = parseInt($rootScope.configData.summaryIntervalChecker)*1000;
            summTimeout = $timeout($scope.summary, afterCall);
        }
    }

    $scope.generateSummarGraph = function(data,quizType){
        if($scope.reqBy == 'auth' || $rootScope.allowStats){
            $timeout(()=>{
                if(quizType == "sectioned"){
                    dataService.createGuage(data.overview,"averagetime",`${quizType}_SummAvgTTgarph`);
                    dataService.createGuage(data.overview,"averagescore",`${quizType}_SummAvgSCRgarph`);
                }

                for(sec in data.stats){
                    dataService.createGuage(data.stats[sec],"averagetime",`${quizType}_SummAvgTTgarph_${sec}`);
                    dataService.createGuage(data.stats[sec],"averagescore",`${quizType}_SummAvgSCRgarph_${sec}`);
                }

               
                const histogram = `${quizType}_mark_distribution`;
                const scores = data.overview.scores;
                const trace = {
                    x: scores,
                    type: 'histogram',
                };
                const layout = {
                    title: "Mark Distribution", 
                    xaxis: {title: "Marks",fixedrange: true}, 
                    yaxis: {title: "No. of Students",fixedrange: true},
                    bargap: 0.03, 
                };
                const config = {
                    responsive: true,
                    displayModeBar: false
                };
                Plotly.newPlot(histogram, [trace],layout,config);

            
               
               

            },500);
        }
    }

   
    $scope.viewResBtn = false;
    $scope.viewResponse = function (sectionId) {
        $scope.viewResBtn = true;
       
        $rootScope.activeQuiz = sectionId;
        var reqdata = { 'quizId': dataService.getData('QUIZID') };
        requestService.request('POST',true,'/isReview',reqdata).then(function(response){
            var result = response.data;
             
            if(result.status){
                var data = result.data;
                if (data.status == "allowed") {
                    dataService.setData('VIEWRES', true);
                    $location.path(data.path);
                } else {
                    let endTime  = $filter("toLocalTime")(data.endTime);
                  
                    let msg = $filter('findReplace')($scope.lang[data.caption],{'###': endTime});
                    dataService.setData('VIEWRES', false);
                    helperService.notifyMsg('ti-alert', 'warning', msg, 'top', 'center',5000);
                }
            }else{
                requestService.dbErrorHandler(result.error.code,result.error.type);
            }
            $timeout(()=>{
                $scope.viewResBtn = false;
            },2000);
        },function(responseError){
           console.log('Server Error');
           $scope.viewResBtn = false;
           console.log(JSON.stringify(responseError,null,2));
           dataService.swalAndRedirect('Unable to connect to the server. Please check your internet connection','warning','btn-warning','serverErr');
        });

    }

    
    $scope.downloadSummary = function(){
        $scope.downloadText = $scope.lang.caption_wait;
        $scope.isDownloading = true;
        var reqdata = { 'uname': dataService.getData('USER'), 'quizId': dataService.getData('QUIZID') };
        requestService.download('POST',true,'/summary/pdf',reqdata)
        .then(function (response) {
            var headers = response.headers(); 
            headers['Content-Disposition'] = "attachment";
            var blob = new Blob([response.data], { type: "octet/stream" });
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob); 
            link.download = reqdata.quizId+'-QuizSummary.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            $scope.downloadText = 'Download';
            $scope.isDownloading = false;
        }).catch(function(error){
          console.log(error);
          $scope.isDownloading = false;
        });

    }

    $scope.sendMailBtnReq =  false;
    $scope.sendEmail = function(){
        $scope.sendMailBtnReq =  true;
        var reqdata = { 'uname': dataService.getData('USER'), 'quizId': dataService.getData('QUIZID'),'email':$scope.email };
        requestService.request('POST',true,'/summary/email',reqdata).then(function(response){
            var result = response.data;
            $('#sendMailModal').modal('hide');
            $scope.sendMailBtnReq =  false;
               swal({
                title: $scope.lang.caption_success,
                text:  $scope.lang.caption_mailSuccess,
                buttonsStyling: false,
                confirmButtonClass: "btn btn-success btn-fill",
                type: "success"
               });
        },function(responseError){
           $scope.sendMailBtnReq =  false;
           console.log('Server Error');
           console.log(JSON.stringify(responseError,null,2));
        });
    }

    $scope.$on("changeUILanguage",function(e,data){       
        $scope.lang = data.language; 
    })

}]);


