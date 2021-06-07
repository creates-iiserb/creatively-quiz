app.config(['$urlRouterProvider','$locationProvider', '$stateProvider','socialProvider', function ($urlRouterProvider,$locationProvider, $stateProvider,socialProvider) {
    //base url
    let host = window.location.host;
    let gkey = 'insert google api here'; 
    socialProvider.setGoogleKey(gkey);
    //console.log(gkey);
    var path = window.location.origin + window.location.pathname + '#';
    $locationProvider.hashPrefix('');
    $urlRouterProvider.otherwise('/');
    const version = 5.4;
    $stateProvider
        .state('root', {  
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                       'assets/css/login.min.css?v='+version
                     ]);
                }
                // ,
                // check: function(dataService) {
                //     dataService.clearAll(false);
                // }
            },
            url: '/',
            templateUrl: 'app/views/newlogin.html?v='+version,
            controller: 'authCtrl'
        })
        .state('getCredential', {  
            resolve: {
                check: function(dataService) {
                    dataService.clearAll(false);
                }
            },
            url: '/getCredential',
            templateUrl: 'app/views/getCredential.html?v='+version,
            controller: 'authCtrl'
        })
        .state('livequiz', {
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                        'assets/css/liveQuizNew.min.css?v='+version,
                        'assets/js/math.min.js',
                        'assets/custom/calculator.js',
                        'assets/js/Chart.min.js',
                        'assets/js/plotly-latest.min.js'
                    ]);
                },
                authrefresh:AuthAndRefresh
            },
            url: '/livequiz',
            templateUrl: 'app/views/liveQuizNew.html?v='+version,
            controller: 'liveQuizCtrl'
        })
        .state('login', {
            url: '/login?user',
            resolve:{
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                       'assets/css/login.min.css?v='+version
                     ]);
                }
            },
            templateUrl: 'app/views/urllogin.html?v='+version,
            controller: 'authCtrl'
        })        
        .state('quiz-summary', {             
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                        'assets/js/Chart.min.js',
                        'assets/js/plotly-latest.min.js'
                    ]);
                },
                authrefresh:AuthAndRefresh
            }, 
            url: '/quiz-summary',
            templateUrl: 'app/views/summary.html?v='+version,
            controller: 'summaryCtrl'
        })
        .state('quiz-response', {
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                        'assets/css/grading.min.css?v='+version,
                        'assets/js/math.min.js',
                        'assets/custom/calculator.js',
                        'assets/js/Chart.min.js',
                        'assets/js/plotly-latest.min.js'
                    ]);
                },
                authrefresh:AuthAndRefresh,
                check: function ($q,dataService,$state) {  
                    var deferred = $q.defer();
                    if (+dataService.getData('LOGGEDIN') == 1 && dataService.getData('ATTEMPT') != true) {
                        deferred.reject();              
                        $state.go('start');
                        return deferred.promise;
                    }
                    if (+dataService.getData('LOGGEDIN') == 1 && dataService.getData('ATTEMPT') == true && dataService.getData('VIEWRES') != true) {
                        deferred.reject();              
                        $state.go('quiz-summary');
                        return deferred.promise;                        
                    }
                    
                }
                
            },
            url: '/quiz-response',
            templateUrl: 'app/views/quizpage.html?v='+version,
            controller: 'quizCtrl'
        })
        .state('grading', {
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    
                    return $ocLazyLoad.load([
                        'assets/css/grader.min.css?v='+version,
                        'assets/css/fetchLoader.min.css',
                    ]);
                },
                
            },
            url: '/grading',
            templateUrl: 'app/views/grader.html?v='+version,
            controller: 'graderCtrl'
        })
        .state('start', {
            resolve: {
                authrefresh:AuthAndRefresh,
                check: CheckAttempt //quizStarted condition not add here like previous code
                
            },            
            url: '/start',
            templateUrl: 'app/views/startpage.html?v='+version,
            controller: 'startCtrl'
        })
        .state('quiz', {
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                        'assets/js/math.min.js',
                        'assets/custom/calculator.js',
                        'assets/js/Chart.min.js',
                        'assets/js/plotly-latest.min.js'
                    ]);
                },
                authrefresh:AuthAndRefresh,
                check: CheckAttempt
                
            },            
            url: '/quiz',
            templateUrl: 'app/views/quizpage.html?v='+version,
            controller: 'quizCtrl'
        })
        .state('resetToken', {                       
            url: '/resetToken',
            templateUrl: 'app/views/resetToken.html?v='+version,
            controller: 'resetTokenCtrl'
        })
        .state('quizList', {
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                        'assets/css/quizList.min.css?v='+version,
                    ]);
                }
            },
            url: '/quizList',
            templateUrl: 'app/views/quizList.html?v='+version,
            controller: 'quizListCtrl'
        })
        // .state('exit', {           
        //     url: '/exit',
        //     templateUrl: 'app/views/quizSubmitted.html?v='+version,
        //     controller: 'authentication'
        // })

        //////////////authenticate user and page refresh///////
        function AuthAndRefresh(dataService,$state,$q,$rootScope,$timeout){            
            //authorization   
           // console.log('Is user login');                    
            if(+dataService.getData('LOGGEDIN') !== 1 ){
                $timeout(function() {
                    dataService.clearAll(true);
                    },0);
                return $q.reject();
            }
            //page refresh
            //console.log('check page refresh');
           // console.log($rootScope.instruction);
            if (typeof $rootScope.instruction === 'undefined' || $rootScope.instruction == null) {

                    swal({
                    text: 'Reloading the page logs you out',
                    buttonsStyling: false,
                    allowOutsideClick: false,
                    confirmButtonClass: "btn btn-warning btn-fill"
                    }).then(function () {
                    $timeout(function() {
                        if(sessionStorage.getItem('loginToken')){
                            $state.go('quizList');
                        }else{
                            dataService.loggoutWithReason('reload');
                        }
                    },0);
                   });
                   return $q.reject();
            }            
            return $q.when()
        }             
       
        //////////check Quiz is attempted or not //////////
        function CheckAttempt($q,dataService,$state,$timeout) {
           // console.log(dataService.getData('ATTEMPT')); 
            if (+dataService.getData('LOGGEDIN') == 1 && dataService.getData('ATTEMPT') == true) {
                $timeout(function() {
                    $state.go('quiz-summary')
                    },0);
                return $q.reject();
            }else{

                if(dataService.getData('quizType') == 'sectioned' )
                  return $q.when();
                 else {
                    $timeout(function() {
                        $state.go('login')
                    },0);
                    return $q.reject();
                }
            }
        }

        

        
}]);
  
    
var socket;
//Quiz App Global Data Members and Functions
app.run(function ($rootScope, $cookies, $http,$location,dataService) {
//console.log('app.run');
var clock = new Date(0);

$rootScope.language = {};
//--Base URL --use

angular.element(document).ready(function () {
    $http.get("services/configEnv.json").then(function (res) {
        //console.log('app.run --http');
        //console.log(res);
        $rootScope.configData = res.data;
        //console.log('==============');
        dataService.clearAllLS(['subjective']);
        dataService.setData('cookieBaseUrl',$rootScope.configData.baseUrl);
        dataService.setData('cookieSocketUrl',$rootScope.configData.liveUrl);

        $rootScope.getClockTime();
        var language = 'default';
        // if(typeof(Storage) !== "undefined") {
        //     if (sessionStorage.language) {
        //         language = sessionStorage.language;
        //     }
        // }    

        // socket = io.connect($rootScope.configData.liveUrl,{
        //     reconnection:true,
        //     reconnectionAttempts:50,
        //     reconnectionDelay:2000,
        //     transports:['websocket'],
        //     rejectUnauthorized:false,
        //     upgrade:false,
        //     agent:false
        // });

        socket = io.connect($rootScope.configData.liveUrl,{
            reconnectionDelay:5000
        });
        $rootScope.getLangData(language);
       
    });
});



$rootScope.changeLanguage = function (lang='default') {
       if(typeof(Storage) !== "undefined") {
        sessionStorage.language = lang;
       }
       $rootScope.getLangData(lang);
}


//Clock Function
//Getting time from the server --use
$rootScope.getClockTime = function () {
    $http.post($rootScope.configData.baseUrl + "/time").then(function (response) {
        var data = response.data.data;        
        clock.setTime(data.time);
    },function(error){
         console.log(error);
    })
}


//Getting Language from the server --use
$rootScope.getLangData = function (language) {    
    var data = {language:language};    
    $http.post($rootScope.configData.baseUrl + "/global",data).then(function(response) { 
        var data = response.data.data;        
        $rootScope.language = data.language;
        $rootScope.language.copyRight = data.copyright;
        $rootScope.$broadcast('changeUILanguage',{language:data.language,copyRight:data.copyRight});
    },function(error) {
        //to ensure that data is coming from the sever the first time page is loaded
       alert('Unable to connect to server. Check your internet connection. The page will continue refreshing until connection with the server is established');
       location.reload(true);
    });
}


$rootScope.currentLang = function(lang){
    var language = 'default';
    if(typeof(Storage) !== "undefined") {
        if (sessionStorage.language) {
            language = sessionStorage.language;
        }
    }
    if(lang==language)
     return true;
    else
      return false;
}

$rootScope.setClock = function () {
    clock.setSeconds(clock.getSeconds() + 1);
}

$rootScope.setClock();
setInterval($rootScope.setClock, 1000);


$rootScope.getClock = function (name) {
    return clock;
};

$rootScope.startQuiz = function (data) {     
    $rootScope.quizStarted = data;
};

$rootScope.rsgetData = function (name) {
   return dataService.getData(name);    
};

$rootScope.updateTime = function(time){
    clock.setTime(time);
};

$rootScope.consoleData = function (data,title=''){
    if(false){
        if(title!=''){
            console.log(title);
        }
        console.log(JSON.stringify(data,null,2));
    } 
};

});

// app.config(function(socialProvider){
   
//     console.log('app.config');
//     let host = window.location.host.split('.');
//     let gkey = host[host.length-1]=="in"?'998389535624-gvjhidkrda4q2eif4k8hqmhm1dnnhl6p.apps.googleusercontent.com':'998389535624-a7tm5aejfqhsm79rk8ucrp3c0gjgqqpb.apps.googleusercontent.com';
//     socialProvider.setGoogleKey(gkey);
// });