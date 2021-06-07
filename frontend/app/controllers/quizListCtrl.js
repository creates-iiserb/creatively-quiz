//"use strict";
app.controller("quizListCtrl", ["$scope","$http","helperService","$timeout","$interval","$compile","$rootScope","$location","dataService","helperService","requestService","socialLoginService",function ($scope,$http,helper,$timeout,$interval,$compile,$rootScope,$location,dataService,helperService,requestService,socialLoginService ) {

    $scope.isReq = false;
    $scope.lang = $rootScope.language;
    $scope.otpSended = false;
    $scope.userData={
        email:'',
        otp:''
    }
    $scope.currPage = 1;
    $scope.userLoggedIn = false;



    $scope.verifyLoginToken = function(){
      if($scope.isReq){
          return;
      }
      //dataService.clearAll(false,false);
      const loginToken = sessionStorage.getItem('loginToken') //dataService.getData('loginToken');
      let data = {
          loginToken:loginToken
      }
      $scope.isReq = true;
      requestService.request('POST',true,'/user/details',data).then(function(response){
        const res = response.data;
        //console.log(res);
        if(res.status){
            //console.log(res);
            $scope.filterKey = 'Active';
            const data = res.data;
            $scope.userLoggedIn = true;
            $rootScope.loginByEmail = true;
            $scope.userData.email = data.user.userEmail;
            $scope.quizList = data.quiz;
        }else{
            helperService.notifyMsg('ti-alert', 'danger', $scope.lang[res.error.code], 'top', 'center',3000);
            $scope.userLoggedIn = false;
            if(res.error.code == 'authFailed'){
                sessionStorage.removeItem('loginToken')
            }
        }
        
        $scope.isReq = false;
        $timeout(()=>{
            $(".pageLoader").fadeOut("slow");
        },500)

      },function(err){
        console.log(err);
        $scope.isReq = false;
      })
    }

    $scope.logout = function(){
        sessionStorage.removeItem('loginToken');
        //dataService.removeData('loginToken');
        $scope.userData={
            email:'',
            otp:''
        }
        $scope.userLoggedIn = false;
        socialLoginService.logout();
    }

    let invalidEmail = undefined;
    $scope.sendOtp = function(type){
        if($scope.isReq){
            return;
        }
        const email = $scope.userData.email.trim();
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if(!re.test(String(email).toLowerCase())){
            if(!invalidEmail){
                invalidEmail = $.notify({ icon: 'ti-alert',message: 'Invalid Email Id',},
                {type: 'danger',newest_on_top: true,delay: 1000,
                placement: { from: "top",align: "center",},
                onClose: function () { invalidEmail = undefined;},
                });
            }
            return;
        }

        
        let data = {
            "loginType": "emailOTP",
            "email": email,
            "continueLogin":false,
        }
        if(type==='verifyOtp'){
            const otp = $scope.userData.otp.trim();
            if(otp === ''){
                helperService.notifyMsg('ti-alert', 'danger', 'Please enter OTP', 'top', 'center',1000);
                return;
            }

            data = {
                "loginType": "emailOTP",
                "email": email,
                "continueLogin":true,
                "emailOTP":otp
            }
            
        }
        if(type=='google'){
            data = {
                "loginType":"google",
                "email":email, 
                "google":$scope.googleResponse
            }
            
        }
 
        $scope.isReq = true;
        dataService.removeData('reqByAuthor'); //clear 
        requestService.request('POST',true,'/user/login',data).then(function(response){
            $scope.isReq = false;
            const res = response.data;
            if(res.status){
                if(type==='verifyOtp' || type === 'google'){
                    $(".pageLoader").show();
                    $scope.userLoggedIn = true;
                    //dataService.setData('loginToken',res.data.loginToken); 
                    sessionStorage.setItem('loginToken',res.data.loginToken); 
                    $scope.verifyLoginToken();
                }else{
                    $scope.otpSended = true;
                }
               
            }else{
                helperService.notifyMsg('ti-alert', 'danger', $scope.lang[res.error.code], 'top', 'center',3000);
                if(type == 'google'){
                    $scope.userData.email = '';
                }
            }

        },function(err){
            console.log(err);
            $scope.isReq = false;
        })
    }



    $scope.resetLogin = function(){
        $scope.otpSended = false;
        $scope.userData={
            email:'',
            otp:''
        }
    }

    $scope.chkEndTime = function (endTime) {
        //var d = new Date;
        var d = $scope.getClock();
        var endDt = new Date(endTime);
        if (d < endDt) {
            return false;
        } else {
            return true;
        }
    }

     //Login Function 
     $scope.login = function (quiz) {
        $.notifyClose();  
        $scope.isReq = true;
        const userData = {
            quizId:quiz.quizId,
            altPwd: sessionStorage.getItem("loginToken"), //dataService.getData('loginToken'),
            uname:quiz.userName
        }
        dataService.removeData('reqByAuthor'); 
        requestService.request('POST',true,'/login',userData).then(function(response){ 
            var result = response.data;
            $rootScope.consoleData(result,'/login-ac');   
            
            $rootScope.updateTime(result.time);

            if(result.status){  
                var data = result.data;
                // user can log in , show instruction page
                dataService.setData('quizType', data.quizType);
                //check internet connection
                dataService.checkInternet(); 
                //check direct window close event
                if(data.hasOwnProperty('userData')){
                    $rootScope.userDetail =  data.userData;
                }else{
                    $rootScope.userDetail =  {};
                }
                
                dataService.setData('USER', userData.uname);
                dataService.setData('ATTEMPT', data.quizAttempted);
                dataService.setData('LOGGEDIN', 1);   // flag , which indicated user is logged in
                dataService.setData('QUIZID', userData.quizId); 
                
                dataService.setData('ISSECTION', data.isSections);                
                $rootScope.sections = data.sections;
                $rootScope.calcType= data.calc;
                $rootScope.allowFC = data.allowFC;
                $rootScope.allowStats = data.allowStats;

                $rootScope.BTIME = data.beginTime;
                $rootScope.ETIME = data.endTime;
                $rootScope.DURATION = data.duration;
                $rootScope.QUIZTITLE = data.title;

                $rootScope.instruction = data.instruction;
                $rootScope.quizAutor = data.author;
                dataService.setData('VIEWRES', false);
                dataService.setData('TOKEN', data.token);
                var helpArr = [];
                var helpAtReviewArr = [];
                data.sections.forEach(x=>{                
                 helpArr[x.sectionId] = x.helpAllowed;
                 helpAtReviewArr[x.sectionId] = x.helpAtReview;
                });

                         
                
                $rootScope.sectionHelp = helpArr;
                $rootScope.sectionHelpAtReview = helpAtReviewArr;

                $rootScope.bTime = new Date(data.beginTime).toString();
                $rootScope.eTime = new Date(data.endTime).toString();
                if (data.quizAttempted == true) {
                    // user has already attemplted the quiz
                    if ($scope.chkEndTime(data.endTime)) {
                        // checking if review is allowed
                        dataService.setData('VIEWRES', true);
                    }
                    // redired to /quiz-summary page
                    $location.path("/quiz-summary");
                } else {
                    $rootScope.startedOn = data.startedOn;
                    $rootScope.loginTime = data.loginTime;
                    //Reidirect to quiz  start page
                    if(data.quizType=="live"){
                        $location.path("/livequiz");
                        //dataService.setData('CalType', data.calc);
                       // dataService.setData('InstData', data.sections);  
                    }
                    else{
                        $location.path("/start");
                    }
                    
                }

            }else{  
                //requestService.dbErrorHandler(result.error.code,result.error.type);
                helperService.notifyMsg('ti-alert', result.error.type, $rootScope.language[result.error.code], 'top', 'center',5000);
            }
            $scope.isReq = false;
        },function(responseError){
            $scope.isReq = false;
            helperService.notifyMsg('ti-alert', 'danger','Server not responding' , 'top', 'center');
        });

    }

    
    $scope.googleResponse = {};
    $rootScope.$on('event:social-sign-in-success', function(event, userDetails){
        //console.log(userDetails);
        $scope.googleResponse = userDetails;
        $scope.userData.email = userDetails.email;
        $scope.sendOtp('google');
        //$scope.$apply();
    });

    $scope.googleLogout = function(){
        socialLoginService.logout();
    }
   
    //dataService.getData('loginToken')
   if(sessionStorage.getItem('loginToken')){
      $scope.verifyLoginToken();
   }else{
    $timeout(()=>{
        $(".pageLoader").fadeOut("slow");
    },500)
   }

   $scope.setFilter = function(key){
     $scope.filterKey = key;
     $scope.onSearch();
   }

    $scope.filterKey = 'Active';
    $scope.customFilter = function(quiz){
        if($scope.filterKey == 'All'){
          return true;
        }
        const currentTime = new Date().getTime();
        const start = quiz.beginTimeTS;
        const end = quiz.endTimeTS;
       
        if($scope.filterKey == 'Active'){
            if(currentTime>= start && currentTime<=end){
                return true;
            }
        }
        if($scope.filterKey == 'Upcoming'){
            if(start> currentTime && currentTime < end){
                return true;
            }
            
        }
        if($scope.filterKey == 'Finished'){
            if(currentTime > end){
                return true;
            }
        }
        return false
        

    }

    $scope.onSearch = function(){
        if($scope.currPage>1){
			$scope.currPage = 1;
		}
    }

   $rootScope.$on('event:social-sign-out-success', function(event, logoutStatus){
       console.log("logout");
       //console.log(event);
       //console.log(logoutStatus);

   })

    $scope.$on("changeUILanguage", function (e, data) {
    $scope.lang = data.language;
    if (typeof Storage !== "undefined") {
      if (sessionStorage.language) {
        $scope.langName = sessionStorage.language;
      }
    }
    });


  }
]);
  