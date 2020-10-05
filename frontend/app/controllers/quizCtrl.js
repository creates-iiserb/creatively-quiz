//"use strict";
app.controller('quizCtrl', ['$scope', '$http', 'helperService','$timeout', '$interval', '$compile','$rootScope','$location','dataService','helperService','requestService','$window','$state','$sce', function ($scope, $http, helper, $timeout, $interval, $compile, $rootScope,$location,dataService,helperService,requestService,$window,$state,$sce) {
    const version = 4.3;
    $scope.lang = $rootScope.language;
    $scope.resquestSend = false; 
    let submitType = 'manual';
    $scope.maxShapeAllowed = 30;
    $scope.langName = 'default';
    if(typeof(Storage) !== "undefined") {
        if (sessionStorage.language) {
            $scope.langName = sessionStorage.language;
        }
    }
    $scope.timeTaken = [];
    $scope.Stime = [];
    $scope.Etime = [];
    $scope.hintUsed = [];
    $scope.answSelected = [];
    $scope.tempAns = [];
    $scope.lock = [];
    $scope.hh = '00';
    $scope.mm = '00';
    $scope.ss = '00';
    let subDrawing = undefined;
    const subjectExpire = 1000*60*60*24;
   
    $scope.$on('$stateChangeStart', function(e, toState, toParams, fromState, fromParams) {
        if($rootScope.quizStarted!='quiz'){  
            if(fromState.name=='quiz' && toState.name=='start'){
                e.preventDefault();   
                history.pushState(null,null, window.location.origin + window.location.pathname+"#quiz");
                if($("html").hasClass("nav-open")){
                            $('.navbar-toggle').click(); 
                }
                if(dataService.getData('ISSECTION')){
                    swal({
                        text: $scope.lang['msg_sec_backBtn_disabled'],
                        buttonsStyling: false,
                        confirmButtonClass: "btn btn-warning btn-fill"
                    });
                }else{
                    swal({
                        text: $scope.lang['msg_plain_backBtn_disabled'],
                        buttonsStyling: false,
                        confirmButtonClass: "btn btn-warning btn-fill"
                    });
                }
                
            }
        }
    });

    

    $scope.reqBy = 'std';
    if(dataService.getData('reqByAuthor')){
        $scope.reqBy = 'auth';
    }
    
    $scope.questions = ['']; 
    $scope.data = '';
    $scope.mode = '';
    $scope.isLoad = false;
   
    var secIndex = $scope.sections.findIndex(x=>x.sectionId == $rootScope.activeQuiz );    
    $scope.sectionNumber = secIndex+1;
    $scope.sectData = $scope.sections[secIndex];
    
    $scope.flashCards = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]]
    $scope.currentPage = 1;
    $scope.isReviewQuestions = [];
    for (var i = 0; i < $scope.totalItems; i++) {
        $scope.isReviewQuestions.push(0); 
    }
    $scope.answergive = [];
   
    $scope.defaultConfig = {
        'allowBack': true,
        'allowReview': false,
        'autoMove': false,  
        'duration': 0,  
        'pageSize': 1,
        'requiredAll': false,  
        'richText': false,
        'shuffleQuestions': false,
        'shuffleOptions': false,
        'showClock': true,
        'showPager': true,
        'theme': 'none'
    }

    $("#calc").draggable({
        containment: "parent"
    });

    $scope.calculatorType = function(){
        if($rootScope.calcType!='none')
          return true;
        else 
          return false;
    }

   
    var parseTime = function (diff) {
        var msec = diff;
        var hh = Math.floor(msec / 1000 / 60 / 60);
        msec -= hh * 1000 * 60 * 60;
        var mm = Math.floor(msec / 1000 / 60);
        msec -= mm * 1000 * 60;
        var ss = Math.floor(msec / 1000);
        msec -= ss * 1000;

        $scope.hh = hh<10?'0'+hh:hh;
        $scope.mm = mm<10?'0'+mm:mm;
        $scope.ss = ss<10?'0'+ss:ss;
    }

    $scope.timerType = "timeSpent";
    $scope.timeUsed = 0;
    $scope.timerToggle = function () {
       
         if(+$rootScope.DURATION==525600){
             return;
         }

        if ($scope.timerType == "timeSpent")
            $scope.timerType = "timeLeft";
        else
            $scope.timerType = "timeSpent";
    }

    $scope.timeSpent = function () {
        $scope.timerType = "timeSpent";
    }

    $scope.autoSaveUsingSec = 0;       
    
    var tick = function () {
        $scope.quizClock = new Date($scope.getClock());
        if ($scope.timerType == "timeSpent") {
              
            var showTime = $scope.quizClock - $scope.session_begin_time;
            parseTime(showTime);
        } else {  
            var showTime = new Date($scope.session_end_time - $scope.quizClock);
            parseTime(showTime);
        }
       
        $scope.autoSaveUsingSec++;        
        if($scope.autoSaveUsingSec>60){
            $scope.autoSaveUsingSec=0;
            $scope.autoSaveWithSec();
        }
         
    }
    
   
    var timeAlert = function () {
        
        var quizClock = new Date($scope.getClock());
        var msec = new Date($scope.session_end_time - quizClock);
        var hh = Math.floor(msec / 1000 / 60 / 60);
        msec -= hh * 1000 * 60 * 60;
        var mm = Math.floor(msec / 1000 / 60);
        msec -= mm * 1000 * 60;
        var ss = Math.floor(msec / 1000);
        msec -= ss * 1000;

        var hh1 = hh<10?'0'+hh:hh;
        var mm1 = mm<10?'0'+mm:mm;
        var ss1 = ss<10?'0'+ss:ss;
        
        var timeCnt = hh1 + ':' + mm1 + ':' + ss1;
        if (+dataService.getData('LOGGEDIN') == 1) {
            if (hh == 0 && mm == 16 && ss < 2) {
                helperService.notifyMsg('ti-alert', 'warning', $scope.lang.alert_timeAlert, 'top', 'center');
            }
            if (hh == 0 && mm < 16) {
                $('#timealert').delay(5000).slideUp(300);
                $('#showtime').hide();
                $('#timealertblock').show();
                $('#timealertblock').html(timeCnt);
            }
            if (hh < 0 && dataService.getData('ATTEMPT') == false) {
                $scope.onFinish($scope.currentPage);   
                submitType = 'autoTimeup';             
                $scope.saveResponse('submit','beforeSubmit'); 
            }
        }
    }

    var timerTimeoutArray = [];
    var timerIntervalArray = [];
    var clearIntervalTimeAlert;
    var clearTime;
    var clearIntervalTick;
    $scope.startQuizTimer = function(){
        if (+dataService.getData('LOGGEDIN') == 1 && dataService.getData('ATTEMPT') == false) {
            clearTime = $timeout(function () { tick(); timeAlert(); }, 1000);
            clearIntervalTick = $interval(tick, 1000);
            clearIntervalTimeAlert = $interval(timeAlert, 1000);
            timerTimeoutArray.push(clearTime);
            timerIntervalArray.push(clearIntervalTick);
            timerIntervalArray.push(clearIntervalTimeAlert);  
        }
    }

  
    $scope.clearTimer = function () {
        timerTimeoutArray.forEach(function(timeout,i){           
              $timeout.cancel(timeout);   
        });
        timerIntervalArray.forEach(function(timeout,i){             
              $interval.cancel(timeout); 
        });
    }
    
    $scope.validateTime = function () {
        var d = new Date($scope.getClock());
        var beginDt = new Date($rootScope.BTIME);
        if (d > beginDt) {
            return true;
        } else {
            return false;
        }
    }

    $scope.chkEndDate = function () {
        var d = new Date($scope.getClock());
        var endDt = new Date($rootScope.ETIME);
        if (d < endDt) {
            return false;
        } else {
            return true;
        }
    }
    
    
    $scope.onSelect = function (question, option, id) {
            $scope.lock[$scope.currentPage - 1] = true;
            $scope.selectAns($scope.currentPage, id);
            $scope.tempAns[$scope.currentPage - 1] = id;
            question.object.options.forEach(function (element, index, array) {
                if (element.Id != option.Id) {
                    element.Selected = false;
                    question.Answered = option.isanswer;
                } else {
                    element.Selected = true;
                }
            });
    }
    
    $scope.onSelectExample = function (question, option, id) {
        $scope.lockToggle(id);
        question.object.rate.forEach(function (element, index, array) {
            if (element.Id != option.Id) {
                element.Selected = false;
                question.Answered = option.isanswer;
            }
        });
        if ($scope.config.autoMove == true && $scope.currentPage < $scope.totalItems) {
            $scope.currentPage++;
        }
    }

    $scope.pageCount = function () {
        return Math.ceil($scope.questions.length / $scope.itemsPerPage);
    };
   
    $scope.loadResponseFillIn = function () {
        if ($scope.questions[$scope.currentPage - 1].type === 'fillIn') {
            var inputCount = document.getElementById('divFillInBlank').getElementsByTagName('input').length;
            for (var i = 0; i < inputCount; i++) {
               
                var name = document.getElementById('divFillInBlank').getElementsByTagName('input')[i].getAttribute("name");
                $scope.questions[$scope.currentPage - 1].object[name] = $scope.tempAns[$scope.currentPage - 1][name];
            }
            $scope.chkQusLock();
        }
    }

   
    $scope.countCharacter = function(strData){
        if(strData){
            let str = strData.toString();
            str = str.replace(/[&]nbsp[;]/gim," ")
            let finalStr = str.replace( /(<([^>]+)>)/igm, '');
            return finalStr.length;  
        }else{
            return 0;
        }
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

    $scope.scrollBody = function(id){
        var position = $('#'+id).offset().top;
        $("body, html").animate({
        scrollTop: position - 80
        },500 );
    }

    $scope.loadSubjective = function (mode) {
        if ($scope.questions[$scope.currentPage - 1].type === 'sub') {
            if(mode === "review"){
                if(ckTypeInterval){
                    $timeout.cancel(ckTypeInterval);
                    ckTypeInterval = null;
                }
                ckTypeInterval = $timeout(()=>{
                    $(".answerPreviewOverlay").css({'visibility':'visible'});
                },500);

            }else
            if(mode === "quiz"){
               $scope.queslsSubKey = `${dataService.getData('QUIZID')}${dataService.getData('USER')}${$scope.sectionNumber}${$scope.questions[$scope.currentPage - 1].ref}`.toLowerCase();
               $(".answerPreviewOverlay").css({'visibility':'visible'});
               $scope.reloadCkEditor();
            }
        }
    }

    $scope.reloadCkEditor = function(){
       
             $('.divOverLay').show();
            if($scope.filteredQuestions[0].object.limit>0){
                if (CKEDITOR.instances.editor){
                    CKEDITOR.instances.editor.destroy();
                }
                CKEDITOR.replace('editor');
                $('#ckDiv').on('mouseover',function(){
                    
                    let ge = document.getElementsByTagName("grammarly-extension").length;
                    if(ge>0){
                        alert('Please disable grammarly extension of your browser.');
                        return;
                    }
                });

                $scope.subNumCharacters = 0;
               
               
                CKEDITOR.on( 'instanceReady', function( evt ) {
                    $scope.$apply(function(){
                        evt.stop();
                        if($scope.tempAns[$scope.currentPage - 1] !== -1){
                            if('text' in $scope.tempAns[$scope.currentPage - 1]){
                                CKEDITOR.instances['editor'].setData($scope.tempAns[$scope.currentPage - 1]['text']);
                                $scope.subNumCharacters = $scope.countCharacter($scope.tempAns[$scope.currentPage - 1]['text']);
                            }else{
                                CKEDITOR.instances['editor'].setData('');
                            }
                            
                        }else{
                            CKEDITOR.instances['editor'].setData('');
                        }
                        $('.divOverLay').hide();
                    });
                });

                CKEDITOR.instances["editor"].on('change', function() { 
                    $scope.$apply(function(){
                        let str = CKEDITOR.instances.editor.getData()
                        if($scope.tempAns[$scope.currentPage - 1] == -1){
                            $scope.tempAns[$scope.currentPage - 1] = {
                                'text':str
                            };
                        }else{
                            $scope.tempAns[$scope.currentPage - 1] = {...$scope.tempAns[$scope.currentPage - 1]};
                            $scope.tempAns[$scope.currentPage - 1]['text'] = str;
                        }

                        dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns[$scope.currentPage - 1],subjectExpire);
                        $(".answerPreviewOverlay").css({'visibility':'hidden'});
                        if(ckTypeInterval){
                            $timeout.cancel(ckTypeInterval);
                            ckTypeInterval = null;
                        }
                        ckTypeInterval = $timeout(()=>{
                            $(".answerPreviewOverlay").css({'visibility':'visible'});
                        },500)
                        $scope.subNumCharacters = $scope.countCharacter($scope.tempAns[$scope.currentPage - 1]['text']);
                        if($scope.subNumCharacters > $scope.filteredQuestions[0].object.limit){
                            $scope.notifyAlertMsg('ck',$scope.lang.alert_subjectivelimit );
                        }else{
                            $scope.clearNotifyAlert('ck');
                        }
                    });
                });
                
            }
    }

    $scope.showSubDB = function(operation,index=-1){
        $scope.subDBStatus = operation;
        $scope.subNumDrawShapes = 0;
        $timeout(()=>{
            subDrawing = LC.init(
                document.getElementById('subjevtiveDB'),{
                    imageURLPrefix: 'assets/literallycanvas/img',
                    keyboardShortcuts: false,
                    tools:[LC.tools.Pencil,LC.tools.Line,LC.tools.Ellipse,LC.tools.Rectangle,LC.tools.Text,LC.tools.Polygon,LC.tools.Pan,LC.tools.Eyedropper,LC.tools.SelectShape]
                }
            );
         
            $scope.subDBIndex =  index; 
            if(operation == 'edit'){
                let snapshot = $scope.tempAns[$scope.currentPage - 1]['drawing'][index]
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
        $scope.tempAns[$scope.currentPage - 1]['drawing'].splice(index,1);
        dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns[$scope.currentPage - 1],subjectExpire);
        if($scope.subDBIndex == index){
            $scope.subDBStatus = 'none';
            $scope.clearNotifyAlert('maxSubShape');
        }
    }

    $scope.updateSubDrawing = function(){
        let snapshot = subDrawing.getSnapshot(['shapes', 'colors']);
        if($scope.subDBStatus == 'add'){
            if($scope.tempAns[$scope.currentPage - 1] != -1){
                if(!('drawing' in $scope.tempAns[$scope.currentPage - 1])){
                    $scope.tempAns[$scope.currentPage - 1] = {...$scope.tempAns[$scope.currentPage - 1] };
                    $scope.tempAns[$scope.currentPage - 1]['drawing'] = [];
                }
            }else{
                $scope.tempAns[$scope.currentPage - 1]= {
                    'drawing':[]
                }
            }
           
            if($scope.mointerMaxDrawShape(snapshot)){
                $scope.tempAns[$scope.currentPage - 1]['drawing'].push(snapshot);
                $scope.subDBStatus = 'none';
                dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns[$scope.currentPage - 1],subjectExpire);
            }
    
        }else
        if($scope.subDBStatus == 'edit'){
            if($scope.mointerMaxDrawShape(snapshot)){
                $scope.tempAns[$scope.currentPage - 1]['drawing'][$scope.subDBIndex] = snapshot;
                $scope.subDBStatus = 'none';
                dataService.setLS('subjective',$scope.queslsSubKey,$scope.tempAns[$scope.currentPage - 1],subjectExpire);
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
            if($scope.subNumDrawShapes >$scope.maxShapeAllowed){
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
        if($scope.filteredQuestions[0].object.allowedDrawings>0){
            if($scope.tempAns[$scope.currentPage - 1] != -1){
                if('drawing' in $scope.tempAns[$scope.currentPage - 1]){
                    numofDrawing = $scope.tempAns[$scope.currentPage - 1]['drawing'].length;
                }else{
                    numofDrawing= 0;
                }
            }
        }

        if( !$scope.rsgetData('ATTEMPT') && 
            !$scope.lock[$scope.currentPage - 1] && 
            $scope.filteredQuestions[0].object.allowedDrawings>0 &&
            numofDrawing<$scope.filteredQuestions[0].object.allowedDrawings){
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

  
    $scope.chkQusLock = function () {
        if ($scope.questions[$scope.currentPage - 1].type === 'fillIn') {
            if ($scope.lock[$scope.currentPage - 1]) {
                $(".fillInOption").addClass('disable-block');
            } else {
                $(".fillInOption").removeClass('disable-block');
            }
        }
    }

   
    $scope.fillValue = function (name) {
        if($scope.lock[$scope.currentPage - 1]){
            return;
        }
        else{

            if ($scope.tempAns[$scope.currentPage - 1] != -1) {
                var temp = $scope.tempAns[$scope.currentPage - 1];
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
            $scope.tempAns[$scope.currentPage - 1] = JSON.parse(newtemp);
        }
    }

    
    $scope.loadResponseExample = function () {
        for (var i = 0; i < $scope.totalItems; i++) {
            if ($scope.questions[i].type === 'example') {
                for (var j = 0; j < $scope.questions[i].object.rate.length; j++) {
                    $scope.questions[i].object.rate[j].Selected = false;
                }
                if ($scope.quizResponse[i].tempAns != -1) {
                    $scope.questions[i].object.rate[$scope.quizResponse[i].tempAns - 1].Selected = true;
                }
            }
        }
    }

    
    $scope.loadResponseMcq = function () {
        for (var i = 0; i < $scope.totalItems; i++) {
            if ($scope.questions[i].type === 'mcq') {
                for (var j = 0; j < $scope.questions[i].object.options.length; j++) {
                    $scope.questions[i].object.options[j].Selected = false;
                }
                
                if ($scope.quizResponse[i].tempAns != -1) {
                    $scope.questions[i].object.options[$scope.quizResponse[i].tempAns - 1].Selected = true;
                }
            }
        }
    }

   
    $scope.loadResponseArrange = function () {
        for (var i = 0; i < $scope.totalItems; i++) {
            if ($scope.questions[i].type === 'arrange') {
                if ($scope.quizResponse[i].tempAns != -1) {
                    var tmp = [];
                    tmp = angular.copy($scope.quizResponse[i].tempAns);
                    for (var j = 0; j < tmp.length; j++) {
                        tmp[j] = Math.abs(tmp[j]);
                    }
                    $scope.arrangeType[i] = tmp;
                }
                else {
                    var temp = [];
                    for (var j = 0; j < $scope.questions[i].object.items.length; j++) {
                        temp[j] = j + 1;
                    }
                    $scope.arrangeType[i] = temp;
                }
            }
        }
    }

    $scope.setEndTime = function () {
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
            $scope.clearTimer();
            $('.overlay-div').css("visibility", "visible");
        }
    }

    let loadQuizNewTim = null;
    let loadInitTim = null;
    let videoTim = null;
    let chartTim = null;
    let pdfTim = null;

    
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

    $scope.clearVCPTim = function(){
        if(videoTim){
            $timeout.cancel(videoTim);
            videoTim = null;
        }
        if(chartTim){
            $timeout.cancel(chartTim);
            chartTim = null;
        }
        if(pdfTim){
            $timeout.cancel(pdfTim);
            pdfTim = null;
        }
    }

    $scope.clearJQFill =  function(){
        $scope.numFillIns = 0;
        if(loadQuizNewTim){
            $timeout.cancel(loadQuizNewTim);
            loadQuizNewTim = null;
        }
        if(loadInitTim){
            $timeout.cancel(loadInitTim);
            loadInitTim = null;
        }
        $scope.subNumCharacters = 0;
        $scope.subNumDrawShapes = 0;
        $scope.subDBStatus = 'none';
        $scope.delShape  = false;
        $scope.clearNotifyAlert();
    }

    $scope.subNumCharacters = 0;
    $scope.subNumDrawShapes = 0;
    $scope.loadQuizNew = function () {       
      
       $scope.helpAllowed = $rootScope.sectionHelp[$rootScope.activeQuiz];
       requestService.request('POST',true,'/quizData',{examId:$rootScope.activeQuiz}).then(function(response){
        var result = response.data;
        
        $rootScope.updateTime(result.time);
            if(result.status){
                var data = result.data;
                $scope.mode = 'quiz';
                $scope.quiz = data.quizdata;
                $scope.swapOptions = [];
                $scope.arrangeType = [];
                
                if ($scope.loginTime == 'absolute') {
                    if ($rootScope.absFirstQuizStart) {
                        $rootScope.startedOn = new Date($scope.getClock());
                    }
                    
                    $scope.session_begin_time = new Date($rootScope.startedOn);
                } else {
                    $scope.session_begin_time = new Date($scope.getClock());
                }
                
                $scope.config = helper.extend({}, $scope.defaultConfig, $scope.data.config);
                $scope.questions = $scope.config.shuffleQuestions ? helper.shuffle($scope.quiz.elements) : $scope.quiz.elements;
                $scope.totalItems = $scope.questions.length;
                if(data.isResponse && data.response.length>0 ){
                   
                    let quizSecId =  `${dataService.getData('QUIZID')}${dataService.getData('USER')}${$scope.sectionNumber}`;
                    $scope.quizResponse = data.response;
                    for (var i = 0; i < $scope.totalItems; i++) {
                       
                        if( typeof $scope.quizResponse[i].answerId==="undefined"){
                          $scope.quizResponse[i].answerId = -1;
                        }

                        if (!$scope.quizResponse[i].hasOwnProperty("tempAns")) {
                         $scope.quizResponse[i]['tempAns'] = $scope.quizResponse[i].answerId;
                        }
                        $scope.isReviewQuestions[i] = $scope.quizResponse[i].review;
                        $scope.timeTaken[i] = $scope.quizResponse[i].timeTaken;
                       
                       
                        $scope.Stime[i] = 0;
                        $scope.Etime[i] = $scope.quizResponse[i].timeTaken;
                        $scope.hintUsed[i] = $scope.quizResponse[i].helpUsed;
                        $scope.answSelected[i] = $scope.quizResponse[i].answerId;
                        $scope.lock[i] = $scope.quizResponse[i].lock;
                        $scope.tempAns[i] = $scope.quizResponse[i].tempAns;

                       
                        if($scope.quizResponse[i].type=="sub"){
                            let quesKey = `${quizSecId}${$scope.quizResponse[i].ref}`.toLowerCase();
                            let subLsData = dataService.getLS('subjective',quesKey);
                           

                            if($scope.tempAns[i] != -1){
                                if(subLsData){
                                    if(subLsData.lastUpdate>= $scope.tempAns[i].lastUpdate){
                                     $scope.tempAns[i] = subLsData;
                                    } 
                                }
                            }else{
                                if(subLsData){
                                 $scope.tempAns[i] = subLsData;
                                }
                            }
                           
                        }
                       

                    }    

                    $scope.timeUsed = data.timeTaken;                                
                    if ($scope.loginTime != 'absolute') {
                     $scope.session_begin_time.setSeconds($scope.session_begin_time.getSeconds() - $scope.timeUsed);
                    }

                   
                    $scope.loadResponseExample();
                   
                    $scope.loadResponseMcq();
                    
                    $scope.loadResponseArrange();
                    $scope.itemsPerPage = $scope.config.pageSize;
                    
                    $scope.currentPage  = data.lastQue; 
                    $scope.getStartTime($scope.currentPage);
                    $scope.setGridCenter($scope.currentPage);
                    
                    $scope.$watch('currentPage + itemsPerPage', function () {
                        var begin = (($scope.currentPage - 1) * $scope.itemsPerPage)
                        var end = begin + $scope.itemsPerPage;
                        $scope.filteredQuestions = $scope.questions.slice(begin, end);
                        $scope.clearJQFill();
                        if($(".divOverLay").length>0){
                            $(".divOverLay").show();
                        }
                       
                       
                        loadQuizNewTim = $timeout(function () {
                            $scope.loadResponseFillIn();
                            $scope.loadSubjective('quiz');
                            $scope.initNumOfFillins();
                        }, 1500);
                        loadInitTim = $timeout(function () {  initJS('quiz'); }, 1500);
                    });
                    

                }else{
                               
                    for (var i = 0; i < $scope.totalItems; i++) {
                        $scope.isReviewQuestions[i] = 0;
                        $scope.timeTaken.push(0);
                        $scope.Stime.push(0);
                        $scope.Etime.push(0);
                        $scope.hintUsed.push(0);
                        $scope.answSelected.push(-1);
                        $scope.tempAns.push(-1);
                        $scope.lock.push(false);
                    }
                    $scope.itemsPerPage = $scope.config.pageSize;
                    $scope.getStartTime($scope.currentPage);
                    $scope.$watch('currentPage + itemsPerPage', function () {
                        $scope.clearJQFill();
                        var begin = (($scope.currentPage - 1) * $scope.itemsPerPage),
                            end = begin + $scope.itemsPerPage;
                        $scope.filteredQuestions = $scope.questions.slice(begin, end);
                      
                        loadInitTim = $timeout(function () { 
                            initJS('quiz'); 
                            $scope.loadSubjective('quiz');
                            $scope.initNumOfFillins();
                        }, 1000);
                    });
                    
                    
                    for (var i = 0; i < $scope.totalItems; i++) {
                        if ($scope.questions[i].type === 'arrange') {
                            var temp = [];
                            for (var j = 0; j < $scope.questions[i].object.items.length; j++) {
                                temp[j] = j + 1;
                            }
                            $scope.arrangeType[i] = temp;                                        
                        }
                    }
                  
                    $scope.timeUsed = data.timeTaken;                                
                    if ($scope.loginTime != 'absolute') {
                        $scope.session_begin_time.setSeconds($scope.session_begin_time.getSeconds() - $scope.timeUsed);
                    }
                   
                }

                $scope.setEndTime();
                $scope.gridMatrix();
                $scope.clearVCPTim();

                videoTim = $timeout(function () { dataService.getYtVideo(); }, 2000);
                chartTim = $timeout(function () { dataService.getPlotChart();}, 2000);
                pdfTim = $timeout(function () { dataService.getPdfDoc();}, 2000);

                $scope.startQuizTimer();
                $timeout(()=>{
                    $(".pageLoader").fadeOut("slow");
                },500)
                
                $scope.isLoad = true;
                             
            }else{
              $scope.errorHandling(result);
            }

        },function(errorResponse){
            $scope.serverErrorHandling(errorResponse);
        });

       
    }

    $scope.initNumOfFillins = function(){
        let eleInps = document.getElementById('divFillInBlank');
        if(eleInps){
            let fillInputs = eleInps.getElementsByTagName('input');
            if(fillInputs){
                $scope.numFillIns = fillInputs.length;
            }
            
        }
    }

    $scope.errorHandling = function(result){
        if(result.error.code){
            requestService.dbErrorHandler(result.error.code,result.error.type); 
            if(result.error.code =="alert_afterQuizEnd"){ 
                $(".pageLoader").hide();
                $timeout(()=>{
                    dataService.loggoutWithReason('loggedOut');
                },4000);
            }
        }else{
            dataService.swalAndRedirect($scope.lang['alert_unable_connect'],'warning','btn-warning','serverErr');
        }
    }

  
    $scope.loadQuizReviewNew = function(){
       
        var reqdata = {examId : $rootScope.activeQuiz};
        $scope.helpAllowed = $rootScope.sectionHelpAtReview[$scope.activeQuiz];
        requestService.request('POST',true,'/quizResponseData',reqdata).then(function(response){ 
            var result = response.data;
            
            $rootScope.updateTime(result.time);

            if(result.status){
                var data = result.data;
                $scope.mode = 'review';
                $scope.quiz = data.quizData;
                $scope.statistics = data.statistics;
                if (!$scope.validateTime()) {
                    dataService.swalAndRedirect($scope.lang.alert_beforeQuizStart,'warning','btn-warning','loggedOut');
                }
                 
              
                $scope.swapOptions = [];
                $scope.arrangeType = [];
                $scope.session_begin_time = new Date($scope.getClock());
                $scope.startdatetime = $scope.session_begin_time.getDate() + "-" + ($scope.session_begin_time.getMonth() + 1) + "-" + $scope.session_begin_time.getFullYear() + " " + $scope.session_begin_time.getHours() + ":" + $scope.session_begin_time.getMinutes() + ":" + $scope.session_begin_time.getSeconds();
                $scope.config = helper.extend({}, $scope.defaultConfig, $scope.data.config);
                $scope.questions = $scope.config.shuffleQuestions ? helper.shuffle($scope.quiz.elements) : $scope.quiz.elements;
                $scope.totalItems = $scope.questions.length;
                
               
                $scope.quizResponse = data.response; 
                $scope.scoreDetails = data.response;
                $scope.timeTaken = [];
                $scope.Stime = [];
                $scope.Etime = [];
                $scope.hintUsed = [];
                $scope.answSelected = [];
                $scope.tempAns = [];
                $scope.lock = [];
                $scope.correctAnsGiven = [];
                $scope.hasGradIndex = [];

                $scope.allowPartialGrading =  $scope.sectData.partialGrading;
                
                $scope.clearCurrentSecLS();

                for (var i = 0; i < $scope.totalItems; i++) {
                 
                    if( typeof $scope.quizResponse[i].answerId==="undefined"){
                        $scope.quizResponse[i].answerId = -1;
                    }

                    if (!$scope.quizResponse[i].hasOwnProperty("tempAns")) {
                        $scope.quizResponse[i].tempAns = $scope.quizResponse[i].answerId;
                    }

                    $scope.isReviewQuestions[i] = $scope.quizResponse[i].review;
                    $scope.timeTaken[i] = $scope.quizResponse[i].timeTaken;

                   
                    $scope.timeUsed = $scope.timeUsed + $scope.quizResponse[i].timeTaken;
                    $scope.Stime[i] = 0;
                    $scope.Etime[i] = $scope.quizResponse[i].timeTaken;
                    $scope.hintUsed[i] = $scope.quizResponse[i].helpUsed;
                    $scope.answSelected[i] = $scope.quizResponse[i].answerId;
                    $scope.lock[i] = $scope.quizResponse[i].lock;
                    $scope.tempAns[i] = $scope.quizResponse[i].tempAns;
                   
                    if($scope.quizResponse[i].hasOwnProperty('gradingIndex')){
                        $scope.hasGradIndex[i] = true;
                        let gradeindex = $scope.quizResponse[i].gradingIndex;
                        if(gradeindex[0]==0){
                            $scope.correctAnsGiven[i]= 'correct';
                        }else
                        if(gradeindex[0]==1){                
                            $scope.correctAnsGiven[i]= 'skipped';
                        }else
                        if(gradeindex[0]==2){
                            $scope.correctAnsGiven[i]= 'incorrect';
                        }
                    }else{
                        $scope.hasGradIndex[i] = false;
                    }
                   
                    if($scope.allowPartialGrading){
                        if(  typeof $scope.scoreDetails[i].score ==="number" ){
                            if('partial' in $scope.scoreDetails[i]){
                                $scope.scoreDetails[i].score
                                = $scope.scoreDetails[i].score + $scope.scoreDetails[i].partial;
                                
                            }
                        }
                    }
                   
                     
                    if($scope.quizResponse[i].type!=="info" && $scope.quizResponse[i].type!=="sub"){
                       let stats = $scope.statistics[$scope.quizResponse[i].ref];

                       $scope.statistics[$scope.quizResponse[i].ref] = stats;

                    }else{
                        let stats = $scope.statistics[$scope.quizResponse[i].ref];
                        
                    }
                   
                }
               
                $scope.loadResponseExample();
                
                $scope.loadResponseMcq();
               
                $scope.loadResponseArrange();
                $scope.itemsPerPage = $scope.config.pageSize;
                $scope.currentPage = 1;
                $scope.getStartTime($scope.currentPage);
                $scope.$watch('currentPage + itemsPerPage', function () {
                    var begin = (($scope.currentPage - 1) * $scope.itemsPerPage);
                    var end = begin + $scope.itemsPerPage;
                    $scope.filteredQuestions = $scope.questions.slice(begin, end);
                    $scope.qref = $scope.filteredQuestions[0].ref;
                    $scope.clearJQFill();
                    loadQuizNewTim = $timeout(function () { 
                        $scope.loadResponseFillIn();
                        $scope.initNumOfFillins();
                        $scope.loadSubjective('review'); }, 1500);
                    loadInitTim = $timeout(function () {  initJS('review'); }, 1000);
                    $scope.analytics();
                    

                });
                
                var t = $scope.timeUsed;
                var time = (new Date(t % 86400 * 1000)).toUTCString().replace(/.*(\d{2}):(\d{2}):(\d{2}).*/, "$1:$2:$3");
                $scope.completeTimeTaken = time;
                $("#mcqOptions,#flag-btn,#lock-btn,#arrOptions,#fillinStatement,#topLockIcon").addClass('review');
                $scope.clearTimer();
                $scope.gridMatrix();
                
                $scope.clearVCPTim();
                videoTim= $timeout(function () { dataService.getYtVideo(); }, 2000);
                chartTim= $timeout(function () { dataService.getPlotChart(); }, 2000);
                pdfTim= $timeout(function () { dataService.getPdfDoc();}, 2000);
                $(".pageLoader").fadeOut("slow");
                $scope.isLoad = true;
            }else{
               
                requestService.dbErrorHandler(result.error.code,result.error.type);
            }
        },function(responseError){
            $scope.serverErrorHandling(responseError);
        });

    }
    
    var counter = 0;
    
    $scope.autoSave = function () {
        if (dataService.getData('ATTEMPT') == false) {
            counter++;
            if (counter > 10) {
                counter = 0;
                $scope.onFinish($scope.currentPage);
                $scope.saveResponse('save','autoSave10Click');
            }
        }
    }

    
    $scope.autoSaveWithSec = function (cnt) {
        if( dataService.getData('ATTEMPT') == false &&
            +dataService.getData('LOGGEDIN') == 1){                
                $scope.verifyToken();
                $scope.onFinish($scope.currentPage);
                $scope.saveResponse('save','autoSave60Seconds',false);
        }
    }

   
    $scope.score = function () {
            $("#quiz-ans").show();
            $scope.scrollBody('quiz-ans');
    }

  
    if (dataService.getData('ATTEMPT') == true) {
        $scope.loadQuizReviewNew();
    } else if (dataService.getData('ATTEMPT') == false) {
            
        dataService.onFocusOut($rootScope.allowFC);
        $scope.loadQuizNew();
    }
   
    $scope.initQuestions = 0;
    $scope.offset = 0;
    
    $scope.martixRow = [];
    $scope.matrixPointer = 0;
    $scope.gridMatrix = function () {
        for (var i = 1; i <= $scope.questions.length; i++) {
            $scope.martixRow.push(i);
        }
        initilizeGridRow();
    }

    var initilizeGridRow = function () {
        $scope.gridRow1 = $scope.martixRow.slice($scope.matrixPointer, $scope.matrixPointer + 3);
        $scope.gridRow2 = $scope.martixRow.slice($scope.matrixPointer + 3, $scope.matrixPointer + 6);
        $scope.gridRow3 = $scope.martixRow.slice($scope.matrixPointer + 6, $scope.matrixPointer + 9);
    }

    $scope.nextQus = function () {
        if (($scope.matrixPointer < ($scope.questions.length - 9)) && $scope.questions.length > 9 && ($scope.currentPage >= 6 && $scope.currentPage <= $scope.questions.length - 4)) {
            $scope.matrixPointer++;
            initilizeGridRow();
        }
    }

    $scope.preQus = function () {
        if ($scope.matrixPointer > 0 && ($scope.currentPage >= 4 && $scope.currentPage <= $scope.questions.length - 5)) {
            $scope.matrixPointer--;
            initilizeGridRow();
        }
    }

    $scope.setGridCenter = function (qus) {
        if (qus > 5 && $scope.questions.length <= 9) {
            $scope.matrixPointer = 0;
        } else if (qus > 5 && qus <= $scope.questions.length - 4) {
            $scope.matrixPointer = qus - 5;
        } else if (qus > 5 && qus > $scope.questions.length - 4) {
            $scope.matrixPointer = $scope.questions.length - 9;
        } else if (qus <= 5) {
            $scope.matrixPointer = 0;
        }
        initilizeGridRow();
    }
   
    $scope.goToLast = function () {
        if ($scope.initQuestions != 0) {
            $scope.prevTwentyQuestions();
            $scope.onLeft((($scope.initQuestions + 1) * 20) + 1, $scope.initQuestions * 20 + 20);
        }
    }

    
    $scope.goTo = function (index) {
        if (index > 0 && index <= $scope.totalItems) {
            $scope.currentPage = index;
        }
        $scope.chkQusLock();
    }

    
    $scope.isAnswered = function (index) {
        var answered = 'not-answered';
        $scope.questions[index].object.options.forEach(function (element, index, array) {
            if (element.Selected == true) {
                answered = 'Answered';
                return false;
            }
        });
        return answered;
    };

   
    $scope.doReview = function (currentQues) {
        if ($scope.isReviewQuestions[$scope.currentPage - 1] == 0)
            $scope.isReviewQuestions[$scope.currentPage - 1] = 1;
        else
            $scope.isReviewQuestions[$scope.currentPage - 1] = 0;
        if(!dataService.getData('ISSECTION'))
          $scope.autoSave(); 
    }

   
    $scope.checkReview = function (currentQ) {
        if ($scope.isReviewQuestions[(currentQ - 1)] == 0)
            return false;
        else
            return true;
    }

   
   
    $scope.currentQ = function (id) {
        if ($scope.currentPage == id)
            return true;
        else
            return false;
    }
   
    $scope.checkClick = function () {
        var a = new Date($scope.getClock());
    }

    
    $scope.setHintUsed = function (id) {
        if ($scope.hintUsed[id - 1] == 0) {
            if ($scope.filteredQuestions[0].type != 'info') {
                $scope.hintUsed[id - 1] = 1;
            } 
        }
    }
      
    $scope.getHintUsed = function (id) {
        return $scope.hintUsed[id - 1];
    }
        
    $scope.setExpUsed = function (id) {
        if ($scope.filteredQuestions[0].type != 'info') {
            if ($scope.hintUsed[id - 1] == 1){
                $scope.hintUsed[id - 1] = 2;
            }
               
        } 
    }
    $scope.onLeft = function (currentPage, prev) {
        if (currentPage > 1) {
            $scope.getStartTime(prev);
            $scope.getEndTime(currentPage);
            $scope.getTotalTime(currentPage);
            $scope.goTo(prev);
        }
    }
    $scope.onRight = function (currentPage, next) {
        if (currentPage < $scope.totalItems) {
            $scope.checkClick();
            $scope.getStartTime(next);
            $scope.getEndTime(currentPage);
            $scope.getTotalTime(currentPage);
            $scope.goTo(next);
        }
    }
   
    let graphTimeout = undefined;
    $scope.analytics = function(){
        if(( ($rootScope.allowStats  || $scope.reqBy =='auth')  && $scope.statistics[$scope.qref] !=='na' && $scope.statistics[$scope.qref].gradingIndexExists)){
            $("#quiz-hintExpDiv").html(`<canvas id="hintExpDivGraph" width="400" height="300"></canvas>`);
            $("#quiz-answerDiv").html(`<canvas id="answerGraph" width="400" height="400"></canvas>`);
            $(".summLable").hide();
            $("#canvasguagetimeGraph").html('');
            $("#canvasguagescoreGraph").html('');

    
          
            var chartOptions = {
                responsive: true,
                legend: {
                    position: "bottom"
                },
                title: {
                    display: true,
                    text: "Help used statistics"
                },
                scales: {
                    yAxes: [{
                        ticks: {
                        beginAtZero: true
                        }
                    }]
                }
            }
           
            var Options = {
                responsive: true,
                legend: {
                   position: "bottom"
                },
                title: {
                   display: true,
                   text: "Answered statistics"
                },
                animation:{
                   animateRotate: true
                }
            }

           
            let doughnutdata = {
                datasets: [{
                    data: [$scope.statistics[$scope.qref].correct,$scope.statistics[$scope.qref].incorrect,$scope.statistics[$scope.qref].skipped],
                    backgroundColor: ["#7AC29A" , "#EB5E28","#F3BB45"],
                    hoverBackgroundColor:["#7AC29A" , "#EB5E28","#F3BB45"],
                    hoverBorderColor:["#7AC29A" , "#EB5E28","#F3BB45"]
                
                }],
                labels: [
                    'Correct',
                    'Incorrect',
                    'Skipped'
                ]
            };

           
            var barChartData1 = {
            labels: [
                "Correct",
                "Incorrect",
                "Skipped"
            ],
            datasets: [
                {
                    label: "No Help Used",
                    backgroundColor: "#68B3C8",
                    borderColor: "#68B3C8",
                    borderWidth: 1,
                    barThickness:20,
                    data: [$scope.statistics[$scope.qref].GradMatrix[0][0],$scope.statistics[$scope.qref].GradMatrix[2][0],$scope.statistics[$scope.qref].GradMatrix[1][0]]
                },
                {
                    label: "Hint Only Used",
                    backgroundColor: "#7AC29A",
                    borderColor: "#7AC29A",
                    borderWidth: 1,
                    barThickness:20,
                    data: [$scope.statistics[$scope.qref].GradMatrix[0][1],$scope.statistics[$scope.qref].GradMatrix[2][1],$scope.statistics[$scope.qref].GradMatrix[1][1]]
                }
              ]
            };
           
            var barChartData2 = {
            labels: [
                "Correct",
                "Incorrect",
                "Skipped"
            ],
            datasets: [
                {
                    label: "No Help Used",
                    backgroundColor: "#68B3C8",
                    borderColor: "#68B3C8",
                    borderWidth: 1,
                    barThickness:20,
                    data: [$scope.statistics[$scope.qref].GradMatrix[0][0],$scope.statistics[$scope.qref].GradMatrix[2][0],$scope.statistics[$scope.qref].GradMatrix[1][0]]
                },
                {
                    label: "Hint Only Used",
                    backgroundColor: "#7AC29A",
                    borderColor: "#7AC29A",
                    borderWidth: 1,
                    barThickness:20,
                    data: [$scope.statistics[$scope.qref].GradMatrix[0][1],$scope.statistics[$scope.qref].GradMatrix[2][1],$scope.statistics[$scope.qref].GradMatrix[1][1]]
                },
                {
                    label: "Help used (Both hint and explanation)",
                    backgroundColor: "#F3BB45",
                    borderColor: "#F3BB45",
                    borderWidth: 1,
                    barThickness:20,
                    data:[$scope.statistics[$scope.qref].GradMatrix[0][2],$scope.statistics[$scope.qref].GradMatrix[2][2],$scope.statistics[$scope.qref].GradMatrix[1][2]]
                }
              ]
            };
            
            if(graphTimeout){
                $timeout.cancel(graphTimeout);
                graphTimeout = undefined;
            }
           
            graphTimeout = $timeout(()=>{
                if($scope.sectData.helpAllowed!=0){
                    let hEG = document.getElementById("hintExpDivGraph");
                    if(hEG){
                        var ctx = hEG.getContext("2d");
                        let myBar = new Chart(ctx, {
                            type: 'bar',
                            data: ($scope.sectData.helpAllowed ==1)? barChartData1 : barChartData2 ,
                            options: chartOptions
                        });
                    }
                    
                }else if($scope.sectData.helpAllowed==0){
                   $("#quiz-hintExpDiv").remove();
                   $("#quiz-answerDiv").addClass('col-lg-offset-4');
                }
                let ansG = document.getElementById("answerGraph");
                if(ansG){
                    var ctx1 = ansG.getContext("2d");
                    var myDoughnutChart = new Chart(ctx1, {
                        type: 'doughnut',
                        data: doughnutdata,
                        options: Options
                    });
                }
               
                dataService.createGuage($scope.statistics[$scope.qref],"averagetime","canvasguagetimeGraph");
                dataService.createGuage($scope.statistics[$scope.qref],"averagescore","canvasguagescoreGraph");
                $(".summLable").show();
            },300);

        }

    }

    $scope.showHint = function (id) {
        if ($scope.filteredQuestions[0].type == 'info') {
            let option = {
                placement : {
                    from: "top",
                    align: "center"
                },
                delay: 3000
            };
            $scope.notifyAlertMsg('hintInfo',$scope.lang.caption_hintInfo,option);
            return;
        }

        if($('#quiz-hint').length>0){
            $('#quiz-hint').remove();
        }

        var hint = `
            <div id="quiz-hint" class="col-xs-12 col-md-10 col-md-offset-1 mydivs">
            <div class="card">
                <div class="card-header">
                    <div class="clear-fix">
                        <div class="pull-left">
                            <h4 class="card-title">
                            <b>{{lang.caption_hint}}<b>
                            </h4>
                        </div>
                        <div class="pull-right">
                        <span style="cursor:pointer;" class="label label-default" ng-click="closeHelp('quiz-hint')">&#10006;</span>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <br><hr>
                    <div class="help-content" ng-repeat="question in filteredQuestions">
                      <br>  
                      <span  math="{{ question.object.hint }}"></span>
                    </div>
                </div>
            </div>
          </div>`;

        
        if (dataService.getData('ATTEMPT') == false) {
            $("#quiz-info").append($compile(hint)($scope)); 
            $scope.setHintUsed(id);
            if(!dataService.getData('ISSECTION'))
                $scope.autoSave(); 
        } else {
            $("#quiz-info").append($compile(hint)($scope));
        }
      
        if($("#quiz-hint").length>0){  
            $scope.scrollBody('quiz-hint');
        }
        
    }

    $scope.showExplanation = function (id) {
        
        if ($scope.filteredQuestions[0].type == 'info') {
            let option = {
                placement : {
                    from: "top",
                    align: "center"
                },
                delay: 3000
            };
            $scope.notifyAlertMsg('expInfo',$scope.lang.caption_hintExpl,option);
            return;
        }

        if($('#quiz-explanation').length>0){
            $('#quiz-explanation').remove();
        }
        var exp = `
            <div id="quiz-explanation" class="col-xs-12 col-md-10 col-md-offset-1 mydivs">
            <div class="card">
                <div class="card-header">
                    <div class="clear-fix">
                        <div class="pull-left">
                            <h4 class="card-title">
                             <b>{{lang.caption_explanation}}</b>
                            </h4>
                        </div>
                        <div class="pull-right">
                        <span style="cursor:pointer;" class="label label-default" ng-click="closeHelp('quiz-explanation')">&#10006;</span>
                        </div>
                    </div>
                </div>
                <div class="card-content">
                    <br> <hr>
                    <div class="help-content" ng-repeat="question in filteredQuestions">
                      <br> 
                      <span  math="{{ question.object.explanation }}"></span>
                    </div>
                </div>
            </div>
          </div>`;


        
            if (dataService.getData('ATTEMPT') == false) {
                if ($scope.hintUsed[id - 1] >= 1) {
                    $scope.setExpUsed($scope.currentPage);
                    $("#quiz-info").append($compile(exp)($scope));
                    
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

                if(!dataService.getData('ISSECTION'))
                 $scope.autoSave(); 
            } else {
                $("#quiz-info").append($compile(exp)($scope));
            }
        

       
        if($("#quiz-explanation").length>0){   
            $scope.scrollBody('quiz-explanation');
        }
    }

    $scope.hideAll = function () {
        $("#quiz-instructions").addClass("hide-instruction");
        $("#quiz-hint").remove();
        $("#quiz-explanation").remove();
    }

    $scope.resetAll = function () {
        $("body, html").animate({
            scrollTop: 0
        },500 );

        
        $scope.clearVCPTim();
        videoTim= $timeout(function () { dataService.getYtVideo(); }, 2000);
        chartTim= $timeout(function () { dataService.getPlotChart(); }, 2000);
        pdfTim = $timeout(function () { dataService.getPdfDoc();}, 2000);
    }

    
    $scope.closeInfo = function (id) {
        $("#" + id).toggle();
    }

    $scope.closeHelp = function (id) {
        $("#" + id).remove();
    }
    
    
    $scope.selectAns = function (id, ansId) {
       
        $scope.answSelected[id - 1] = ansId;
    }

    $scope.getTime = function () {
        var d = new Date($scope.getClock());
        return d;
    }

    $scope.getStartTime = function (id) {
        var d = $scope.getTime();
        $scope.Stime[id - 1] = d;
    }

    $scope.getEndTime = function (id) {
        var d = $scope.getTime();
        $scope.Etime[id - 1] = d;
    }

    $scope.getTimeDiff = function (id) {
        var now = $scope.Stime[id - 1];
        var then = $scope.Etime[id - 1];
        var d = then - now;       
        return d;
    }

    
    $scope.onFinish = function (currentPage) {
        $scope.getEndTime(currentPage);
        $scope.getTotalTime(currentPage);
        $scope.getStartTime(currentPage);
    }

    $scope.getTotalTime = function (id) {
        $scope.timeTaken[id - 1] = $scope.timeTaken[id - 1] + ($scope.getTimeDiff(id) / 1000);
    }
    $scope.getTotalTimeOflastQues = function (id) {
        $scope.timeTaken[id - 1] = $scope.timeTaken[id - 1] + ($scope.getTimeDiff(id) / 1000);
    }

    $scope.isSubmitClick = false;
    $scope.finalSubmit =  function(){
        $('.modal').modal('hide');
        $(".pageLoader").show();
         var data = {
            quizId : dataService.getData('QUIZID'),
            uname : dataService.getData('USER'),
            isSection: dataService.getData('ISSECTION'),
            submitReason:submitType
        }

        $scope.isSubmitClick = true;
        requestService.request('POST',true,'/submitQuiz',data).then(function(response){
            var result = response.data;
           
            $rootScope.updateTime(result.time);
            $scope.isSubmitClick = false;
            if(result.status)
            {
                    dataService.setData('ATTEMPT', true);
                    if ($scope.chkEndDate()) {                     
                      dataService.setData('VIEWRES', true);
                    }

                         
                     $('.overlay-div').css("visibility", "hidden");
                     $("body").css("overflow","");
                  
                    
                    $location.path("/quiz-summary");
                    
            }else{
                $(".pageLoader").fadeOut("slow");
                requestService.dbErrorHandler(result.error.code,result.error.type);
            }
            $scope.submitBtnClick = false;

        },function(errorResponse){
            $(".pageLoader").fadeOut("slow");
            $scope.serverErrorHandling(errorResponse);
            $scope.isSubmitClick = false;
            $scope.submitBtnClick = false;            
               
        })

    }

    $scope.serverErrorHandling = function(errorResponse){
        console.log('serverErrorHandling----');
        console.log(errorResponse);
        dataService.swalAndRedirect($scope.lang['alert_unable_connect'],'warning','btn-warning','serverErr');
    }

    $scope.submitQuizWithConfirm = function(){    
        swal({
            title: $scope.lang.caption_sure,
            text: $scope.lang.caption_restartWarning,
            type: 'warning',
            showCancelButton: true,
            confirmButtonClass: 'btn btn-success btn-fill',
            cancelButtonClass: 'btn btn-danger btn-fill',
            confirmButtonText: $scope.lang.caption_yes,
            buttonsStyling: false
        }).then(function() {
           
            if(!$scope.resquestSend){
                $scope.onFinish($scope.currentPage);
                $scope.clearNotifyAlert();
                submitType = 'manual';
                $scope.saveResponse('submit','beforeSubmit');  
            }
        },function() {
            
        });
     

    }

    $scope.clearCurrentSecLS = function(){
        let quizSecId =  `${dataService.getData('QUIZID')}${dataService.getData('USER')}${$scope.sectionNumber}`.toLowerCase();
        dataService.clearSectionLS('subjective',quizSecId);
    }

    $scope.submitBtnClick = false;
   
    $scope.saveResponse = function (val,savetype,notify=true) {
        $scope.resquestSend = true;
        $scope.quizResponse = {};
        var lastQue =  $scope.currentPage;        
        $scope.quizResponse.response = [];
        for (var i = 0; i < $scope.totalItems; i++) {
            $scope.quizResponse.response[i] = {};
            $scope.quizResponse.response[i].ref = $scope.questions[i].ref;
            $scope.quizResponse.response[i].type = $scope.questions[i].type;
            $scope.quizResponse.response[i].timeTaken = $scope.timeTaken[i];
            $scope.quizResponse.response[i].helpUsed = $scope.hintUsed[i];
            $scope.quizResponse.response[i].lock = $scope.lock[i];
            $scope.quizResponse.response[i].review = $scope.isReviewQuestions[i];
            $scope.quizResponse.response[i].tempAns = $scope.tempAns[i];
            if($scope.questions[i].type == 'sub'){
                $scope.quizResponse.response[i].answerId = $scope.lock[i]? 1: -1;
            }else{
                $scope.quizResponse.response[i].answerId = $scope.lock[i]? $scope.tempAns[i]: -1;
            }
            
        }

        if (val == 'save'){
            requestService.request('POST',true,'/saveResp', { 'examId': $rootScope.activeQuiz,saveType:savetype, 'resData': $scope.quizResponse ,lastQue:lastQue}).then(function(response){
                var result = response.data;       
               
                $rootScope.updateTime(result.time);

                $scope.resquestSend = false; 
                if(result.status)
                {
                    if(notify){
                        helperService.notifyMsg('ti-save', 'success', $scope.lang.msg_saveResponse, 'top', 'left');
                    }
                  
                    $scope.clearCurrentSecLS();
                    
                }else{
                    requestService.dbErrorHandler(result.error.code,result.error.type);
                }

            },function(errorResponse){
                $scope.resquestSend = false;
                $scope.serverErrorHandling(errorResponse);
              
            });

        }
        else if (val == 'exit') {
            requestService.request('POST',true,'/saveResp', { 'examId': $rootScope.activeQuiz,saveType:savetype, 'resData': $scope.quizResponse ,exit:true,lastQue:lastQue}).then(function(response){
                    var result = response.data;  
                   
                    $rootScope.updateTime(result.time);
                    $scope.resquestSend = false;
                    if(result.status){ 
                       
                        $scope.clearCurrentSecLS();
                        $scope.loggedOut();
                    }else{
                        requestService.dbErrorHandler(result.error.code,result.error.type);
                    }
    
                },function(errorResponse){
                    $scope.resquestSend = false;
                    $scope.serverErrorHandling(errorResponse);
                    
                });
           
        }        
        else if (val == 'submit') {
            $scope.isLoad = false;
            $scope.submitBtnClick = true;
            $(".pageLoader").fadeIn("slow");

            $scope.clearTimer();
            $scope.clearNotifyAlert();
           
            requestService.request('POST',true,'/saveResp', { 'examId': $rootScope.activeQuiz,saveType:savetype, 'resData': $scope.quizResponse ,lastQue:lastQue}).then(function(response){
                    var result = response.data;       
                      
                    $rootScope.updateTime(result.time);

                    $scope.resquestSend = false;
                    if(result.status){
                      
                        $scope.clearCurrentSecLS();
                        $scope.startQuiz('quiz');                
                        if(dataService.getData('ISSECTION')){
                        
                            if($scope.sections.length==1)
                            {
                              $scope.finalSubmit();
                            }else{
                                 
                                $scope.submitBtnClick = false;        
                                $location.path("/start");  
                            }

                        }else{
                                         
                            $scope.finalSubmit()
                        }

                    }else{
                        $scope.submitBtnClick = false;
                        requestService.dbErrorHandler(result.error.code,result.error.type);
                    }
                    
            },function(errorResponse){
                $scope.resquestSend = false;
                $scope.submitBtnClick = false;
                $scope.serverErrorHandling(errorResponse);
            });
            
        }
               
    }

    
    $scope.goToSummary = function(){
       $scope.clearNotifyAlert();
       $scope.startQuiz('quiz'); 
       $location.path("/start");
    }

    $scope.saveAndExit = function(){
      
        if($scope.resquestSend){
            return;
        }
       
        $("#exitSec").button('loading');
        $scope.clearNotifyAlert();
        var currentPage = $scope.currentPage;
        $scope.onFinish(currentPage);
        $scope.quizResponse = {};
        $scope.quizResponse.response = [];
        for (var i = 0; i < $scope.totalItems; i++) {
            $scope.quizResponse.response[i] = {};
            $scope.quizResponse.response[i].ref = $scope.questions[i].ref;
            $scope.quizResponse.response[i].type = $scope.questions[i].type;
            $scope.quizResponse.response[i].timeTaken = $scope.timeTaken[i];
            $scope.quizResponse.response[i].helpUsed = $scope.hintUsed[i];
            $scope.quizResponse.response[i].lock = $scope.lock[i];
            $scope.quizResponse.response[i].review = $scope.isReviewQuestions[i];
            $scope.quizResponse.response[i].tempAns = $scope.tempAns[i];
            if($scope.questions[i].type == 'sub'){
                $scope.quizResponse.response[i].answerId = $scope.lock[i]? 1: -1;
            }else{
                $scope.quizResponse.response[i].answerId = $scope.lock[i]? $scope.tempAns[i]: -1;
            }
            
        }

        if($scope.mode == 'quiz'){
            $scope.resquestSend = true;
            requestService.request('POST',true,'/saveResp', { 'examId': $rootScope.activeQuiz,saveType:'exitQuizSection', 'resData': $scope.quizResponse ,lastQue:currentPage,exit:true}).then(function(response){
                var result = response.data;
                
                $rootScope.updateTime(result.time);
                $scope.resquestSend = false;
                $('.modal').modal('hide');
                if(result.status){
                    
                    $scope.clearCurrentSecLS();
                    if($("html").hasClass("nav-open")){
                        $('.navbar-toggle').click(); 
                    }
                    $("#exitSec").button('reset');
                    $scope.clearTimer(); 
                    $scope.startQuiz('quiz'); 
                    $location.path("/start");
    
                }else{
                    $("#exitSec").button('reset');
                    requestService.dbErrorHandler(result.error.code,result.error.type);
                }
    
            },function(errorResponse){
                $('.modal').modal('hide');
                $("#exitSec").button('reset');
                    console.log('Server Error');
                    console.log(errorResponse);
                $scope.resquestSend = false;
            });

        }else{
            if($("html").hasClass("nav-open")){
                $('.navbar-toggle').click(); 
            }
            $("#exitSec").button('reset');
            $scope.clearTimer(); 
            $scope.startQuiz('quiz'); 
            $location.path("/start");

        }
    }

  
    $scope.showSumm = false;
    $scope.getSummary = function () {
        var finaldate = new Date($scope.getClock());
        $scope.summary = [];
        for (var i = 0; i < 2; i++) {
            $scope.summary.push(0);
        }
        for (var i = 0; i < $scope.totalItems; i++) {
            if ($scope.answSelected[i] == -1)
                $scope.summary[0]++;
            else
                $scope.summary[1]++;
        }
        $scope.showSumm = true;
        $scope.timeTakenToComplete = $scope.hh + ':' + $scope.mm + ':' + $scope.ss;
    }

    
    $scope.validateForm = function () {
        var inputCount = document.getElementById('divFillInBlank').getElementsByTagName('input').length;
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
        if(!dataService.getData('ISSECTION')){
            $scope.autoSave(); 
        } 
        
        if ($scope.questions[$scope.currentPage - 1].type == 'fillIn') {
            if ($scope.lock[$scope.currentPage - 1]) {
                
                $scope.selectAns($scope.currentPage, -1); 
                $scope.lock[$scope.currentPage - 1] = false; 
                $(".fillInOption").removeClass('disable-block');
            }
            else {

                let lockData = $scope.validateForm();
                if (!lockData.status) {
                    let option = {
                        placement : {
                            from: "top",
                            align: "center"
                        },
                        delay: 2000
                    };
                    $scope.notifyAlertMsg('lock',lockData.msg,option);
                    $scope.lock[$scope.currentPage - 1] = false;
                }
                else {
                    $(".fillInOption").addClass('disable-block');
                    var inputCount = document.getElementById('divFillInBlank').getElementsByTagName('input').length;
                    var temp = {};
                    for (var i = 0; i < inputCount; i++) {
                        var name = document.getElementById('divFillInBlank').getElementsByTagName('input')[i].getAttribute("name");
                        var type = document.getElementById('divFillInBlank').getElementsByTagName('input')[i].getAttribute("type");
                        var value = document.getElementsByName(name)[0].value;
                        if (type == 'number') {
                            value = parseFloat(value);
                            temp[name] = value;
                        } else if (type == 'text') {
                            temp[name] = value;
                        }
                    }
                    $scope.selectAns($scope.currentPage, temp);
                    var newtemp = JSON.stringify(temp);
                    $scope.tempAns[$scope.currentPage - 1] = JSON.parse(newtemp);
                    $scope.lock[$scope.currentPage - 1] = true;
                }
            }
        }
        else if ($scope.questions[$scope.currentPage - 1].type == 'arrange') { 
            if ($scope.lock[$scope.currentPage - 1]) {  
                var tmp = angular.copy($scope.swapOptions);
                for (var i = 0; i < tmp.length; i++) {
                    tmp[i] = tmp[i] * -1;
                }
                $scope.selectAns($scope.currentPage, tmp);
                $scope.lock[$scope.currentPage - 1] = false;
            }
            else {
                var tmp = [];
                tmp = $scope.swapOptions;
                for (var i = 0; i < tmp.length; i++) {
                    tmp[i] = Math.abs(tmp[i]);
                }
                $scope.selectAns($scope.currentPage, $scope.swapOptions);
               
                $scope.tempAns[$scope.currentPage - 1] = $scope.swapOptions;
                $scope.lock[$scope.currentPage - 1] = true;       
            }
        }
        else if ($scope.questions[$scope.currentPage - 1].type == 'mcq') {
            if ($scope.lock[$scope.currentPage - 1]) {
                $scope.lock[$scope.currentPage - 1] = false;
                $scope.selectAns($scope.currentPage, -1);
            } else {
                if ($scope.tempAns[$scope.currentPage - 1] == -1) {
                    let option = {
                        placement : {
                            from: "top",
                            align: "center"
                        },
                        delay: 2000

                    };
                    $scope.notifyAlertMsg('lock',$scope.lang.alert_mcqSelect,option);
                   
                } else {
                    $scope.lock[$scope.currentPage - 1] = true;
                    $scope.selectAns($scope.currentPage, $scope.tempAns[$scope.currentPage - 1]);
                }
            }
        }
        else if ($scope.questions[$scope.currentPage - 1].type == 'info') {
            if ($scope.lock[$scope.currentPage - 1]) {
                $scope.lock[$scope.currentPage - 1] = false;
                $scope.selectAns($scope.currentPage, -1);
            } else {
                $scope.lock[$scope.currentPage - 1] = true;
                $scope.selectAns($scope.currentPage, $scope.tempAns[$scope.currentPage - 1]);
            }
        }
        else if($scope.questions[$scope.currentPage - 1].type === 'sub'){
            $scope.subDBStatus = 'none';
            $scope.clearNotifyAlert('maxSubShape');

            if ($scope.lock[$scope.currentPage - 1]) {
                $scope.lock[$scope.currentPage - 1] = false;
                $scope.selectAns($scope.currentPage, -1);
                
            } else {
                if ($scope.tempAns[$scope.currentPage - 1] != -1) {
                    if('text' in $scope.tempAns[$scope.currentPage - 1]){
                        let charCount = $scope.countCharacter( $scope.tempAns[$scope.currentPage - 1]['text']);
                        if(charCount>$scope.filteredQuestions[0].object.limit){
                            $scope.notifyAlertMsg('ck',$scope.lang.alert_subjective_limit); 
                            return;
                        }
                    }
                    
                }else{
                    $scope.tempAns[$scope.currentPage - 1] = {
                        'text' : '',
                        'drawing' : [],
                        'lastUpdate': new Date().getTime()
                    }
                }

                $scope.lock[$scope.currentPage - 1] = true;
              
                $scope.selectAns($scope.currentPage, 1);
            }
        }
    }

    
    $scope.lockToggle = function (ansId) {
        var temp = ansId;
        if (document.getElementById(temp).checked) {
            $scope.lock[$scope.currentPage - 1] = true;
            $scope.selectAns($scope.currentPage, ansId);
          
            $scope.tempAns[$scope.currentPage - 1] = ansId;
        } else {
            $scope.lock[$scope.currentPage - 1] = false;
            $scope.selectAns($scope.currentPage, -1);
        }

        if(!dataService.getData('ISSECTION'))
          $scope.autoSave(); 
    }
    
    
    $scope.quizOptions = [
        { url: 'app/views/Options/mcq.html?v='+version },
        { url: 'app/views/Options/arrange.html?v='+version },
        { url: 'app/views/Options/fill.html?v='+version },
        { url: 'app/views/Options/info.html?v='+version },
        { url : 'app/views/Options/subjective.html?v='+version }
    ];
      
    $scope.flag = false;
    $scope.ToID = -1; 
    $scope.FromID = -1; 
    $scope.flag2 = false;
    $scope.isFlag = function () {
        return $scope.flag;
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
        $scope.arrangeType[$scope.currentPage - 1] = temp;
        $scope.selectAns($scope.currentPage, $scope.arrangeType[$scope.currentPage - 1]); 
        $scope.tempAns[$scope.currentPage - 1] = $scope.arrangeType[$scope.currentPage - 1];
        $scope.lock[$scope.currentPage - 1] = true;
    }
    
    $scope.getType = function (id) {
        var index = 0;
       
        if ($scope.questions[id - 1].type == 'mcq'){
            index = 0;
        }
           
       
        if ($scope.questions[id - 1].type == 'fillIn') {
            index = 2;
          
        }
    
        if ($scope.questions[id - 1].type == 'info') {
            index = 3;
        }
      
        if ($scope.questions[id - 1].type == 'arrange') {
            index = 1;
            $scope.swapOptions = $scope.arrangeType[$scope.currentPage - 1];
        }
       
        return index;
    }

    
    $scope.getQuestionTemplateName = (id) => {
      
        let templList = {
            "mcq": "app/views/Options/mcq.html?v="+version,
            "fillIn": "app/views/Options/fill.html?v="+version,
            "arrange": "app/views/Options/arrange.html?v="+version,
            "info": "app/views/Options/info.html?v="+version,
            "sub" : "app/views/Options/subjective.html?v="+version
            
        }
       
        if ($scope.questions[id - 1].type == 'arrange') {
            $scope.swapOptions = $scope.arrangeType[$scope.currentPage - 1];
        }
        return templList[$scope.questions[id - 1].type]
    }

    
    $scope.saveFillIn = function () {
        var inputCount = document.getElementById('divFillInBlank').getElementsByTagName('input').length;
    }

    $scope.AppendText = function () {
        var myEl = angular.element(document.querySelector('#divID'));
        myEl.append($scope.filteredQuestions[0].object.statement);
    }
    

   
    $scope.loggedOut = function () {
        dataService.loggoutWithReason('loggedOut');
    }

    
    $scope.verifyToken = function () {        
       
            var lastQuestion = $scope.currentPage;
            requestService.request('POST',true,'/verifyToken',{"userId": dataService.getData('USER'), "quizId": dataService.getData('QUIZID'),"lastQuestion":lastQuestion }).then(function(response){                 
            var result = response.data;
           
            $rootScope.updateTime(result.time);

            if(!result.status)
            {  
              dataService.swalAndRedirect($scope.lang.alert_sessionExpired,'warning','btn-warning','loggedOutSessionExpired');
            }
            },function(err){
                var msg = $scope.lang['alert_unable_connect'];
                dataService.swalAndRedirect(msg,'warning','btn-warning','loggedOutSessionExpired');
            });
        


    };

   
    $scope.expand = function (name) {
        var obj = $("input[name='" + name + "']");
        obj.css('width', (((obj.val()).toString().length + 8) * 8) + 'px');
    }

    
    $scope.resizeBlock = function () {
        $("#qusBlock").resizable({ minHeight: 258 });
    }

    
    
    $scope.calc = function () {        
        $("#calc").css("display", "block");
        $('#display').focus();
    }


    $scope.showSubmitBtn = function(){
       var isSection = dataService.getData('ISSECTION');
       var attempt = dataService.getData('ATTEMPT');       
        if(isSection==true)
        {   
            if($scope.sections.length==1)
            {
                if(attempt==true)
                 return true;
                else
                 return false; 

            }else
             return  true;
        }else{
         
            if(attempt==true)
             return true;
            else
             return false; 
        }
        
    }


    $scope.showExitBtn = function(){
        var isSection = dataService.getData('ISSECTION');
        if(isSection==true)
        {   
            if($scope.sections.length==1)
            {
                 return false; 

            }else
             return  true;
        }else        
            return false;

    }
    
   

    $scope.$on("changeUILanguage",function(e,data){       
        $scope.lang = data.language; 
        if(typeof(Storage) !== "undefined") {
            if (sessionStorage.language) {
                $scope.langName = sessionStorage.language;
            }
        }
    })

    $scope.$on("onFocusOutWin",function(e,data){        
        if(data.hash=="/quiz"){
            if (+dataService.getData('LOGGEDIN') == 1 && $scope.mode=='quiz') {
                $scope.onFinish($scope.currentPage);
                $scope.saveResponse('save','saveBeforeFocusOut',false); 
                $scope.clearTimer();
            }
           
        }      
        
    })

   

    $scope.showUserDetail = function(prop){
        return dataService.isShowUserDetail(prop);
    }

}]); 




