//"use strict";
app.controller("graderCtrl", ["$scope","$http","$timeout","$interval","$compile","$rootScope","$location","dataService","helperService","requestService","$window","$state","$sce","$stateParams",function ($scope,$http,$timeout,$interval,$compile,$rootScope,$location,dataService,helperService,requestService,$window,$state,$sce,$stateParams ) {

document.title = "Examineer | Grader"
$scope.isLoad = false;
$scope.isError = false;
$scope.isFinalize = false;
$scope.lang = $rootScope.language;
$scope.history = [];
$scope.activeQues = {};
$scope.selectAnsOption = -1;//correct,incorrect,skipped
$scope.selectScore = 0 //initially selectScore 0
$scope.allGraded = false;
$scope.showQuestion = true;
$scope.errorMsg = ''; 
$scope.maximumScore = 0;
$scope.minimumScore = 0;
$scope.questionRef = null;
$scope.addRubric = false;
$scope.selected = {};
$scope.newRub = {};
let notifyAlert = {};
//scoreRange,quizFinalize,selectAns,notNumber,textReq,revMismatch,saveError
$scope.notifyAlertMsg = function (key, msg, option = {}) {
  if (!notifyAlert[key]) {
    let placement = {
      from: "top",
      align: "center",
    };
    if ("placement" in option) {
      placement = option.placement;
    }
    let delay = -1;
    if ("delay" in option) {
      delay = option.delay;
    }

    let type = "warning";
    if ("type" in option) {
      type = option.type;
    }

    let icon = "ti-alert";
    if ("icon" in option) {
      icon = option.icon;
    }
    

    notifyAlert[key] = $.notify(
      {
        icon: icon,
        message: msg,
      },
      {
        type: type,
        newest_on_top: true,
        delay: delay,
        placement: placement,
        onClose: function () {
          notifyAlert[key] = undefined;
        },
      }
    );
  }
};

$scope.toggleAddRubric = function(value){
  $scope.addRubric = value;
  $scope.newRub = {
    text:'',
    value:''
  }
}

$scope.toggleMarks = function(id){
  if($scope.isFinalize){
    return;
  }
  if($scope.checkAnsSelect()){
    return;
  }
  const index = $scope.activeQues.rubricSetting.rules.findIndex(rub=>rub.id==id);
  $scope.activeQues.rubricSetting.rules[index]['selected'] = !$scope.activeQues.rubricSetting.rules[index]['selected'];
  $scope.minMaxCheck();
}

$scope.editRubric = function(rub){
  $scope.selected = angular.copy(rub);
  const index = $scope.activeQues.rubricSetting.rules.findIndex(rubr=>rubr.id ==rub.id);
  $scope.activeQues.rubricSetting.rules[index]['selected'] = false; 
}

$scope.cancelRubric = function(){
  $scope.selected = {};
}

$scope.updateRubric = function(rub){
  if($scope.httpReq){
    return;
  }
  const revId = $scope.activeQues.rubricSetting.revId;
  if(!$scope.validateRubrics(rub)){
    return;
  }
  $scope.updateDeleteRubric(rub);
}

//save , add,delete
$scope.AddUpdateDelete = function(response,action,rubId=null){
  if(response.data.status){
    const data = response.data.data;
    
    if(!data.updated && data.reason =="revMismatch"){
      $scope.notifyAlertMsg("revMismatch", 'Error in updating rubrics. Someone else has modified the rubrics since you last loaded it. New rubrics is loaded. Please try again.',{
        delay: 4000,
        type:"danger"
      });
      $scope.activeQues.rubricSetting = data.updatedRubrics;
      $scope.sc.adjustment = 0;
    }else{
      if(action=="add"){
        data.addedRubrics['selected'] = false;
        $scope.activeQues.rubricSetting.rules.push(data.addedRubrics); //add
        $scope.toggleAddRubric(false);
      }else{
        //update,delete
        const index = $scope.activeQues.rubricSetting.rules.findIndex(rubr=>rubr.id ==rubId);
        data.updatedRule['selected'] = false;
        $scope.activeQues.rubricSetting.rules[index]= data.updatedRule;
        $scope.cancelRubric();
      }
      
    }
    $scope.activeQues.rubricSetting['revId'] = data['updatedRevId'];
    $scope.activeQues.rubricSetting.rules.sort((a,b)=>b.value-a.value);
  }else{
    const error = response.data.error;
    if(error.code==="alert_addRuleDisabled" || error.code==="alert_quizFinal"){
      $scope.activeQues.rubricSetting['editable'] = false;
      $scope.toggleAddRubric(false);
      $scope.cancelRubric();
      if(error.code==="alert_quizFinal"){
        $scope.isFinalize = true;
      }
    }
    $scope.notifyAlertMsg("saveError", $scope.lang[error.code],{
      delay: 3000,
      type:$scope.lang[error.type]
    });
  }
  $scope.httpReq= false;
}  

$scope.updateDeleteRubric = function(rub,doDelete=false){
  $scope.httpReq = true;
  let reqData = {
    revId: $scope.activeQues.rubricSetting.revId,
    text: rub.text,
    value: rub.value,
    deleted:doDelete?true:undefined,
    ruleId:rub.id,
    graderToken: $scope.graderToken
  }
  
  requestService.request("POST", true, "/grader/rubrics", reqData).then(
    function (response) {
      $scope.AddUpdateDelete(response,'update',rub.id);
      $scope.httpReq= false;
      //const data = response.data.data;
    },function(error){
      console.log(error);
      $scope.httpReq= false;
  });
  

}

$scope.delRubric = function(rub){
  if($scope.httpReq){
    return;
  }

  swal({
    text: `Are you sure you want to delete this rule ?`,
    type: "warning",
    showCancelButton: true,
    confirmButtonClass: "btn btn-success btn-fill",
    cancelButtonClass: "btn btn-danger btn-fill",
    confirmButtonText: 'Yes',
    buttonsStyling: false,
  }).then(
  function () {
    $scope.updateDeleteRubric(rub,true);
  },
  function () {
    $scope.httpReq = false;
  });
}

$scope.getTemplate = function (rub) {
  if(!rub.deleted){
    if (rub.id === $scope.selected.id) return 'rubricEdit';
    else return 'rubricDisplay';
  }
  
};

$scope.errorHandling = function(msg,isError=true){
  $timeout(()=>{
    $scope.isError = isError
    $scope.errorMsg = $scope.lang[msg];
    $(".pageLoader").fadeOut("slow");
    $(".fetchLoader").hide();
  },1000);
}

$scope.validateRubrics = function(data){
  const option = {
    delay: 2000,
    type:"danger",
  };
  
  if(isNaN(+data.value) || +data.value==0 || data.value.toString().trim() == ''){
    $scope.notifyAlertMsg("notNumber", `Score must be valid numerical value and not equal to zero`, option);
    return false;
  }
  if(data.text.trim() ===''){
    $scope.notifyAlertMsg("notNumber", `Please enter valid text`, option);
    return false;
  }
  return true;
}

$scope.httpReq= false;
$scope.saveRubric = function(){
  if($scope.httpReq){
    return;
  }
  if(!$scope.validateRubrics($scope.newRub)){
    return;
  }
  $scope.httpReq = true;
  //$('#rubricsDiv').scrollTop($('#rubricsDiv')[0].scrollHeight);
  let reqData = {
    revId: $scope.activeQues.rubricSetting.revId,
    text: $scope.newRub.text,
    value: $scope.newRub.value,
    graderToken: $scope.graderToken
  }
  requestService.request("PUT", true, "/grader/rubrics", reqData).then(
    function (response) {
      //console.log(JSON.stringify(response.data,null,2));
      $scope.AddUpdateDelete(response,'add');
    },function(error){
      console.log(error);
      $scope.httpReq= false;
  });

}

$scope.scrollBody = function (id) {
  var position = $("#" + id).offset().top;
  $("body, html").animate(
    {
      scrollTop: position - 80,
    },
    500
  );
};


$scope.getSubSvgImg = function (draw) {
  return $sce.trustAsHtml(LC.renderSnapshotToSVG(draw));
};

$scope.prev = function(){
  $scope.selectedQusIndex = $scope.selectedQusIndex -1;
  const quesId = $scope.history[$scope.selectedQusIndex].queId || 'random';
  $scope.fetchQuestion(quesId);
}
$scope.next = function(){
  $scope.selectedQusIndex = $scope.selectedQusIndex + 1;
  let quesId = 'random';
  if($scope.selectedQusIndex < $scope.history.length){
      quesId = $scope.history[$scope.selectedQusIndex].queId;
  }
  $scope.fetchQuestion(quesId);
}

$scope.goTo = function(index){
  $scope.selectedQusIndex = index;
  const quesId = $scope.history[$scope.selectedQusIndex].queId;
  $scope.fetchQuestion(quesId);
}

$scope.divStatus = function(){
  if((!$scope.allGraded || $scope.showQuestion)){
    return true;
  }else{
    return false;
  }
}

$scope.reset = function(){
  $scope.selectAnsOption = -1;
  $scope.sc.note = '';
  $scope.sc.adjustment = 0;
  $scope.selectScore = 0;
  $scope.lastGradedTime='';
}

$scope.changeAnsStatus = function(status){
  $scope.selectAnsOption = status;
  $scope.selectScore = status==2?0:$scope.activeSection.gradingMatrix[status][$scope.activeQues.response.helpUsed];
  $scope.sc.adjustment = 0;
  $scope.minMaxCheck();
}

$scope.checkQuizFinalize = function(showMess=false){
  if($scope.isFinalize){
    $scope.activeQues.rubricSetting['editable'] = false;
    if(showMess){
      $scope.notifyAlertMsg("finalize", `This quiz has been finalized`, {
        delay: 4000,
        type:"info",
      });
    }
    
    $scope.cancelRubric();
    $scope.toggleAddRubric(false);
  }
}

let otherDocsTimer = null;
//Fetch question
$scope.fetchQuestion = function(quesId='random'){
  const reqData = {
    "queId": quesId,
    "graderToken": $scope.graderToken,
  }

  if(!firstCall){
    $(".fetchLoader").show();
  }

  $.notifyClose();
  notifyAlert = {};
  $scope.toggleAddRubric(false);
  $scope.cancelRubric();
  requestService.request("POST", true, "/grader/question", reqData).then(
  function (response) {
    //success handler
    const defaultRubricSetting = {
      adjEnabled:false,
      editable:false,
      rules:[],
      revId:''
    }
    const res = response.data;
    if(res.status){
      const data = res.data;
      $scope.sectionKey = +data.sectionKey;
      $scope.activeSection = $scope.sections[$scope.sectionKey-1];
      $scope.activeQues = {
        question :data.question,
        answer :data.answer,
        response : data.response,
        graded:data.graded,
        queId:data.queId,
        rubricSetting:data.rubricSetting || defaultRubricSetting
      }
      let rubrics = [];
      $scope.maximumScore = $scope.activeSection.gradingMatrix[0][data.response.helpUsed];
      $scope.minimumScore = $scope.activeSection.gradingMatrix[2][data.response.helpUsed];

      if($scope.activeQues.graded){
        $scope.selectAnsOption = data.grade.gradingIndex[0];
        $scope.sc.note = data.grade.graderNote?data.grade.graderNote.trim():'';
        $scope.sc.adjustment = $scope.activeQues.rubricSetting.adjEnabled?data.grade.adjustment:0;
        const setRubrics = data.grade.rubrics || [];
        $scope.selectScore = $scope.selectAnsOption==2?0:$scope.activeSection.gradingMatrix[$scope.selectAnsOption][data.response.helpUsed];
        $scope.lastGradedTime = data.grade.updatedAt;
        rubrics = $scope.activeQues.rubricSetting.rules.map(x=>{
          x['selected'] = setRubrics.indexOf(x.id)!==-1?true:false;
          return x;
        });

      }else{
        rubrics = $scope.activeQues.rubricSetting.rules.map(x=>{
          x['selected'] = false;
          return x;
        });
        $scope.reset();
      }
      $scope.activeQues.rubricSetting.rules = rubrics;
      //sort rubrics
      $scope.activeQues.rubricSetting.rules.sort((a,b)=>b.value-a.value);
      $scope.showQuestion = true;
      //check quiz is finalized
      $scope.isFinalize = data.finalized;
      $scope.checkQuizFinalize(); 
      
      $timeout(() => {
        $(".pageLoader").fadeOut("slow");
        $(".fetchLoader").hide();
        $scope.isLoad = true;
        firstCall = false;
      }, 500);

      if (otherDocsTimer) {
        $timeout.cancel(otherDocsTimer);
        otherDocsTimer = null;
      }

      otherDocsTimer = $timeout(function () {
        dataService.getYtVideo();
        dataService.getPlotChart();
        dataService.getPdfDoc();
      }, 2000);

    }else{
      $scope.showQuestion = false;
      $scope.activeQues['graded'] = false;
      $scope.activeQues['rubricSetting'] = defaultRubricSetting;
      $scope.reset();
      $scope.maximumScore = 0;
      $scope.minimumScore = 0;
      $scope.isLoad = true;// TRL
      firstCall = false;
      const errorCode = res.error.code;
      let isError = true;
      if(errorCode==='msg_graderDone'){
        $scope.allGraded = true;
        isError = false;
      }
      if(errorCode ==="alert_quizFinal"){
        $scope.isFinalize = true;
        $scope.activeQues.rubricSetting['editable'] = false;
        isError = false;
        $scope.allGraded = true;
      }
      $scope.errorHandling(errorCode,isError);
    }
        
  },function(error){
      console.log("Server Error");
      console.log(JSON.stringify(error,null,2));
      $scope.errorHandling('msg_server_error');
  });
}
  
$scope.minMaxCheck = function(){
  const score = +$scope.scoreAfterAdjustment();
  if(score>$scope.maximumScore  || score < $scope.minimumScore){
    const option = {
      delay: 2000,
      type:"danger",
    };
    $scope.notifyAlertMsg("scoreRange", `Score must be in the range of ${$scope.minimumScore} to ${$scope.maximumScore}`, option);
    return false;
  }
  return true;
  
}

let firstCall = true;
//Grader Login
$scope.graderLogin = function () {
  const location = $location.search();
  if (location.token) {
      const reqData = {
          "token": location.token,
      }
     
      requestService.request("POST", true, "/grader/login", reqData).then(
          function (response) {
            //success handler
            const res = response.data;
            if(res.status){
              const data = res.data;
              $scope.graderToken = data.graderToken;
              $scope.quizInfo = data.meta;
              $scope.quizInfo.beginTime = new Date($scope.quizInfo.beginTime).toString();
              $scope.quizInfo.endTime = new Date($scope.quizInfo.endTime).toString();
              $scope.sections = data.meta.sections;
              $scope.quizId =  data.meta.quizid;
              $scope.history = data.history;
              $scope.graderName = data.grader;
              $scope.selectedQusIndex = $scope.history.length;
              $scope.questionRef = data.questionRef;
              $scope.isFinalize = data.finalized;
              //$scope.updateGridScore(); //grid scrore
              $scope.fetchQuestion('random');
            }else{
              //console.log("error");
              //console.log(res);
              $scope.errorHandling(res.error.code);
            }
              
          },function(error){
            console.log("Server Error");
            console.log(JSON.stringify(error,null,2));
            $scope.errorHandling('msg_server_error');
      })

      
  } else {
    //console.log("invalid Link");
    $scope.errorHandling('msg_graderNotFound');
  }

  
};

//starting
$scope.graderLogin();
$scope.navBarHandler = function(){
  if ($("html").hasClass("nav-open")) {
    $(".menuBtnToggler").html('<i class="fa fa-bars"></i>');
    $("html").removeClass("nav-open")
  }else{
    $(".menuBtnToggler").html('<i class="fa fa-times"></i>');
    $("html").addClass("nav-open")

  }
}

$scope.sc = {
  adjustment:0,
  note:'',
};

$scope.checkAnsSelect = function(){
  if($scope.selectAnsOption === -1){
    const option = {
      delay: 3000,
      type:"danger"
    };
    $scope.notifyAlertMsg("selectAns", "Please select base score first", option);
    return true;
  }
  return false;
}

$scope.grade = function(){
  if($scope.showQuestion == false){
    return;
  }

  if($scope.checkAnsSelect()){
    return;
  }
    
  let adjustment = +$scope.sc.adjustment;
  if(isNaN(adjustment)){
    adjustment = 0;
  }
  const rubrics = $scope.activeQues.rubricSetting.rules.filter(x=>x['selected']==true && !x['deleted']).map(x=> x.id);
  //score validation
  if(!$scope.minMaxCheck()){
    return;
  }
  
  let reqData = {
    "queId": $scope.activeQues.queId,
    "index": [$scope.selectAnsOption,$scope.activeQues.response.helpUsed],
    "adjustment":adjustment,
    "graderToken": $scope.graderToken,
    "rubrics":rubrics
  }
  
  if($scope.sc.note.trim() !== ''){
    reqData['note'] = $scope.sc.note.trim();
  }
  let alreadyGrade = false
  if($scope.activeQues.graded){
    alreadyGrade = true;
  }

  
  $(".fetchLoader").show();
  requestService.request("POST", true, "/grader/grade", reqData).then(
    function (response) {
        const res = response.data;
        if(res.status){
          const data = res.data;
          if(!data.updated && data.reason=="revMismatch"){
            $scope.sc.adjustment = 0;
            $scope.notifyAlertMsg("revMismatch", 'The grading rubrics has changed since the last time you loaded the question. The grades are rejected. Latest rubrics is loaded. Please try again.',{
              delay: 5000,
              type:"danger"
            });
            $scope.activeQues.rubricSetting = data.updatedRubrics;
            $scope.activeQues.rubricSetting['revId'] = data['updatedRevId'];
            $scope.activeQues.rubricSetting.rules.sort((a,b)=>b.value-a.value);
            $(".fetchLoader").hide();
          }else{
            $scope.activeQues.graded = true;
            $scope.lastGradedTime = data.updatedAt;
            $scope.history = data.history;
            //$scope.updateGridScore(); //grid score
            $timeout(() => {
              $(".fetchLoader").hide();
              if(!alreadyGrade){
                $scope.fetchQuestion();
                $scope.selectedQusIndex = data.history.length;
              }
            }, 500);
          }
          
        }else{
          let isError = true;
          if(res.error.code ==="alert_quizFinal"){
            $scope.isFinalize = true;
            $scope.checkQuizFinalize(true);
            isError = false;
            $scope.allGraded = true;
          }
          $scope.errorHandling(res.error.code,isError);
        }
    },function(error){
      //error handler
      console.log("Server Error");
      console.log(error);
      $scope.errorHandling('msg_server_error');
  });


}


$scope.scoreAfterAdjustment = function(){
  const selectScore = +$scope.selectScore;
  const adjustment = +$scope.sc.adjustment;
  const rubricSum = $scope.activeQues.rubricSetting.rules.filter(x=>x['selected']==true && !x['deleted']).map(x=> +x.value).reduce((a,c)=>a=a+c,0);
  const score = rubricSum + adjustment + selectScore;
  return isNaN(score)?selectScore:score.toFixed(2);
}

//used in future for calculate score
$scope.updateGridScore = function(){
  $scope.history = $scope.history.map(x=>{
    const gradingMatrix  = $scope.sections[x.section-1].gradingMatrix;
    const baseScore = gradingMatrix[x.gradingIndex[0]][x.gradingIndex[1]];
    const adjustment = +x.adjustment;
    let score = (baseScore + adjustment).toFixed(2);
    x['score'] = score;
    return x;
  })
}

$scope.openQuizInfo = function(){
  $("#secInstuction").modal()
}

$scope.$on("changeUILanguage", function (e, data) {
  $scope.lang = data.language;
  if (typeof Storage !== "undefined") {
    if (sessionStorage.language) {
      $scope.langName = sessionStorage.language;
    }
  }
});

///end///
}
]);
  