//"use strict";
//Quiz-Controller: quizCtrl starts from here
app.controller('liveQuizCtrl', ['$scope','$timeout', '$interval', '$compile','$rootScope','$location','dataService','helperService','requestService','$window','$state','$cookies','$sce', function ($scope,$timeout, $interval, $compile, $rootScope,$location,dataService,helperService,requestService,$window,$state,$cookies,$sce) {
    const version = 5.4;
    $scope.lang = $rootScope.language;    
    //variable declartions;
    $scope.quizState = 'notStart'; 
    //notStart/question/wait/quizInst/sectionInst/ansOnly/ciAns/statAns/all/ciOnly/statCI/statOnly/offline
    $scope.btnConnect = false;
    var quizId = dataService.getData('QUIZID');
    var studentId = dataService.getData('USER');    
    var token = dataService.getData('TOKEN');

    var startInterval,btnInterval,authInterval;
    var startCounter = 0;
    var btnCounter = 0;
    var timer;    
    var w;
    $scope.maxShapeAllowed = 30;
    let socketStatus = 'disconnect';  
    $scope.infiniteTime = 900000;
    $scope.hh = "00";
    $scope.mm = "00";
    $scope.ss = "00";
    $scope.flashCards = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
    $scope.isAnswerGiven = false; //set true when answer is given

    //it is use only load fill type questions otherwise no use
    $scope.currentPage = 1;
    $scope.questions= [{}];

    $scope.showYoutubeVidBtn = false;
    $scope.showYoutubeChatBtn = false;
    $scope.showWiteBoardBtn = false;
    $scope.currentSection = -1;
    //end of variables declartions;
    $scope.changeRoute = false;
    $scope.$on('$stateChangeStart', function(e, toState, toParams, fromState, fromParams) {
        if(!$scope.changeRoute){
            if(fromState.name=='livequiz' && toState.name=='root')
            {
                 e.preventDefault();   
                 history.pushState(null,null, window.location.origin + window.location.pathname+"#livequiz");                
                 swal({
                     text: 'Back button is disabled.',
                     buttonsStyling: false,
                     confirmButtonClass: "btn btn-warning btn-fill"
                 });
                 
            }
            if(fromState.name == 'livequiz' && toState.name =='quizList'){
                if(startInterval){
                    $interval.cancel(startInterval);
                }
                //clear timer
                $scope.cancelTimerData();
                
            }
        }
         
    });

   
    $scope.sectionInst = $rootScope.sections; // dataService.getData('InstData'); 
    $scope.secStatus = {};
    for(let i = 0; i<=$scope.sectionInst.length-1; i++){
        $scope.secStatus[i] = false;
    }
   
    /***Calculator */
    $("#calc").draggable({
        containment: "#lqBodyId"
    });

    $("#calc").css({'top': 58, 'left' : 0});
    
    $scope.calculatorType = function(){        
        if($scope.calcType!='none')
          return true;
        else 
          return false;        
    }


    $scope.isQuestionTypeContent = function(){
        if($scope.quizState=='question'){
            if ($scope.filteredQuestions.type != 'info') {
                return true;
            }else{
                return false;
            }
        }else{
            return false;
        }
    }

    $scope.isQuestionInfoType = function(){
        if($scope.quizState=='question'){
            if ($scope.filteredQuestions.type == 'info') {
                return true;
            }else{
                return false;
            }
        }else{
            return false;
        }
    }

    $scope.calc = function () {        
        $("#calc").css("display", "block");
        $('#display').focus();
    }

    $scope.closeCal = function(){
        $("#output").html('');
        $("#display").val('');
        $("#calc").fadeOut('slow');
    }
    
    $scope.closeInfo = function (id) {
        $("#" + id).toggle();
    }

    /***End of Calculater */
   
    //on focus change
    if(!$scope.allowFC){
        $(window).on('blur', function () {
            
            if ($('iframe').is(':focus')) {
                console.warn('focus shifted to iframe');
            }
            else {
                socketStatus = 'focusChange'
                let msg = $rootScope.language.alert_changedWindowFocus;
                if(!msg){
                msg = $rootScope.language.caption_reloadLogout;
                }
                dataService.swalAndRedirect(msg,'warning','btn-warning','windowChanged');        
            }
        });
    }

    $scope.cancelTimerData = function(){
        console.log("cancelTimerData");
       
        // if(timer){
        //     $interval.cancel(timer); 
        // }

        if(typeof(w) != "undefined") {
            w.terminate();
            w = undefined;
        }
    }

    $scope.startTime = function(){
        $scope.cancelTimerData();

        if($scope.time !=$scope.infiniteTime){   
            //aakT                    
            
            w = new Worker("app/controllers/stdTimeInterval_sw.min.js");
            w.onmessage = function(event) {
                $scope.$apply(function(){
                        //console.log(event.data);
                    $scope.time -= 1000;
                    var millis = $scope.time;            
                    var hh = Math.floor(millis / 36e5);
                    $scope.hh  = hh<10?"0"+hh:hh;           
                    var mm = Math.floor((millis % 36e5) / 6e4);
                    $scope.mm  = mm<10?"0"+mm:mm;
                    var ss = Math.floor((millis % 6e4) / 1000);
                    $scope.ss  = ss<10?"0"+ss:ss;
                    
                    if (hh < 0 ) {
                        $scope.cancelTimerData();
                        $scope.pauseQuiz();
                    }

                });
                
            }
            w.onerror = function() {
                console.log('There is an error with your worker!');
                $scope.$digest();
            }
        }else{
            $scope.hh = "00";
            $scope.mm = "00";
            $scope.ss = "00";
        }

        let lqTimerClock = $("#lqTimerClock");
        setTimeout(()=>{
            lqTimerClock.animate({fontSize: '1.1em'}, "slow");
            lqTimerClock.animate({fontSize: '1em'}, "slow");
        },800);
    }

    $scope.checkInReviewMode = function(){
        let allowStatus = ['ansOnly','ciAns','statAns','all','ciOnly','statCI'];
        return allowStatus.includes($scope.quizState);
    }

    $scope.checkInAnsMode = function(){
        let allowStatus = ['ansOnly','ciAns','statAns','all'];
        return allowStatus.includes($scope.quizState);
    }

    $scope.checkInStatsMode = function(){
        let allowStatus = ['statAns','all','statCI','statOnly'];
        return allowStatus.includes($scope.quizState);
    }

    
    //score = correct | incorrect
    $scope.checkInScoreMode = function(){
        let allowStatus = ['ciAns','all','ciOnly','statCI'];
        return allowStatus.includes($scope.quizState);
    }


    $scope.getTime = function () {
        var d = new Date($scope.getClock());
        return d;
    }

    $scope.getStartTime = function () {       
        var d = $scope.getTime();
        $scope.Stime = d;
    }

    $scope.getEndTime = function () {      
        var d = $scope.getTime();
        $scope.Etime = d;
    }
    $scope.getTimeDiff = function () {
        var now = $scope.Stime;
        var then = $scope.Etime;
        var d = then - now;       
        return d;
    }

    $scope.getTotalTime = function () {       
         $scope.timeTaken = $scope.timeTaken + ($scope.getTimeDiff() / 1000);
    }

    // end of time function

    $scope.validateForm = function () {
        console.log("F-validateForm");
        var inputCount = document.getElementById('divFillInBlank').getElementsByTagName('input').length;//get the number of input tags
        var temp = false;
        let fillIn = 'allBlank';
        for (var i = 0; i < inputCount; i++) {
            var name = document.getElementById('divFillInBlank').getElementsByTagName('input')[i].getAttribute("name");
            var value = document.getElementsByName(name)[0].value;
            if (value === "") {
                temp = true;
            }else{
                fillIn = 'partialFill';
            }
        }
        
        let obj = {
            status: false,
            msg:''
        }
        //partial grading is allow
        if($scope.sectData.partialGrading){
            if(fillIn == 'partialFill'){
                obj.status = true;
            }else{
                obj.status = false;
                if(inputCount == 1){
                    obj.msg = $scope.lang.alert_FillIN;
                }else{
                    obj.msg = $scope.lang.alert_FillINPartial;
                }
                
            }
        }else{
            if(temp){
                obj.status = false;
                obj.msg = $scope.lang.alert_FillIN;
            }else{
                obj.status = true;
            }
           
        }
        return obj;
    }

    
    $scope.Lock = function () {
        console.log("F-Lock");
        // for fill In type Questions
        if ($scope.filteredQuestions.type == 'fillIn') {
                let fillinData = $scope.validateForm()
                if (!fillinData.status) {//check wheterher all the blanks are filled
                    let option = {
                        placement : {
                            from: "top",
                            align: "center"
                        },
                        delay: 2000
                    };
                    $scope.notifyAlertMsg('lock',fillinData.msg,option);

                    $scope.lock = false;
                    return false;
                }
                else {
                    
                    var inputCount = document.getElementById('divFillInBlank').getElementsByTagName('input').length;
                    var temp = {};
                    for (var i = 0; i < inputCount; i++) {
                        // find the name and value of the input tag.
                        var name = document.getElementById('divFillInBlank').getElementsByTagName('input')[i].getAttribute("name");
                        //Added By: ABHIMANYU
                        var type = document.getElementById('divFillInBlank').getElementsByTagName('input')[i].getAttribute("type");
                        var value = document.getElementsByName(name)[0].value;
                        if (type == 'number') {
                            value = parseFloat(value);
                            temp[name] = value;
                        } else if (type == 'text') {
                            temp[name] = value;
                        }
                    }
                    $scope.selectAns(temp);
                    
                    var newtemp = JSON.stringify(temp);
                    $scope.tempAns = JSON.parse(newtemp);
                    
                    $scope.lock = true;
                    return true;
                }
            
        }
        else if ($scope.filteredQuestions.type == 'arrange') { // For arrange type questions.
           
                var tmp = [];
                tmp = $scope.arrangeType;
                for (var i = 0; i < tmp.length; i++) {
                    tmp[i] = Math.abs(tmp[i]);
                }
                $scope.selectAns($scope.arrangeType);//store the answer. 
                //This store temporary ans
                $scope.tempAns = $scope.arrangeType;
                $scope.lock = true;//set locked    
                return true;        
            
        }
        else if ($scope.filteredQuestions.type == 'mcq') {
           
                if ($scope.tempAns == -1) {
                    let option = {
                        placement : {
                            from: "top",
                            align: "center"
                        },
                        delay: 2000

                    };
                    $scope.notifyAlertMsg('lock',$scope.lang.alert_mcqSelect,option);
                    return false;
                } else {
                    $scope.lock = true;
                    $scope.selectAns($scope.tempAns);
                    return true;
                }
            
        }
        else if ($scope.filteredQuestions.type == 'info') {
                $scope.lock = true;
                $scope.selectAns($scope.tempAns);
                return true;
        }else if ($scope.filteredQuestions.type == 'sub') {
            $scope.subDBStatus = 'none';
            $scope.clearNotifyAlert('maxSubShape');

            if ($scope.tempAns != -1) {
                if('text' in $scope.tempAns){
                    let charCount = $scope.countCharacter( $scope.tempAns['text']);
                    if(charCount>$scope.filteredQuestions.object.limit){
                        $scope.notifyAlertMsg('ck',$scope.lang.alert_subjective_limit); 
                        return false;
                    }
                }
           }
            $scope.lock = true;
            $scope.selectAns(1);
            return true;
                
            
        }
    }

    $scope.submitAns = function(){
        console.log("F-submitAns");
        token = dataService.getData('TOKEN');
        if($scope.Lock()){    
            $scope.disableTimerAfterSubmit(true);
            $scope.getEndTime();
            $scope.getTotalTime();
            $scope.makeResponse(true);            
            $scope.isAnswerGiven = true;     
            $scope.scrollUp();  
            $("#lqFabCheck").prop('checked', false); 
            socket.emit('std_lqSubmitAns',{studentId:studentId,quizId:quizId,stdAns:$scope.response,token:token});
        }
        
    }

    $scope.iViewedInfo = false;
    let iViewNotify = null;
    $scope.iViewDisable = false;
    $scope.iViewed = function(){
        console.log("F-iViewed");
        token = dataService.getData('TOKEN');
        if(iViewNotify){
            iViewNotify.close();
            iViewNotify = null;
        }

        iViewNotify = $.notify({
            icon: 'ti-info',
            message: $scope.lang['msg_viewed_infoContent']
            },{
                type: 'info',
                delay: -1,
                newest_on_top:true,
                placement: {
                    from: "top",
                    align: "center"
                },
                offset : {
                  y : 55
                },
                onShow : function(){
                    $scope.iViewDisable = true;
                    $(this).css({'top':55});
                },
                onClose : function(){
                        $scope.iViewDisable = false;
                }
        });

        if($scope.iViewedInfo){
            return;
        }

        if($scope.Lock()){  					
            console.log("I viewed");
            $scope.getEndTime();
            $scope.getTotalTime();
            $scope.makeResponse(true);    
            $scope.iViewedInfo = true;
            $scope.isAnswerGiven = true;
            socket.emit('std_lqSubmitAns',{studentId:studentId,quizId:quizId,stdAns:$scope.response,token:token});
        }
        
    }

    $scope.scrollUp = function(){
        $(".lqContent").animate({ scrollTop: 0 },0);
            setTimeout(function(){
                var hT = $('#waitDiv').offset().top;
                $(".lqContent").animate({ scrollTop: hT }, 500);
            },0)
    }
    

    $scope.makeResponse = function(lock){
        $scope.response = {};
        $scope.response.ref = $scope.filteredQuestions.ref;
        $scope.response.type = $scope.filteredQuestions.type;
        $scope.response.review = 0;
        $scope.response.timeTaken = $scope.timeTaken;
        $scope.response.helpUsed = $scope.hintUsed;
        $scope.response.lock = lock;
        if($scope.filteredQuestions.type == 'sub'){
            $scope.response.answerId = lock?1:-1;
        }else{
            $scope.response.answerId = lock? $scope.answSelected :-1;
        }
        
        $scope.response.tempAns = $scope.tempAns;        
        //console.log($scope.response);
    }


    $scope.submitDefaultAns = function(){  
        console.log("F-submitDefaultAns");
        token = dataService.getData('TOKEN');      
        $scope.getEndTime();
        $scope.getTotalTime();
        $scope.makeResponse(false);
        $scope.scrollUp();   
        $("#lqFabCheck").prop('checked', false);
        socket.emit('std_lqSubmitAns',{studentId:studentId,quizId:quizId,stdAns:$scope.response,token:token});
    }

    $scope.pauseQuiz = function(){
        console.log("F-pauseQuiz");
        if($scope.quizState=="question"){

           if(!$scope.isAnswerGiven){
               $scope.submitDefaultAns();
           } 
        }
        $scope.disableTimer(true);       
    }
    

    $scope.disableTimerAfterSubmit = function(btnConnect){
        console.log("F-disableTimerAfterSubmit");
        if(btnConnect){
            $scope.btnConnect = false;
            btnCounter = 0;
            if(btnInterval){
                $interval.cancel(btnInterval);
            }
        }

        if(startInterval){
           $interval.cancel(startInterval);
        }
        $scope.iViewedInfo = false; 
        $scope.quizState = 'wait';
        
        $scope.closeHelp('quiz-hint');
        $scope.closeHelp('quiz-explanation');

        if($('#closeOverlay').length>0){
            $('#closeOverlay').click();
        }
        $scope.closeCal();
    }

    $scope.disableTimer = function(btnConnect){
        console.log("F-disableTimer");
        if(btnConnect){
            $scope.btnConnect = false;
            btnCounter = 0;
            if(btnInterval){
                $interval.cancel(btnInterval);
            }
        }

        if(startInterval){
           $interval.cancel(startInterval);
        }

        if(iViewNotify){
            iViewNotify.close();
            iViewNotify = null;
        }
        $scope.iViewDisable = false;

        $scope.isAnswerGiven = false;
        $scope.iViewedInfo = false; 
        $scope.subDBStatus = 'none';
        $scope.showSubAddRow = false;
        $scope.cancelTimerData();
        $scope.quizState = 'wait';
        $scope.hh = "00";
        $scope.mm = "00";
        $scope.ss = "00";
        $scope.time = 0;
        $scope.closeHelp('quiz-hint');
        $scope.closeHelp('quiz-explanation');

        $.notifyClose();
        notifyAlert = {};

        if($('#closeOverlay').length>0){
            $('#closeOverlay').click();
        }
        $scope.closeCal();

    }

    $scope.stopQuizClock = function(){
        console.log("stopQuizClock");
        $scope.cancelTimerData();
        $scope.hh = "00";
        $scope.mm = "00";
        $scope.ss = "00";
    }

   
    $scope.checkQuizIsLive = function(){
        console.log("F-checkQuizIsLive");
        if(startInterval){
            $interval.cancel(startInterval);
        }
        
        $scope.quizState = 'notStart';
        startInterval = $interval(()=>{
            startCounter++;
            if(startCounter%15==0){                
                $scope.joinQuiz();                        
            }
            //loggout automatically after 10 minute if user is not connected
            if(startCounter>=10*60){
                $interval.cancel(startInterval);
                startCounter=0;
                $scope.loggedOut();
            }
        },1000);
    }

    $scope.getSectionInstr = function(sec){
        console.log("F-getSectionInstr");
        var sectionId = quizId+"-"+studentId+"-"+sec;
        var secIndex =  $scope.sectionInst.findIndex(x=>sectionId==x.sectionId);
        $scope.currentSection = secIndex;
        return $scope.sectionInst[secIndex];
    }

    $scope.loadResponseExample = function () {
        
            if ($scope.filteredQuestions.type === 'example') {
                for (var j = 0; j < $scope.filteredQuestions.object.rate.length; j++) {
                    $scope.filteredQuestions.object.rate[j].Selected = false;
                }
                if ($scope.tempAns != -1) {
                    $scope.filteredQuestions.object.rate[$scope.tempAns - 1].Selected = true;
                }
            }
        
    }

    $scope.loadResponseMcq= function(){
            if ($scope.filteredQuestions.type === 'mcq') {
                for (var j = 0; j < $scope.filteredQuestions.object.options.length; j++) {
                    $scope.filteredQuestions.object.options[j].Selected = false;
                }
                
                if ($scope.tempAns != -1) {
                    $scope.filteredQuestions.object.options[$scope.tempAns - 1].Selected = true;
                }
            }
        
    }

    $scope.loadResponseArrange = function () {
       
            if ($scope.filteredQuestions.type === 'arrange') {           
                if ($scope.tempAns != -1) {
                    var tmp = [];
                    tmp = angular.copy($scope.tempAns);
                    for (var j = 0; j < tmp.length; j++) {
                        tmp[j] = Math.abs(tmp[j]);
                    }
                    $scope.arrangeType = tmp;
                }
                else {
                    var temp = [];
                    for (var j = 0; j < $scope.filteredQuestions.object.items.length; j++) {
                        temp[j] = j + 1;
                    }
                    $scope.arrangeType = temp;
                }
            }
        
    }

    $scope.loadResponseFillIn= function(){
       
        if ($scope.filteredQuestions.type === 'fillIn') {
            let divFillInBlank = document.getElementById('divFillInBlank');
            if(divFillInBlank){
                var inputCount = document.getElementById('divFillInBlank').getElementsByTagName('input').length;
                for (var i = 0; i < inputCount; i++) {
                    // find the name and value of the input tag.
                    var name = document.getElementById('divFillInBlank').getElementsByTagName('input')[i].getAttribute("name");
                    $scope.questions[$scope.currentPage -1] = $scope.filteredQuestions;
                    $scope.questions[$scope.currentPage - 1].object[name] = $scope.tempAns[name];
                  
                }
            }
            
        }
    }

    $scope.setUpQuestionWithAns = function(data,isShow){
        $scope.quizMode = 'review';
        $scope.queslsSubKey = `${quizId}${studentId}${data.meta.secId}${data.meta.quesId}`.toLowerCase();
        $scope.filteredQuestions = data.stdAns.quizData;
        if(data.stdAns.hasOwnProperty('response')){
            $scope.allowPartialGrading = false;
            if('partialGrading' in $scope.sectionInst[data.meta.secId-1]){
                $scope.allowPartialGrading =  $scope.sectionInst[data.meta.secId-1].partialGrading;
            }

            $scope.ansHelpAllowed = $scope.sectionInst[data.meta.secId-1].helpAllowed;
            
            $scope.attendQuestion = true;
            $scope.isAttempt = data.stdAns.response.lock;  // if question is lock then it is attempted          
            $scope.timeTaken = data.stdAns.response.timeTaken;            
            $scope.hintUsed = data.stdAns.response.helpUsed;
            $scope.answSelected = data.stdAns.response.answerId;
            $scope.tempAns = data.stdAns.response.tempAns;
            $scope.lock = data.stdAns.response.lock; 
            $scope.score = data.stdAns.response.score;
            $scope.partial = 0;
            if('partial' in data.stdAns.response){
                $scope.partial =  data.stdAns.response.partial;
            } 

            if($scope.allowPartialGrading){
                $scope.score = $scope.score + $scope.partial;
            }
            $scope.correctAns = data.stdAns.response.correctAns;

            let gradeindex = data.stdAns.response.gradingIndex;
            if(gradeindex[0]==0 && (gradeindex[1]==0 || gradeindex[1]==1 || gradeindex[1]==2)){
              $scope.correctAnsGiven= true;
            }else{                
                $scope.correctAnsGiven= false;
            }
            $scope.loadResponseExample();
            $scope.loadResponseMcq();
            $scope.loadResponseArrange();
            $timeout(function () { $scope.loadResponseFillIn(); }, 1500);

        }else{
            $scope.attendQuestion = false;
            $scope.isAttempt = false;            
            $scope.timeTaken = 0;            
            $scope.hintUsed = 0;
            $scope.answSelected = -1;
            $scope.tempAns = -1;
            $scope.lock = false;

            if ($scope.filteredQuestions.type === 'arrange') {
            
                var temp = [];
                for (var j = 0; j < $scope.filteredQuestions.object.items.length; j++) {
                    temp[j] = j + 1;
                }
                $scope.arrangeType = temp; 
                                                  
            }
    
        }

        

        if(isShow){
            $scope.quizState =  data.meta.type;
        }

    }


     // load response of subjective 
     $scope.countCharacter = function(strData){
        let str = strData.toString();
        str = str.replace(/[&]nbsp[;]/gim," ")
        let finalStr = str.replace( /(<([^>]+)>)/igm, '');
        return finalStr.length;  
    }

    let ckTypeInterval = null;

    let notifyAlert = {};
    $scope.clearNotifyAlert = function(type=0){
        if(type == 0){
            $.notifyClose();
            notifyAlert = {};
        }else{
            if(notifyAlert[type]){
                notifyAlert[type].close();
                notifyAlert[type] = undefined;
            }
        }
    }

   
    $scope.notifyAlertMsg = function(key,msg,option={}){
        if(!notifyAlert[key]){
            let placement = {
                from: "top",
                align: "right"
            }
            if('placement' in option){
                placement = option.placement;
            }
            let delay = -1;
            if('delay' in option){
                delay = option.delay
            }

            let type = 'warning';
            if('type' in option){
                type = option.type;
            }

            let icon = "ti-alert";
            if('icon' in option){
                icon = option.icon;
            }

            notifyAlert[key] = $.notify({
                icon: icon,
                message: msg
                },{
                type: type,
                newest_on_top:true,
                delay: delay,
                placement: placement,
                onClose : function(){
                    notifyAlert[key] = undefined;
                }
            });
        }
    }

    $scope.setUpQuestion = function(data,isStart){
        console.log("setUpQuestion");
        $scope.quizMode = 'quiz';
        $scope.queslsSubKey = `${quizId}${studentId}${data.meta.secId}${data.meta.quesId}`.toLowerCase();
        $scope.filteredQuestions = data.quizData;
        $scope.isReviewQuestions = 0;
        $scope.timeTaken = 0;
        $scope.Stime = 0;
        $scope.Etime = 0;
        $scope.hintUsed = 0;
        $scope.answSelected = -1;
        $scope.tempAns = -1;
        $scope.lock = false;
        
        $scope.sectData = $scope.getSectionInstr(data.meta.secId);
        $scope.helpAllowed = $scope.sectData.helpAllowed;
        
        if ($scope.filteredQuestions.type === 'arrange') {
            var temp = [];
            for (var j = 0; j < $scope.filteredQuestions.object.items.length; j++) {
                temp[j] = j + 1;
            }
            $scope.arrangeType = temp; 
                                              
        }

        if ($scope.filteredQuestions.type === 'fillIn') {
            $scope.questions= [{}]; 
            // if($scope.sectData.partialGrading){
            //     let option = {
            //         placement : {
            //             from: "top",
            //             align: "center"
            //         }
            //    };
            //    $scope.notifyAlertMsg('partialBlankInfo',$scope.lang.msg_partialBlanks,option);
            // }

        }
        
        if($scope.filteredQuestions.type === 'sub'){
            if($(".divOverLay").length>0){
                $(".divOverLay").show();
            }
        }

        if(isStart){
            if(data.ansGiven){
                if($scope.filteredQuestions.type === 'info') {
                    $scope.iViewedInfo = true;
                    $scope.quizState = "question";   
                    $scope.startTime();
                    $scope.getStartTime();
                }else{
                    $scope.startTime();
                }
                $scope.isAnswerGiven = true;
                
            }else{
                $scope.quizState = "question";   
                $scope.startTime();
                $scope.getStartTime();
            }
            
        }
    }

    $scope.initNumOfFillins = function(){
        $scope.numFillIns = 0;
        $timeout(()=>{
            $scope.numFillIns = document.getElementById('divFillInBlank').getElementsByTagName('input').length;
        },800);
    }

    $scope.setUpQuizInst = function(data,isStart){
         console.log('F-setUpQuizInst');
        if(isStart){
            $scope.quizState = "quizInst";             
            $scope.loadOtherMedia();    
            $scope.startTime();        
        }
    }

    $scope.setUpSecInst = function(data,isStart){
        console.log('F-setUpSecInst');
        $scope.selectSection = data.meta.secId;
        $scope.sectData = $scope.getSectionInstr(data.meta.secId);
        if(isStart){
            $scope.quizState = "secInst";  
            $scope.loadOtherMedia();            
            $scope.startTime();            
        }
    }

    

    let chart1 = null;
    let chart2 = null;
    $scope.setUpStats = function(data,isShow){
        console.log("F-setUpStats");
        var secData = $scope.getSectionInstr(data.secId);        
        $scope.statsHelpAllowed = secData.helpAllowed;
        $scope.gradeStats = data.stats;

        if(chart1) {
            chart1.destroy();
        }

        if(chart2){
            chart2.destroy();
        }

        if(data.qtype === "sub"){
            const graphTitle = 'Question';
            const graphEleId = 'statsChart';
            const graphLabels = ['Attempted', 'Skipped'];
            //// graphData = totalAttempt ,totalSkipped //////
            const graphData = [$scope.gradeStats[0][3],$scope.gradeStats[1][3]];
            const graphColors = [
                '#7AC29A',
                '#EB5E28' 
            ];

            $scope.drawAnsQuestGraph(graphEleId,graphLabels,graphData,graphTitle,graphColors);
            const graphHintExplData1 = [
                $scope.gradeStats[2][0],
                $scope.gradeStats[2][1],
                $scope.gradeStats[2][2]
            ];
            const graphHintExplData2 = [
                $scope.gradeStats[2][0],
                $scope.gradeStats[2][1]
            ];
            const graphHintExplEle = 'answerChart';
            $scope.drawHintExplanGraph(graphHintExplEle,graphHintExplData1,graphHintExplData2);
        }else{

            const graphTitle = 'Answers';
            const graphEleId = 'statsChart';
            const graphLabels = ['Correct', 'Incorrrect', 'Skipped'];
            //// graphData = totalCorrect ,totalSkipped,totalIncorrect //////
            const graphData = [$scope.gradeStats[0][3],$scope.gradeStats[2][3],$scope.gradeStats[1][3] ];
            const graphColors = [
                '#7AC29A',
                '#EB5E28',
                '#68B3C8'            
            ];
            
            $scope.drawAnsQuestGraph(graphEleId,graphLabels,graphData,graphTitle,graphColors);
            const graphHintExplData1 = [
                $scope.gradeStats[3][0],
                $scope.gradeStats[3][1],
                $scope.gradeStats[3][2]
            ];
            const graphHintExplData2 = [
                $scope.gradeStats[3][0],
                $scope.gradeStats[3][1]
            ];
            const graphHintExplEle = 'answerChart';
            $scope.drawHintExplanGraph(graphHintExplEle,graphHintExplData1,graphHintExplData2);
        }

        if(isShow){
            $scope.quizState = data.type;
        }
         
    }

    $scope.drawAnsQuestGraph = function(graphEleId,graphLabels,graphData,graphTitle,graphColors){
        let statsChart = document.getElementById(graphEleId).getContext('2d');
        chart1 = new Chart(statsChart, {
            type:'pie', // bar, horizontalBar, pie, line, doughnut, radar, polarArea
            data:{
            labels:graphLabels,
            datasets:[{
                
                data:graphData,
                //backgroundColor:'green',
                backgroundColor:graphColors,
                borderWidth:1,
                borderColor:'#777',
                hoverBorderWidth:1,
                hoverBorderColor:'#000'
            }]
            },            
            options:{
                title:{
                    display:true,
                    text:graphTitle,
                    fontSize:14
                },
                legend:{
                    display:true,
                    position:'bottom',
                    align:'center',
                    labels:{
                    fontColor:'#000',
                    boxWidth:15,
                    fontSize:10,
                    padding:5
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                },       
                tooltips:{
                    enabled:true
                },
                responsive: true
            }


        });
    }

    $scope.drawHintExplanGraph = function(graphHintExplEle,graphHintExplData1,graphHintExplData2){
        if($scope.statsHelpAllowed>0 && $scope.statsHelpAllowed<=2){
            let chartlabel = 'Hint and explanation used';
            let answerChart = document.getElementById(graphHintExplEle).getContext('2d');
            let labels = ['No help used','Hint used','Hint and explanation Used'];
            let backgroundColor = [
                '#7AC29A',
                '#eac87d',
                '#68B3C8',            
                ];
            let data = graphHintExplData1

            if($scope.statsHelpAllowed==1){
                chartlabel = 'Hint used';
                labels = ['No Help Used','Hint Used'];
                data = graphHintExplData2;

                backgroundColor = [
                    '#7AC29A',
                    '#eac87d' 
                ];
            }

            chart2 = new Chart(answerChart, {
                type:'pie',
                data:{
                labels:labels,
                datasets:[{
                    
                    data:data,
                    //backgroundColor:'green',
                    backgroundColor:backgroundColor,
                    borderWidth:1,
                    borderColor:'#777',
                    hoverBorderWidth:1,
                    hoverBorderColor:'#000'
                }]
                },
                options:{
                    title:{
                        display:true,
                        text:chartlabel,
                        fontSize:14
                    },
                    legend:{
                        display:true,
                        position:'bottom',
                        align:'center',
                        labels:{
                        fontColor:'#000',
                        boxWidth:15,
                        fontSize:10,
                        padding:5
                        }
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    },       
                    tooltips:{
                        enabled:true
                    },
                    responsive: true
                }

            });
    
        }
    }

    $scope.setUpPlay = function(data,isStart){
        console.log("F-setUpPlay");
        let type = data.meta.type;
        $scope.time = data.meta.time;
        if(type=="question"){                        
            $scope.setUpQuestion(data,isStart);                       
        }
        if(type=="quizInst"){
            $scope.setUpQuizInst(data,isStart);
        }
        if(type=="secInst"){
            $scope.setUpSecInst(data,isStart);
        }

        if(type=="statOnly"){
            $scope.setUpStats(data.meta,isStart);
        }

       
        if(type=="ansOnly" || type=="ciOnly" || type=="statAns" || type=="all" || type=="statCI" || type=="ciAns"){
            $scope.setUpQuestionWithAns(data,isStart);
            if(type=="all" || type=="statAns" || type=="statCI"){
                $scope.setUpStats(data.meta,isStart);
            }
        }

    }

 
   
    // youtube chatbox,videbox
    let prevVidStatus = false;
    let prevChatStatus = false;
    let youtubeVidVar = null;
    let youtubeChatVar = null;
   
    $scope.setUpYoutubeBox = function(data){
        console.log("F-setUpYoutubeBox");
        if(data.hasOwnProperty('video') || data.hasOwnProperty('chat')){
            let isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);
            $scope.showYoutubeVidBtn = data.video;
            $scope.showYoutubeChatBtn = data.chat;

            if(data.video !== prevVidStatus){
                if(data.video){

                    if(youtubeVidVar){
                        $("#youtubeVideoBox").dialog('destroy');
                        youtubeVidVar = null;
                    }
                    youtubeVidVar = $("#youtubeVideoBox").dialog({
                        autoOpen: false,
                        open: function (event, ui) {
                            $('#youtubeVideoBox').css('overflow', 'hidden'); 
                            $(this).closest(".ui-dialog")
                            .find(".ui-dialog-titlebar-close")
                            .html("<span class='ui-button-icon-primary ui-icon ui-icon-closethick'></span>");
                        }
                    });

                    let vUrl = `https://www.youtube.com/embed/${data.youtubeId}?autoplay=1`;
                    /* let html = `<iframe src="${vUrl}" id="liveVideo" width="100%" height="100%" scrolling="no"  frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen  srcdoc="<style>*{padding:0;margin:0;overflow:hidden}html,body{height:100%}img,span{position:absolute;width:100%;top:0;bottom:0;margin:auto}span{height:1.5em;text-align:center;font:48px/1.5 sans-serif;color:white;text-shadow:0 0 0.5em black}</style><a href=https://www.youtube.com/embed/${data.youtubeId}?autoplay=1><img src=https://img.youtube.com/vi/${data.youtubeId}/hqdefault.jpg alt='Videobox'><span>â–¶</span></a>"></iframe>`; */
                 
                    let html = `<iframe id="liveVideo" width="100%" height="100%" scrolling="no"  src="${vUrl}" frameborder="0" allowfullscreen></iframe>`; 
                    $( "#youtubeVideoBox" ).html(html);

                   

                  $timeout(()=>{
                            $( "#youtubeVideoBox" ).dialog( "option", {
                                minWidth: 320,
                                minHeight: 180,
                                position: {
                                    my: "left top",
                                    at: "left top",
                                    of: "#lqSideScreen",
                                    collision: "fit fit"
                                }
                            });
                            $( "#youtubeVideoBox" ).dialog("open");
                    },2000);
                    
                    
                }else{
                    if(youtubeVidVar){
                        $("#youtubeVideoBox").dialog('destroy');
                        $( "#youtubeVideoBox" ).html("");
                        youtubeVidVar = null;
                    }
                }

                prevVidStatus = data.video;
            }
            
            if(data.chat !== prevChatStatus){
                if(data.chat){
                    let html = '';
                    if(isChrome){
                        let cUrl = `https://www.youtube.com/live_chat?v=${data.youtubeId}&embed_domain=${$rootScope.configData.domainUrl}`;
                        html = `<iframe src="${cUrl}" id="liveChat" width="100%" style="min-height:360px;height:100%"  frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                    }else{
                        html = `<strong> This feature works best in chrome browser.</strong>`;
                    }

                    if(youtubeChatVar){
                        $("#youtubeChatBox").dialog('destroy');
                        youtubeChatVar = null;
                    }

                    youtubeChatVar = $("#youtubeChatBox").dialog({
                        autoOpen: false,
                        open: function (event, ui) {
                            $('#youtubeChatBox').css('overflow', 'hidden'); 
                            $(this).closest(".ui-dialog")
                            .find(".ui-dialog-titlebar-close")
                            .html("<span class='ui-button-icon-primary ui-icon ui-icon-closethick'></span>");
                        }
                    });
                    $("#youtubeChatBox").html(html);
                    //$("#youtubeChatBox").css({display:'flex'});
                    $timeout(()=>{
                        $("#youtubeChatBox" ).dialog( "option", {
                            minHeight: 367,
                            minWidth: 300,
                            position: {
                               my: "right top",
                               at: "right top",
                               of: "#lqSideScreen",
                               collision: "fit fit"
                           }
                       });
                       $("#youtubeChatBox").dialog("open");
                     },2000);  
                   
                   
                }else{
                    if(youtubeChatVar){
                        $("#youtubeChatBox").dialog('destroy');
                        $( "#youtubeChatBox" ).html("");
                        youtubeChatVar = null;
                    }
                }
                prevChatStatus = data.chat;
            }
            
        }
             
    }

    $scope.openYoutubeVidBox = function(){
        console.log("F-openYoutubeVidBox");
        if(youtubeVidVar){
            $( "#youtubeVideoBox" ).dialog( "option", {
                minWidth: 320,
                minHeight: 180,
                width:320,
                height:180,
                position: {
                    my: "left top",
                    at: "left top",
                    of: "#lqSideScreen",
                    collision: "fit fit",
                    // using: function( pos, pos1 ) {
                    // }
                }
            });
            $( "#youtubeVideoBox" ).dialog("open");
        }
    }

    $scope.closeYoutubeBox = function(){
        console.log("F-closeYoutubeBox");
        if(youtubeVidVar){
            youtubeVidVar = null;
            $("#youtubeVideoBox").dialog('destroy');
            $( "#youtubeVideoBox" ).html("");
        }
        if(youtubeChatVar){
            youtubeChatVar = null;
            $("#youtubeChatBox").dialog('destroy');
            $( "#youtubeChatBox" ).html("");
        }
        
        prevVidStatus = false;
        prevChatStatus = false;
        $scope.showYoutubeVidBtn = false
        $scope.showYoutubeChatBtn = false;
    }

    $scope.openYoutubeChatBox = function(){
        console.log("F-openYoutubeChatBox");
        if(youtubeChatVar){
            //$("#youtubeChatBox").css({display:'flex'});
            $("#youtubeChatBox" ).dialog( "option", {
                height:372,
                position: {
                    my: "right top",
                    at: "right top",
                    of: "#lqSideScreen",
                    collision: "fit fit"
                }
            });
            $( "#youtubeChatBox" ).dialog("open");
        }
    }

    //end of youtube chatbox videobox

    $scope.divideView = function(st=false){
        if($scope.showYoutubeVidBtn || $scope.showYoutubeChatBtn || $scope.showWiteBoardBtn){
           if(st){
               $("#lqBodyId").addClass('lqBody');

               $("#lqrow1ExamineerLogo1").css({'display':'none'});
               $("#lqrow1lqTimer1").css({'display':'none'});
               $("#lqrow1lqDropDownDiv1").css({'display':'none'});
               
               $("#lqrow1lqTimer2").css({'display':'flex'});
               $("#lqrow1lqDropDownDiv2").css({'display':'flex'});
              
           }
           return true;
        }else{
           if(st){
               $("#lqBodyId").removeClass('lqBody');

               $("#lqrow1ExamineerLogo1").css({'display':'block'});
               $("#lqrow1lqTimer1").css({'display':'flex'});
               $("#lqrow1lqDropDownDiv1").css({'display':'flex'});

                $("#lqrow1lqTimer2").css({'display':'none'});
               $("#lqrow1lqDropDownDiv2").css({'display':'none'});

               
           }
           return false;
        }
    }


    $scope.$watch('[showYoutubeVidBtn,showYoutubeChatBtn,showWiteBoardBtn]', 
        function (newValue, oldValue){
            if( 
            (newValue[0] != oldValue[0]) || 
            (newValue[1] != oldValue[1]) || 
            (newValue[2] != oldValue[2])  ){
                if(newValue[0] || newValue[1] || newValue[2]){
                        if($("#quiz-hint").length>0){ 
                            $("#quiz-hint").removeClass("col-md-10 col-md-offset-1");
                        }
                        if($("#quiz-explanation").length>0){ 
                            $("#quiz-explanation").removeClass("col-md-10 col-md-offset-1");
                        }
                }
                if(!newValue[0] && !newValue[1] && !newValue[2]){
                    if($("#quiz-hint").length>0){ 
                        $("#quiz-hint").addClass("col-md-10 col-md-offset-1");
                    }
                    if($("#quiz-explanation").length>0){ 
                        $("#quiz-explanation").addClass("col-md-10 col-md-offset-1");
                    }
                    
                }
            }
    }, true);

    
    // white board
    let preWhiteboardStatus = false;
    let whiteboardVar =  null;
    $scope.setUpWhiteBoard = function(data){
        console.log("F-setUpWhiteBoard");
        $scope.showWiteBoardBtn = data;
        if(data !== preWhiteboardStatus){
            if(data){
                let vUrl =  `${$rootScope.configData.wbUrl}${quizId}`; 
                let html = `<iframe src="${vUrl}" id="whiteBoardIfrm"  style="min-width:660px;min-height:380px;max-height:100%; max-width:100%;"  frameborder="0" ></iframe>`;
                if(whiteboardVar){
                    $( "#whiteboardBox" ).dialog('destroy');
                    whiteboardVar = null;
                }

                whiteboardVar = $( "#whiteboardBox" ).dialog({
                    autoOpen: false,
                    resizable: false,
                    open: function (event, ui) {
                        $('#whiteboardBox').css('overflow', 'hidden'); 
                        $(this).closest(".ui-dialog")
                        .find(".ui-dialog-titlebar-close")
                        .html("<span class='ui-button-icon-primary ui-icon ui-icon-closethick'></span>");
                    }
                });
                $( "#whiteboardBox" ).html(html);
                
                $timeout(()=>{
                    $("#whiteboardBox").dialog( "option", {
                        height: 392,
                        width:642,
                        position: {
                            my: "left bottom",
                            at: "left bottom",
                            of: "#lqSideScreen",
                            collision: "fit fit"
                        }
                    });
                    $( "#whiteboardBox" ).dialog("open");
                },2000);
            }else{
                if(whiteboardVar){
                    $("#whiteboardBox").dialog('destroy');
                    $( "#whiteboardBox" ).html("");
                    whiteboardVar = null;
                }
            }

            preWhiteboardStatus = data;
        }
    }

    $scope.openWhiteboardbox = function(){
        if(whiteboardVar){
            let vUrl =  `${$rootScope.configData.wbUrl}${quizId}`; 
            let html = `<iframe src="${vUrl}" id="whiteBoardIfrm"  style="min-width:660px;min-height:380px;max-height:100%; max-width:100%;"  frameborder="0" ></iframe>`;
            $( "#whiteboardBox" ).html(html);
             
            $("#whiteboardBox").dialog( "option", {
                height: 392,
                width:642,
                position: {
                    my: "left bottom",
                    at: "left bottom",
                    of: "#lqSideScreen",
                    collision: "fit fit"
                }
            });
            $( "#whiteboardBox" ).dialog("open");
        }
    }

    $scope.closeWhiteBox = function(){
        if(whiteboardVar){
            whiteboardVar = null;
            $("#whiteboardBox").dialog('destroy');
            $( "#whiteboardBox" ).html("");
        }
        preWhiteboardStatus = false;
        $scope.showWiteBoardBtn = false;
    }

    //end of whiteboard


    $scope.openSecInstr = function(type,sec=1){
        console.log("F-openSecInstr");
        if(type=="quiz"){
            $("#quizInstuction").modal();
            for (const i in $scope.secStatus) {
                $scope.secStatus[i] = false;
            }
            if($scope.currentSection>=0){
                $timeout(()=>{
                    $scope.secStatus[$scope.currentSection] = true;
                },500)
                
            }
           
        }else
        if(type == "section"){
            $scope.sectionNumber = sec;
            $scope.sectData = $scope.getSectionInstr(sec);         
           // console.log($scope.sectData);   
            $("#secInstuction").modal()
        }
    }
    

    // step 2 : connect manually with quiz
    $scope.connectQuiz = function(){
        console.log("F-connectQuiz")
        $scope.btnConnect = true;
        btnInterval =  $interval(()=>{
            btnCounter++;
            if(btnCounter>=5){
                $interval.cancel(btnInterval);
                $scope.btnConnect = false;
                btnCounter=0;
            }            
        },1000)
        $scope.joinQuiz();

    }

    //set the hint used
    $scope.setHintUsed = function () {
        if ($scope.hintUsed == 0) {
            if ($scope.filteredQuestions.type != 'info') {
                $scope.hintUsed = 1;
            } else {
                let option = {
                    placement : {
                        from: "top",
                        align: "center"
                    },
                    delay: 2000
                };
                $scope.notifyAlertMsg('infoHint',$scope.lang.caption_hintInfo,option);
            }
            //$scope.hintUsed[id - 1] = 1;
        }
    }

    //set the explnation used.    
    $scope.setExpUsed = function () {
        if ($scope.filteredQuestions.type != 'info') {
            if ($scope.hintUsed == 1)
                $scope.hintUsed = 2;
        } else {
            let option = {
                placement : {
                    from: "top",
                    align: "center"
                },
                delay: 2000
            };
            $scope.notifyAlertMsg('infoExp',$scope.lang.caption_hintExpl,option);
        }
    }


    $scope.showHintFlag = false;
    $scope.showExpFlag = false;
    $scope.showHint = function () {
        var hint = `
            <div id="quiz-hint" class="col-xs-12  mydivs">
            <div class="card">
                <div class="card-header">
                    <div class="clear-fix">
                        <div class="pull-left">
                            <h4 class="card-title">{{lang.caption_hint}}</h4>
                        </div>
                        <div class="pull-right">
                        <span style="cursor:pointer;" class="label label-default" ng-click="closeHelp('quiz-hint')">&#10006;</span>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <br><hr>
                    <div class="help-content" >
                      <br>  
                      <span  math="{{ filteredQuestions.object.hint }}"></span>
                    </div>
                </div>
            </div>
          </div>
    `;

        

        if ($scope.showHintFlag == false) {
            let showDiv = true;
            if ($scope.filteredQuestions.type == 'info') {
                showDiv = false;
            }
            if (dataService.getData('ATTEMPT') == false) {
                if (showDiv) {
                    $("#quiz-infoRow").append($compile(hint)($scope));                    

                }
                $scope.setHintUsed();
                
            } else {
                if (showDiv) {
                    $("#quiz-infoRow").append($compile(hint)($scope));
                    
                }
            }
            $scope.showHintFlag = showDiv;
        }

        //////////add by aamir to scroll top;/////////
        if($("#quiz-hint").length>0)
        {   
            if(!$scope.divideView()){
                $("#quiz-hint").addClass("col-md-10 col-md-offset-1");
            }else{
                $("#quiz-hint").removeClass("col-md-10 col-md-offset-1");
            }

            $(".lqContent").animate({ scrollTop: 0 },0);
            $('.lqContent').animate({
                scrollTop: $("#quiz-hint").offset().top -126
           });

           
           
           
        }        
        
    }

    $scope.showExplanation = function () {
        var exp = `
            <div id="quiz-explanation" class="col-xs-12   mydivs">
            <div class="card">
                <div class="card-header">
                    <div class="clear-fix">
                        <div class="pull-left">
                            <h4 class="card-title">{{lang.caption_explanation}}</h4>
                        </div>
                        <div class="pull-right">
                        <span style="cursor:pointer;" class="label label-default" ng-click="closeHelp('quiz-explanation')">&#10006;</span>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <br> <hr>
                    <div class="help-content" >
                      <br> 
                      <span  math="{{ filteredQuestions.object.explanation }}"></span>
                    </div>
                </div>
            </div>
          </div>
    `;

        

        if ($scope.showExpFlag == false) {
            if (dataService.getData('ATTEMPT') == false) {
                if ($scope.hintUsed >= 1) {
                    $scope.setExpUsed();
                    $("#quiz-infoRow").append($compile(exp)($scope));
                    $scope.showExpFlag = true;
                } else {
                    let option = {
                        placement : {
                            from: "top",
                            align: "center"
                        },
                        delay: 2000
    
                    };
                    $scope.notifyAlertMsg('hintFirst',$scope.lang.msg_useHintFirst,option);
                }

                
            } else {
                $("#quiz-infoRow").append($compile(exp)($scope));
                $scope.showExpFlag = true;
            }
        }

        ////////add by aamir 11-03-2019 ///////////
        if($("#quiz-explanation").length>0)
        { 
            if(!$scope.divideView()){
                $("#quiz-explanation").addClass("col-md-10 col-md-offset-1");
            }else{
                $("#quiz-explanation").removeClass("col-md-10 col-md-offset-1");
            }

            $(".lqContent").animate({ scrollTop: 0 }, 0);
            $('.lqContent').animate({
               scrollTop: $("#quiz-explanation").offset().top-126
            });
          
        }
    }

    $scope.closeHelp = function (id) {
        if (id == 'quiz-hint') {
            $scope.showHintFlag = false;
        } else {
            $scope.showExpFlag = false;
        }

        if($("#"+id).length>0){
            $("#"+id).remove();
        }
    }

    $scope.getClockTime(); //fetch server clock time for sync
    $scope.joinQuiz = function(){
        console.log("F-joinQuiz");
        token = dataService.getData('TOKEN');  
        socket.emit('std_lqJoinQuiz', {quizId,token,studentId}, function(res) {
            $scope.$apply(function(){
                $scope.disableTimer(false);
                if(res.status=='live'){ 
                    startCounter = 0;

                    if(res.meta.hasOwnProperty('youtube')){
                        $scope.setUpYoutubeBox(res.meta.youtube);
                    }

                    $scope.setUpWhiteBoard(res.meta.whiteboard);

                    if(res.meta.playStatus=="play"){
                        $scope.setUpPlay(res,true);
                    }else{
                        if(res.error){
                            alert(res.error); //error
                        }
                    }

                    $scope.startVerifyAuthCounter();
                }else
                if(res.status=='notLive'){                    
                    $scope.checkQuizIsLive();
                }
                else
                if(res.status="authFailed"){
                    socketStatus = 'authFailed'
                    $scope.terminateQuiz(res.status,res.type);
                }
            });
           
        })
    }


    $scope.loggedOut = function () {
        console.log("F-loggedOut");
        $scope.changeRoute = true;
        dataService.loggoutWithReason('loggedOut');
    }

    $scope.getQuestionTemplate = () => {
        if($scope.quizState == 'question'){ 
                let templList = {
                    "mcq": "app/views/livequiz/mcq.html?v="+version,
                    "fillIn": "app/views/livequiz/fill.html?v="+version,
                    "arrange": "app/views/livequiz/arrange.html?v="+version,
                    "info": "app/views/livequiz/info.html?v="+version,
                    "sub": "app/views/livequiz/subjective.html?v="+version
                }
                if(!isNaN($scope.time)){
                    return templList[$scope.filteredQuestions.type];   
                }
        }
    }

    $scope.getQuestionWithTemplate = () => {
        if($scope.checkInReviewMode()){ 
                let templList = {
                    "mcq": "app/views/livequiz/mcq.html?v="+version,
                    "fillIn": "app/views/livequiz/fill.html?v="+version,
                    "arrange": "app/views/livequiz/arrange.html?v="+version,
                    "info": "app/views/livequiz/info.html?v="+version,
                    "sub": "app/views/livequiz/subjective.html?v="+version
                }
                
                 return templList[$scope.filteredQuestions.type];   
        }
    }

    $scope.onSelect = function (question, option, id) {   
        $scope.selectAns( id);            
        $scope.tempAns = id;
        question.object.options.forEach(function (element, index, array) {
            if (element.Id != option.Id) {
                element.Selected = false;
                question.Answered = option.isanswer;
            } else {
                element.Selected = true;
            }
        });
    }


    $scope.selectAns = function ( ansId) {
        $scope.answSelected = ansId;
    }

    $scope.sortListItems = function () {
        $('#arrOptions').sortable({
            update: function (event, ui) {
                $scope.getArray();
            },
            placeholder: "highlight"
        });
    }

    $scope.getArray = function () {
        var temp = $('#arrOptions').sortable('toArray');
        for (var i = 0; i < temp.length; i++) {
            temp[i] = Math.abs(temp[i]);
        }
        $scope.arrangeType = temp;
        $scope.selectAns($scope.arrangeType); //set the answer in our answer array.
        $scope.tempAns = $scope.arrangeType;
    }


    $scope.fillValue = function (name) {
        if ($scope.tempAns != -1) {
            var temp = $scope.tempAns;
        } else {
            var temp = {};
        }
        var type = $("input[name='" + name + "']").attr('type');
        var value = $("input[name='" + name + "']").val();
        if (type == 'number') {
            if (value == '') {
                let option = {
                    delay: 2000
                };
                $scope.notifyAlertMsg('numOnly',$scope.lang.msg_numericValueRequire,option);
            } else {
                temp[name] = parseFloat(value);
            }
        } else if (type == 'text') {
            temp[name] = value;
        }
        var newtemp = JSON.stringify(temp);
        $scope.tempAns = JSON.parse(newtemp);
    }

    $scope.initLQJquery = function (quizMode){  
        console.log("F-initLQJquery");      
        if(quizMode=='review'){            
            if($('#arrOptions').length>0){
                $("#arrOptions").sortable({
                    cancel: ".static"
                });
                $('#arrOptions').addClass("static");
            }
    
            if($('#inputBlankNumber').length>0){	
                $('[id=inputBlankNumber]').prop("disabled", true);
            }
    
            if($('#inputBlankText').length>0){	
                $('[id=inputBlankText]').prop("disabled", true);
            }
            
        }
        
        if(quizMode=='quiz'){
            if($('#arrOptions').length>0){
                $( "#arrOptions").sortable( "destroy" );
                $scope.sortListItems();
            }
    
            if($('#inputBlankNumber').length>0){	
                $('[id=inputBlankNumber]').prop("disabled", false);
            }
    
            if($('#inputBlankText').length>0){	
                $('[id=inputBlankText]').prop("disabled", false);
            }
    
        }
    
    
        
        /////////common mode//////////
        if($('.flipbtn').length>0){   
            $('.flipper').removeClass('active');
            
            window.setTimeout(function() {
              $(".flipbtn").unbind().click(function() {
                $(this).parents(".flipper").toggleClass("active");
              });
              document.getElementById('flipElement').style.visibility = 'visible';
            }, 800);		
             
        }
    
    }

    //check authentication in every 60 seconds
    $scope.verifyToken = function () {  
         console.log("F-verifyToken");      
        if (+dataService.getData('LOGGEDIN') == 1) {
            
            requestService.request('POST',true,'/verifyToken',{"userId": dataService.getData('USER'), "quizId": dataService.getData('QUIZID')}).then(function(response){                 
            var result = response.data;
            $rootScope.consoleData(result,'/verifyToken-qc');   
            $rootScope.updateTime(result.time);

            if(!result.status){ 
              socketStatus = 'authFailed';
              dataService.swalAndRedirect($scope.lang.alert_sessionExpired,'warning','btn-warning','loggedOutSessionExpired');
            }
            },function(err){
                var msg = $scope.lang['alert_unable_connect'];
                dataService.swalAndRedirect(msg,'warning','btn-warning','loggedOutSessionExpired');

            });
        }
    };

    let authCounter = 0;
    $scope.startVerifyAuthCounter = function(){
        if(authInterval){
            $interval.cancel(authInterval);
        }
        authCounter = 0;
        authInterval = $interval(()=>{
        if(authCounter>=60){
            authCounter = 0;            
            $scope.verifyToken();
        }
        authCounter++;
        },1000);
    }
    

    $scope.loadOtherMedia = function(){
        console.log("loadOtherMedia");
        $timeout(function () { dataService.getYtVideo(); }, 2000);
        $timeout(function () { dataService.getPlotChart();}, 2000);
        $timeout(function () { dataService.getPdfDoc();}, 2000);
        $timeout(function () { $scope.initLQJquery($scope.quizMode); }, 1000);

        $timeout(function() {
            if($scope.quizState == 'question'){
                $scope.loadSubjective();
            }
        },1000)
        
    }

    $scope.scrollBody = function(ele){
        $(".lqContent").animate({ scrollTop: 0 },0);
        setTimeout(function(){
            var hT = $('#'+ele).offset().top;
            $(".lqContent").animate({ scrollTop: hT }, 500);
        },0)
    }


    const subjectExpire = 1000*60*60*24;
    $scope.loadSubjective = function(){
        console.log("loadSubjective");
       
        if($scope.filteredQuestions.type === 'sub' && $scope.quizMode == 'quiz'){
            $(".answerPreviewOverlay").css({'visibility':'visible'});

            $scope.subQuesData = dataService.getLS('subjective',$scope.queslsSubKey);
            let temp = {
                'text':'',
                'drawing':[],
                'lastUpdate': new Date().getTime()
            }
            
            $scope.tempAns = $scope.subQuesData?$scope.subQuesData: temp; 
            $scope.reloadCkEditor();
            $scope.showSubAddRow = true;
        }else{
            //review mode
        }
    }

    $scope.reloadCkEditor = function(){
        $('.divOverLay').show();
        if($scope.filteredQuestions.object.limit>0){
            if (CKEDITOR.instances.editor){
                CKEDITOR.instances.editor.destroy();
            }
            
            CKEDITOR.replace('editor');
            $('#ckDiv').on('mouseover',function(){
                //check grammarly is installed
                let ge = document.getElementsByTagName("grammarly-extension").length;
                if(ge>0){
                    alert('Please disable grammarly extension of your browser.');
                    return;
                }
            });

            $scope.numCharacters = 0;
            CKEDITOR.on( 'instanceReady', function( evt ) {
                evt.stop();
                 //-1 is number "-1" is string
                if($scope.tempAns != -1){
                    if('text' in $scope.tempAns){
                        CKEDITOR.instances['editor'].setData($scope.tempAns['text']);
                        $scope.numCharacters = $scope.countCharacter($scope.tempAns['text']);
                    }else{
                        CKEDITOR.instances['editor'].setData('');
                    }
                }else{
                    CKEDITOR.instances['editor'].setData('');
                }
               $('.divOverLay').hide();
               $scope.$digest();
            });
           
            CKEDITOR.instances["editor"].on('change', function() {
                let str = this.getData().trim();
                if($scope.tempAns == -1){
                    $scope.tempAns = {
                        'text':str
                    };
                }else{
                    $scope.tempAns = {...$scope.tempAns};
                    $scope.tempAns['text'] = str;
                }

                dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns,subjectExpire);
               
                $(".answerPreviewOverlay").css({'visibility':'hidden'});
                if(ckTypeInterval){
                    $timeout.cancel(ckTypeInterval);
                    ckTypeInterval = null;
                }

                ckTypeInterval = $timeout(()=>{
                    $(".answerPreviewOverlay").css({'visibility':'visible'});
                },500)

                $scope.numCharacters = $scope.countCharacter($scope.tempAns['text']);
                if($scope.numCharacters > $scope.filteredQuestions.object.limit){
                    $scope.notifyAlertMsg('ck',$scope.lang.alert_subjectivelimit );
                }else{
                    $scope.clearNotifyAlert('ck');
                }
                $scope.$digest();
            });

            
            

        }
    }

    $scope.drawingLimitCheck = function(){
        if($scope.tempAns != -1){
            if('drawing' in $scope.tempAns){
                if(
                    $scope.tempAns['drawing'].length>= $scope.filteredQuestions.object.allowedDrawings &&
                    $scope.subDBStatus =='add' ){
                    $scope.subDBStatus = 'none';
                    return false; 
                }else{
                    return true;
                }
            }else{
                return true;
            }
        }else{
            return true;
        }
    }

    $scope.showSubDB = function(operation,index=-1){
        $scope.subNumDrawShapes = 0;
        $scope.subDBStatus = operation;
        $scope.delShape = false;
        // if(subDrawing){
        //     subDrawing.teardown();
        //     subDrawing=undefined;
        // }
        $timeout(()=>{
            subDrawing = LC.init(
                document.getElementById('subjevtiveDB'),{
                    imageURLPrefix: 'assets/literallycanvas/img',
                    keyboardShortcuts: false,
                    tools:[LC.tools.Pencil,LC.tools.Line,LC.tools.Ellipse,LC.tools.Rectangle,LC.tools.Text,LC.tools.Polygon,LC.tools.Pan,LC.tools.Eyedropper,LC.tools.SelectShape]
                }
            );
         
            $scope.subDBIndex =  index; //new = -1 edit = index
            if(operation == 'edit'){
                 let snapshot = $scope.tempAns['drawing'][index];
                 subDrawing.loadSnapshot(snapshot);
                 if('shapes' in snapshot){
                    $scope.subNumDrawShapes = snapshot['shapes'].length;
                }
            }

            subDrawing.on('drawingChange',()=>{
                let snapshot = subDrawing.getSnapshot(['shapes', 'colors']);
                $scope.mointerMaxDrawShape(snapshot)
            });

            subDrawing.on('toolChange',()=>{
                $scope.delShape = false;
                $scope.$digest();
              });

            subDrawing.on('lc-pointerup',()=>{
                if(subDrawing['selectedShape'] && Object.keys(subDrawing['selectedShape']).length!=0) {
                    $scope.delShape = true;
                    $scope.$digest();
                }
            });

            $scope.scrollBody('subjevtiveDB');



        },100);
        
    }

    $scope.delSelectedShape = function() {
        subDrawing['shapes'].splice(subDrawing['selectedShape'].shapeIndex,1);
        subDrawing._shapesInProgress = [];
        subDrawing.trigger('drawingChange', {});
        subDrawing.repaintLayer('main');
    }

    $scope.delSubDB = function(index){
        $scope.tempAns['drawing'].splice(index,1);
        dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns,subjectExpire);
        if($scope.subDBIndex == index){
            $scope.subDBStatus = 'none';
            $scope.clearNotifyAlert('maxSubShape');
        }
    }

    $scope.updateSubDrawing = function(){
        if(!$scope.drawingLimitCheck()){
            return;
         }
        let snapshot = subDrawing.getSnapshot(['shapes', 'colors']);
        if($scope.subDBStatus == 'add'){
            if($scope.tempAns != -1){
                if(!('drawing' in $scope.tempAns)){
                    $scope.tempAns = {...$scope.tempAns };
                    $scope.tempAns['drawing'] = [];
                }
            }else{
                $scope.tempAns= {
                    'drawing':[]
                }
            }
           
            if($scope.mointerMaxDrawShape(snapshot)){
                $scope.tempAns['drawing'].push(snapshot);
                $scope.subDBStatus = 'none';
                dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns,subjectExpire);
            }
    
        }else
        if($scope.subDBStatus == 'edit'){
            if($scope.mointerMaxDrawShape(snapshot)){
                $scope.tempAns['drawing'][$scope.subDBIndex] = snapshot;
                $scope.subDBStatus = 'none';
                dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns,subjectExpire);
            }
        }
        
    }

    $scope.cancelSubDrawing = function(){
        $scope.subDBStatus = 'none';
        $scope.subDBIndex = -1;
        $scope.clearNotifyAlert('maxSubShape');
    }


    $scope.mointerMaxDrawShape = function(snapshot){
        if('shapes' in snapshot){
            let msg =  $scope.lang.msg_maxDrawAllowed.replace("###", $scope.maxShapeAllowed);
            $scope.subNumDrawShapes = snapshot['shapes'].length;
            if($scope.subNumDrawShapes>$scope.maxShapeAllowed){
                $scope.notifyAlertMsg('maxSubShape', msg );
                return false; 
            }else{
                $scope.clearNotifyAlert('maxSubShape');
                return true;
            }
        }
    }

    $scope.showAddSubDrawBtn = function(){
        let numofDrawing = 0;
        if($scope.filteredQuestions.object.allowedDrawings>0){
            if($scope.tempAns != -1){
                if('drawing' in $scope.tempAns){
                    numofDrawing = $scope.tempAns['drawing'].length;
                }else{
                    numofDrawing= 0;
                }
            }
        }

        if( $scope.filteredQuestions.object.allowedDrawings>0 &&
            numofDrawing<$scope.filteredQuestions.object.allowedDrawings){
             return true;
        }else{
            return false;
        }
    }

    $scope.getSubSvgImg = function(draw){
       return $sce.trustAsHtml(LC.renderSnapshotToSVG(draw));
    }

    $scope.openMathDoc = function(){
        $("#mathDocMdl").modal('show');
    }


    //step 1: Join room if it is available otherwise call continue in every 10 seconds
    $timeout(()=>{
        token = dataService.getData('TOKEN');
        socket.emit('std_lqJoinQuiz', {quizId,token,studentId}, function(res) {
            console.log('SE-std_lqJoinQuiz')
            $scope.$apply(function(){
                if(res.status=='live'){  
                    startCounter = 0;                            
                    $scope.disableTimer(true);
                    
                    if(res.meta.hasOwnProperty('youtube')){
                      $scope.setUpYoutubeBox(res.meta.youtube);
                    }

                    $scope.setUpWhiteBoard(res.meta.whiteboard);

                    if(res.meta.playStatus=="play"){
    
                        if(res.meta.type != "wait"){
                            $scope.setUpPlay(res,true);
                        }
    
                        
                    }else{
                        if(res.error){
                            alert(res.error); //error
                        }
                    }
                    $scope.startVerifyAuthCounter();
                }else
                if(res.status=='notLive'){
                    $scope.checkQuizIsLive();
                }
                else 
                if(res.status="authFailed"){
                  socketStatus = 'authFailed';
                  $scope.terminateQuiz(res.status,res.type);
                }
            });
           
        });

        if($("#switchQuiz")){
            $("#switchQuiz").trigger('mouseover');
        }
    },500);


    $scope.terminateQuiz = function(reason,warning) {
        console.log("F-terminateQuiz");
        if (+dataService.getData('LOGGEDIN') == 1) {
            $scope.disableTimer(true);
            requestService.dbErrorHandler(reason,warning);
        }
    }



    socket.on('std_lqWait',function(data){
        $scope.$apply(function(){
            console.log('SO-std_lqWait');
            $scope.disableTimer(true);     
            $scope.scrollUp();       
       });
    })

    socket.on('std_lqLeaveRoom',function(data){
        $scope.$apply(function(){
            console.log('SO-std_lqLeaveRoom');
            $scope.disableTimer(true);
            $scope.checkQuizIsLive(); 
            $scope.closeYoutubeBox();
            $scope.closeWhiteBox();
            if(authInterval){
                $interval.cancel(authInterval);
            }
       });
    });

    socket.on('std_lqSessionExp',function(data){
        console.log("SO-std_lqSessionExp");
        $scope.$apply(function(){
            socketStatus = 'authFailed';  
           $scope.terminateQuiz('authFailed','danger');           
       });
    });

    
    socket.on('lq_startTimer',function(data){
        console.log("SO-lq_startTimer");
        $scope.$apply(function(){
            $scope.quizState = data.type;
            $scope.startTime();
            $scope.getStartTime();            
        });
    });

    socket.on('std_lqQuestion',function(data){
       console.log("SO-std_lqQuestion");
       $scope.$apply(function(){
        $scope.disableTimer(true);
        $scope.time = data.meta.time;
        $scope.setUpQuestion(data,false); 
       });
       
    });


    socket.on('std_lqQuizInst',function(data){
        console.log("SO-std_lqQuizInst");
        $scope.$apply(function(){
            $scope.disableTimer(true);
            $scope.time = data.meta.time;
            $scope.setUpQuizInst(data,false); 
            
        });
        
    });


    socket.on('std_lqSecInst',function(data){
        console.log('SO-std_lqSecInst');
        $scope.$apply(function(){
            $scope.disableTimer(true);
            $scope.time = data.meta.time;
            $scope.setUpSecInst(data,false); 
        });        
    });
    
    socket.on('std_lqPauseQuiz',function(data){
        console.log('SO-std_lqPauseQuiz')
        $scope.$apply(function(){
            $scope.disableTimer(true);
            $scope.scrollUp(); 
        });
    });

    // new test  mode
    socket.on('std_lqPauseAndSubmit',function(data){
        console.log('SO-std_lqPauseAndSubmit');
        $scope.$apply(function(){
            //if answer is given then do not send  
            // answer response again            
            if(!$scope.isAnswerGiven){ 
                $scope.pauseQuiz();
            }else{
                $scope.disableTimer(true);
            }
             
        });
    });

    socket.on('lq_updateTime',function(data){
        console.log('SO-lq_updateTime');
        $scope.$apply(function(){
          $scope.stopQuizClock(); 

        //   if($scope.isAnswerGiven){
        //       return;
        //   }
          $scope.time = data.newTime;
          $scope.startTime();
             

        });
    });

    
    socket.on('std_lqDisplayStatsOnly',function(data){
        console.log("SO-std_lqDisplayStatsOnly");
        $scope.$apply(function(){
            //statOnly;secId
            $scope.setUpStats(data,true);
        });
         
    })

    socket.on('std_lqRecieveDataAfterPlayed',function(data){
        console.log('SO-std_lqRecieveDataAfterPlayed');
        $scope.$apply(function(){
            $scope.disableTimer(true);
            $scope.setUpQuestionWithAns(data,false);
            $scope.setUpStats(data.meta,false);
        });

    })

    

    socket.on('lq_stdShowData',function(data){
        console.log('SO-lq_stdShowData');
        $scope.$apply(function(){
           // console.log(data.type);
           $scope.quizState = data.type;           
        });
         
    });

  

    socket.on('std_toggleVideoChat',function(data){
       console.log("SO-std_toggleVideoChat");
      $scope.$apply(function(){
        $scope.setUpYoutubeBox(data);
      });

    });

    socket.on('std_toggleWhiteBoard',function(data){
        $scope.$apply(function(){
          $scope.setUpWhiteBoard(data);
        });
  
    });
    

    socket.on('disconnect',function(){
        console.log('SO-disconnect');
        $scope.$apply(function(){
            if (+dataService.getData('LOGGEDIN') == 1) {
                    if(socketStatus == 'disconnect'){
                        startCounter = 0;
                        socketStatus = 'connected';
                        helperService.notifyMsg('ti-alert', 'warning','You are disconnected from the live quiz.' , 'top', 'center',3000);
    
                        $scope.disableTimer(true);
                        //$scope.checkQuizIsLive(); 
                        $scope.closeYoutubeBox();
                        $scope.closeWhiteBox();
                        if(authInterval){
                            $interval.cancel(authInterval);
                        }
                        $scope.quizState = 'offline';
                        $scope.scrollUp();
                    }
            }

        }); 
       
    });

    
    socket.on('connect_error', function(err) {
        console.log('connect_error');
        console.log(err);
        //LiveQuizNotConnect - loggout reason
    })

    socket.on('connect',function(){
        $scope.$apply(function(){
            console.log("Connect successfully");
            socketStatus = 'disconnect';
            helperService.notifyMsg('ti-info', 'success','Now you are connected again.' , 'top', 'center',5000);
            if(startInterval){
                $interval.cancel(startInterval);
            }
            $scope.joinQuiz();
            
        });
    });
    
    /**end of socket***/

 //////////end of live quiz///////////

    $scope.showUserDetail = function(prop){
      return dataService.isShowUserDetail(prop);
    }
    
    $scope.$on("changeUILanguage",function(e,data){       
        $scope.lang = data.language; 
    });

    $timeout(()=>{
      $(".pageLoader").fadeOut("slow");
    },1500);

    //it will call after when template load completely
    $scope.$on('$includeContentLoaded', function(event){
        console.log("Content Load");
        $scope.loadOtherMedia(); 
    });

    $scope.$on("lq_socketDisconnect", function(evt){ 
        console.log("lq_socketDisconnect");
        $timeout(function(){
            socket.disconnect();
        },500)
    });

    $scope.checkLoginEmail = function(){
        return ($scope.quizState =='notStart' || $scope.quizState =='offline' ) && sessionStorage.getItem('loginToken')?true:false;
    }


}]); 






