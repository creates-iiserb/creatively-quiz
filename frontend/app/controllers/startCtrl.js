
app.controller('startCtrl', ['$scope', '$http', '$rootScope', '$location', '$state', '$stateParams', '$cookies', '$timeout','$window','requestService','dataService','helperService','$q','$interval','$filter',function ($scope, $http, $rootScope, $location, $state, $stateParams, $cookies, $timeout,$window,requestService,dataService,helperService,$q,$interval,$filter) {
    $scope.lang = $rootScope.language;
    $scope.isStarted = false;   
    $scope.proceedBtn = true;
    $rootScope.absFirstQuizStart = false;
    let preClock = null;
    $scope.showTimer = false;
    $scope.startQuiz('start');
    let isManualSubmit = false;
    $scope.chkBeforeTime = function (beginTime) {
        //var d = new Date;
        var d = $scope.getClock();
        var beginDt = new Date(beginTime);
        if (d > beginDt) {
            return true;
        } else {
            return false;
        }
    }

    $scope.submitType = function(){
       if(isManualSubmit){
          return 'manual';
       }else{
            if($scope.checkCurrTimeWithEndTime()){
                return 'autoDeadline';
            }else{
                return 'autoTimeup';
            }
        }
    }
    
    $scope.$on('$stateChangeStart', function(e, toState, toParams, fromState, fromParams) {        
        if(!$scope.proceedBtnDisableSQ){  
            if( (fromState.name=='start' && toState.name=='quiz') || (fromState.name=='start' && toState.name=='root') ){
                e.preventDefault();   
                history.pushState(null,null, window.location.origin + window.location.pathname+"#start");
                
                swal({
                    text: 'Back button is disabled.Please use proceed or exit button.',
                    buttonsStyling: false,
                    confirmButtonClass: "btn btn-warning btn-fill"
                });
                
            }
        }
        if(preClock){
            $interval.cancel(preClock);
            preClock = null;
        }
    });
    

    $scope.isLoad = false;
    $scope.loggedOut = function () {  
        dataService.loggoutWithReason('loggedOut');       
    }

    $scope.showSumm = false;
    $scope.altSummaryMessage = "";
    $scope.chkSumlg = function () {
        if (+dataService.getData('LOGGEDIN') == 1) {
            $scope.showSumm = true;
        } else {
            $scope.showSumm = false;
        }
    }
    
   

    var data = {
        uname:dataService.getData('USER'),
        quizId:dataService.getData('QUIZID')
    }

    ////////// time management - aamir/////////
    $scope.setAndCheckEndTime = function () {
        var endMarker = new Date($rootScope.ETIME);
        var duration = +$rootScope.DURATION;
        var timeDiff = ((endMarker.getTime() - $scope.session_begin_time.getTime()) / 60000);
        if (duration < timeDiff) {
            $scope.session_end_time = new Date($scope.session_begin_time.getTime() + duration * 60000);
        }
        else {
            $scope.session_end_time = new Date($rootScope.ETIME);
        }

        var ct = new Date($scope.getClock());
        if (ct >= $scope.session_end_time) {  
            if($scope.isStarted){
                helperService.notifyMsg('ti-alert', 'warning',$scope.lang.msg_timeUp , 'top', 'center');
            }
            $scope.proceedBtn = false;  
            return true; //open model
        }        
        return false;
    }

     $scope.quizTimerCounterEndMsg = false;
     $scope.qdeadLineNotOverButNotYetStart = false;
    //$scope.getClockTime();
    
    requestService.request('POST',true,'/quizTime',data).then(function(response){ 
            dataService.getYtVideo(); 
            dataService.getPlotChart(); 
            dataService.getPdfDoc();      
            $(".pageLoader").fadeOut("slow");
            $('.accordionSection .panel-heading').click(function(e){
                var $panel = $(this).closest('.panel-group');
                $('html,body').animate({
                scrollTop: $panel.offset().top
                }, 500);
            });
       

            if($scope.sections){
                if(!dataService.getData('ISSECTION') || $scope.sections.length==1) {   
                    $scope.helpAllowed = $scope.sections[0].helpAllowed;
                    $scope.grdCorrectAns = $scope.sections[0].gradingMatrix[0];
                    $scope.grdSkippedAns = $scope.sections[0].gradingMatrix[1];
                    $scope.grdWrongAns = $scope.sections[0].gradingMatrix[2];
                }
            }
            //////time logic start from here-aamir////
            var result = response.data;
            $rootScope.consoleData(result,'/quizTime-sc');   
            $rootScope.updateTime(result.time);

            if(result.status){
                var data = result.data;
                $scope.timeUsed = data.timeTaken;               
                $scope.isStarted = data.isStarted; 
                $scope.secSummary = data.secSummary;
                                   
                $scope.sectionStarted = data.sectionStarted; //check each section is started;

                let meStartQuizOn = data.startedOn;
                // check begin time validation
                var beginTime = new Date($rootScope.BTIME);
                var currentTime = $scope.getClock();
                if(beginTime>currentTime){
                    var msg = $scope.lang.msg_beforeLoginTime + beginTime + ".";
                    helperService.notifyMsg('ti-alert', 'warning', msg, 'top', 'center',5000);
                    $scope.proceedBtn = false;
                    //==============clock================//
                    $scope.showTimer = true;                           
                    preClock = $interval(function(){
                        console.log('test');
                        var now = $scope.getClock(); 
                        var distance = beginTime - now
                        var days = Math.floor(distance / (1000 * 60 * 60 * 24));
                        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
                        seconds = seconds<10?"0"+seconds:seconds;
                        document.getElementById('days').innerHTML = days+"D" ;
                        document.getElementById('hours').innerHTML = hours+"H" ;
                        document.getElementById('min').innerHTML = minutes+"M" ;
                        document.getElementById('sec').innerHTML = seconds+"S" ;
                        
                        if (distance < 0) {                               
                            $interval.cancel(preClock);
                            $scope.proceedBtn = true; 
                            $scope.showTimer = false;
                            $scope.quizTimerCounterEndMsg = true;
                            helperService.notifyMsg('ti-alert', 'success', 'Now you can start your quiz', 'top', 'center'); 
                            
                            if ($scope.loginTime == 'absolute') {
                                if ($rootScope.startedOn == null) {
                                    $rootScope.startedOn = new Date($scope.getClock());
                                    $rootScope.absFirstQuizStart = true;
                                }
                            $scope.session_begin_time = new Date($rootScope.startedOn);
                            } else {
                                $scope.session_begin_time = new Date($scope.getClock());               
                                if($scope.isStarted){
                                    $scope.session_begin_time.setSeconds($scope.session_begin_time.getSeconds() - $scope.timeUsed);
                                }                    
                            }                            
                        }

                      },1000)

                    //==============end of clock========//

                }else{
                    
                    if ($scope.loginTime == 'absolute') {
                        if ($rootScope.startedOn == null) {
                            $rootScope.startedOn = new Date($scope.getClock());
                            $rootScope.absFirstQuizStart = true;
                        }
                        $scope.session_begin_time = new Date($rootScope.startedOn);
                    } else {
                        $scope.session_begin_time = new Date($scope.getClock());               
                        //not sure this block-aamir
                        if($scope.isStarted){ 
                            $scope.session_begin_time.setSeconds($scope.session_begin_time.getSeconds() - $scope.timeUsed);
                        }                    
                    }

                    //it show when user start the quiz
                    let meStartQuiz = $filter("toLocalTime")(meStartQuizOn);
                    $scope.meStartQuizMsg = $filter('findReplace')($scope.lang.caption_submitQuiz,{'###': meStartQuiz});
                    
                    
                    if($scope.setAndCheckEndTime()){
                        //$scope.isStarted= true;
                        $scope.notifyOrSubmit();
                    }else{
                        if(!$scope.isStarted){
                            $scope.qdeadLineNotOverButNotYetStart = true;
                        }
                        
                    }

                }                    

            }else{
                //db error handler
                requestService.dbErrorHandler(result.error.code,result.error.type);             
            }

            $timeout(function(){
                $scope.isLoad = true;
                if($("#switchQuiz")){
                    $("#switchQuiz").trigger('mouseover');
                }
            },1000);
 
        },function(errorResponse){
        dataService.swalAndRedirect('Unable to connect to the server. Make sure you are connected to the Internet','warning','btn-warning','serverErr');
        console.log('Server Error');
        console.log(errorResponse);
    });


    $scope.deadLineOver = false;
    $scope.notifyOrSubmit = function(){
        if($scope.isStarted){
            $('.overlay-div').css("visibility", "visible");
            window.scroll({
                top: 0
            });
            $("body").css("overflow", "hidden");
            
            $scope.autoSubmitCounter = 30;
            $scope.submitInterval = $interval(function(){
               $scope.autoSubmitCounter--;
               if( $scope.autoSubmitCounter==0){
                   $interval.cancel($scope.submitInterval);
                   $scope.quizFinalSubmit();
               }
               
            }, 1000);

        }else{
            helperService.notifyMsg('ti-alert', 'danger', $scope.lang.alert_afterQuizEnd, 'top', 'center');
            $scope.deadLineOver = true;
            $scope.qdeadLineNotOverButNotYetStart = false;
            $scope.quizTimerCounterEndMsg = false;
            //logout after 5 min if quiz deadline is over and not started quiz
            $timeout(()=>{
              dataService.loggoutWithReason('loggedOut');
            },300000);
        }
    }

    $scope.makeSummary =  function(){
       $scope.summaryData = [];
        if(dataService.getData('ISSECTION')){
           $scope.sections.forEach(function(sec){
              var secObj = {};
              secObj.secId = sec.sectionId;
              secObj.secTitle = sec.secTitle;
              if($scope.secSummary.hasOwnProperty(sec.sectionId))
              {
                var msec = $scope.secSummary[sec.sectionId].time;
                var hh = Math.floor(msec/60/60);
                msec -= hh  * 60 * 60;
                var mm = Math.floor(msec/ 60);
                msec -= mm  * 60;
                var ss = Math.floor(msec);
                msec -= ss ;

                 hh = hh<10?'0'+hh:hh;
                 mm = mm<10?'0'+mm:mm;
                 ss = ss<10?'0'+ss:ss;

                secObj.timeTaken = hh+':'+mm+':'+ss;
                secObj.attempted = $scope.secSummary[sec.sectionId].attempted;
                secObj.skipped = $scope.secSummary[sec.sectionId].skipped;
                secObj.ungradeable = $scope.secSummary[sec.sectionId].ungraded;
                secObj.totalContent = $scope.secSummary[sec.sectionId].total;

                secObj.totalGraded = $scope.secSummary[sec.sectionId].totalGraded;
                secObj.gradeAbleAttempted = $scope.secSummary[sec.sectionId].gradedAttempted;
                secObj.gradedSkip = $scope.secSummary[sec.sectionId].gradedSkip;
                
                secObj.isEnter = true;
              }else{
                 secObj.isEnter = false;  
              }
              $scope.summaryData.push(secObj);
              

           });          

       }

       $('#secQuizSummaryMdl').modal('show');
    
   }


   $scope.showSubmitBtnOnInst = function(){
        if(dataService.getData('ISSECTION')==true){
            if($scope.isStarted){
              return true;
            }
            else{
                return false;
            }
        }   
        else{
            return false;
        }
   }


    //correct ans gradingMatrix 0 index
    //skip ans gradingMatrix 1 index
    //wrong ans gradingMatrix 2 index

    $scope.chkEndDate = function () {
        var d = new Date($scope.getClock());
        var endDt = new Date($rootScope.ETIME);
        if (d < endDt) {
            return false;
        } else {
            return true;
        }
    }


    $scope.isSubmitClick =  false;
    $scope.quizFinalSubmit = function(){
        
        //"clear timer"- Because it will call even if we change route in SPA ---aamir
        $interval.cancel($scope.submitInterval);
        $scope.isSubmitClick =  true;
        var data = {
            quizId : dataService.getData('QUIZID'),
            uname : dataService.getData('USER'),
            isSection: dataService.getData('ISSECTION'),
            submitReason : $scope.submitType()
        }
        $(".pageLoader").show();
        requestService.request('POST',true,'/submitQuiz',data).then(function(response){
            var result = response.data;
            $rootScope.consoleData(result,'/submitQuiz-sc');   
            $rootScope.updateTime(result.time);
            $scope.isSubmitClick =  false;
            if(result.status){
                dataService.setData('ATTEMPT', true);
                if ($scope.chkEndDate()) {                    
                    dataService.setData('VIEWRES',true);
                }
                
                ////close overlay////                
                $('.overlay-div').css("visibility", "hidden");
                $("body").css("overflow","");
                $('#secQuizSummaryMdl').modal('hide');
                //////////////////////
                $scope.proceedBtnDisableSQ = true; // enable route
                $location.path('quiz-summary');
            }else{
                // var msg = "Connection to the server is lost.Please login and resubmit your quiz";
                // dataService.swalAndRedirect(msg,'warning','btn-warning','loggedOut');
                requestService.dbErrorHandler(result.error.code,result.error.type);
                $(".pageLoader").fadeOut("slow");
            }
        },function(errorResponse){
            console.log('Server Error');
            console.log(errorResponse);
            $(".pageLoader").fadeOut("slow");
            dataService.swalAndRedirect('Unable to connect to server','warning','btn-warning','serverErr');
            $scope.isSubmitClick =  false;
        })

    }
    
   
    
    $scope.submitQuiz =  function(){
        swal({
            title:  $scope.lang.caption_sure,
            text: $scope.lang.caption_restartWarning,
            type: 'warning',
            showCancelButton: true,
            confirmButtonClass: 'btn btn-success btn-fill',
            cancelButtonClass: 'btn btn-danger btn-fill',
            confirmButtonText: $scope.lang.caption_yes,
            cancelButtonText : $scope.lang.caption_cancel,
            buttonsStyling: false
        }).then(function() {
            isManualSubmit = true;
            $scope.quizFinalSubmit();
        },
        function() {});       
    }

    $scope.checkCurrTimeWithEndTime = function(){
        var endTime = new Date($rootScope.ETIME);
        var currentTime = $scope.getClock(); 
        if(currentTime>endTime){
            return true;
        }else{
            return false;
        }
    }

    // to proceed to quiz on clicking proceed button on instruction page
    $scope.proceedBtnDisableSQ = false;
    $scope.proceedButton = function (quizid) {
        if($scope.checkCurrTimeWithEndTime()){
            $scope.notifyOrSubmit();
        }else{
            $scope.proceedBtnDisableSQ = true;
            $rootScope.activeQuiz =  quizid;
            $location.path('quiz');
        }
    }

    $scope.resumeQuiz = function(e,quizid){
        e.preventDefault();
        e.stopPropagation();
        $scope.proceedButton(quizid);
    }
  
    $scope.showSecIntruction = function(){
        var isSection = dataService.getData('ISSECTION');
        if(isSection==true)
        {   
            if($scope.sections.length==1)
            {
                 return true; 

            }else
             return  false;
        }else        
            return false;

    }
    
    $scope.$on("changeUILanguage",function(e,data){       
        $scope.lang = data.language; 
    })

    $scope.checkLoginEmail = function(){
        return sessionStorage.getItem('loginToken')?true:false;
    }

}]);

