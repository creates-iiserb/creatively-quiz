//authentication-ctrl.js
app.controller('authCtrl',['$scope', '$rootScope', '$timeout','$location', '$stateParams','$ocLazyLoad','requestService','helperService','dataService','$window' ,function ($scope, $rootScope, $timeout,$location, $stateParams,$ocLazyLoad,requestService,helperService,dataService,$window) {    
   
    $("#logcurrentYear").html(new Date().getFullYear());
    $.notifyClose();
    $scope.lang = $rootScope.language;

   

    //load required js/jquery file 
    $ocLazyLoad.load(
        ['assets/custom/login.js','https://www.google.com/recaptcha/api.js'],
        {cache: false}
    );

    $scope.logReq = false;

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


    $scope.onInputChange = function(event){
        if(event.which === 13) {
            if($scope.loginForm.uname.$valid && $scope.loginForm.pwd.$valid && $scope.loginForm.quizId.$valid){
               $scope.getlogin();
            }
        }
    }

    //Login Function 
    $scope.getlogin = function () {  
        $.notifyClose();  
        $scope.logReq = true;
        
        if ($stateParams.user) {
            var test = atob($stateParams.user);
            $scope.userData = JSON.parse(test);   
            dataService.setData('reqByAuthor',JSON.stringify($scope.userData.reqByAuthor));   
        } else {
            $scope.userData = $scope.user;
            //if author and student login both uses same machine then we have clear out 
            // author cookies
            dataService.removeData('reqByAuthor'); 
            sessionStorage.removeItem('loginToken')
        }

        
        // quiz id  must always be in uppercase
        $scope.userData.quizId = $scope.userData.quizId.toUpperCase();
        //call request(method,withCredential,apiURL,data)
        requestService.request('POST',true,'/login',$scope.userData).then(function(response){ 
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
                
                
                
                dataService.setData('USER', $scope.userData.uname);
                dataService.setData('ATTEMPT', data.quizAttempted);
                dataService.setData('LOGGEDIN', 1);   // flag , which indicated user is logged in
                dataService.setData('QUIZID', $scope.userData.quizId.toUpperCase()); 
                
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

                //set quiz language
                //$scope.changeLanguage('hindi');

                //Check quiz attempted or not. If ture then redirct to summary else quiz
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
                $scope.logReq = false;
                
            }

          
        },function(responseError){
            $scope.logReq = false;
            helperService.notifyMsg('ti-alert', 'danger','Server not responding' , 'top', 'center');
        });

    }


    $scope.$on("changeUILanguage",function(e,data){       
        $scope.lang = data.language;
    });

    $scope.$on('$includeContentLoaded', function(){
        $timeout(()=>{
            if($(".pageLoader").length>0){
                $(".pageLoader").fadeOut("slow");
            }
        },2000)
    });


    

    // retreive credential
    $scope.isSubGCFrm = false;
    $scope.sendCredetial = function(){
        let captcha = document.getElementsByName("g-recaptcha-response")[0].value;
        let data = {
            quizId : $scope.quizId.toUpperCase(),
            user : $scope.username.toLowerCase(),
            captcha : captcha
        }
       
        if(captcha === '' || captcha === undefined){
            helperService.notifyMsg('ti-alert','danger' ,$scope.lang['alert_captchaFalse'], 'top', 'center',2000);
            return;
        }
        
        $scope.isSubGCFrm = true;
        requestService.request('POST',true,'/sendCredentials',data).then(function(response){
            let data = response.data;
            if(data.status){
                 let messsage = '';
                 if(data.data.hasOwnProperty('email')){
                    messsage = $scope.lang[data.data.code]+' '+ data.data.email;
                 }else{
                    messsage = $scope.lang[data.data.code];
                 }
                 helperService.notifyMsg('ti-alert','success', messsage, 'top', 'center');
            }else{
                helperService.notifyMsg('ti-alert','danger' ,$scope.lang[data.error.code], 'top', 'center');
            }
           
            $scope.isSubGCFrm = false;
            $scope.quizId = '';
            $scope.username = '';
            grecaptcha.reset();
           
        },function(error){
            console.log(error);
            $scope.isSubGCFrm = false;
            $scope.quizId = '';
            $scope.username = '';
            helperService.notifyMsg('ti-alert','danger' ,$scope.lang['caption_serverErr'],'top', 'center');
            grecaptcha.reset();
        });
    }
    //end of retrieve credentials

    
    $scope.gotoLoginPage = function(){
        $window.location.href = window.location.origin + window.location.pathname;
    }



    //check browser is mozila firfox
    var e, i = navigator.appName,
        r = navigator.userAgent,
        o = r.match(/(opera|chrome|safari|firefox|msie|trident)\/?\s*(\.?\d+(\.\d+)*)/i);
    o && null != (e = r.match(/version\/([\.\d]+)/i)) && (o[2] = e[1]);
    var a = (o = o ? [o[1], o[2]] : [i, navigator.appVersion, "-?"])[1].split(".");

    if ("Firefox" == o[0] && a[0] > 1) {
        if (sessionStorage.getItem('checkBrowser') === null) {
            if($("#fireFoxMdl").length>0){
                $("#fireFoxMdl").modal({ backdrop: "static" });
                sessionStorage.setItem("checkBrowser", true);
            }
            
        }
        setTimeout(() => {
            if($("#firefoxHelpLink").length>0){
                $("#firefoxHelpLink").show();
            }
            
        }, 300);

    }
    
    //end of browser is mozila firefox

   
}]);

