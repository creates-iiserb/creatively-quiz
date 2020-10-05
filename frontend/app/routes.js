app.config(['$urlRouterProvider','$locationProvider', '$stateProvider', function ($urlRouterProvider,$locationProvider, $stateProvider) {
    //base url
    var path = window.location.origin + window.location.pathname + '#';
    $locationProvider.hashPrefix('');
    $urlRouterProvider.otherwise('/');
    const version = 4.3;
    $stateProvider
        .state('root', {  
            resolve: {
                loadDepedency: function ($ocLazyLoad) {
                    return $ocLazyLoad.load([
                       'assets/css/login.min.css?v='+version
                     ]);
                }
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
        .state('start', {
            resolve: {
                authrefresh:AuthAndRefresh,
                check: CheckAttempt
                
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
        

      
        function AuthAndRefresh(dataService,$state,$q,$rootScope,$timeout){
            if(+dataService.getData('LOGGEDIN') !== 1 ){
                $timeout(function() {
                    dataService.clearAll(true);
                    },0);
                return $q.reject();
            }
           
            if (typeof $rootScope.instruction === 'undefined' || $rootScope.instruction == null) {

                    swal({
                    text: 'Reloading the page logs you out',
                    buttonsStyling: false,
                    allowOutsideClick: false,
                    confirmButtonClass: "btn btn-warning btn-fill"
                    }).then(function () {
                    $timeout(function() {
                        dataService.loggoutWithReason('reload');
                    },0);
                   });
                   return $q.reject();
            }            
            return $q.when()
        }             
       
        
        function CheckAttempt($q,dataService,$state,$timeout) {
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
app.run(function ($rootScope, $cookies, $http,$location,dataService) {

var clock = new Date(0);

$rootScope.language = {};
angular.element(document).ready(function () {
    $http.get("services/configEnv.json").then(function (res) {
        $rootScope.configData = res.data;
        dataService.clearAllLS(['subjective']);
        dataService.setData('cookieBaseUrl',$rootScope.configData.baseUrl);
        dataService.setData('cookieSocketUrl',$rootScope.configData.liveUrl);

        $rootScope.getClockTime();
        var language = 'default';
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

$rootScope.getClockTime = function () {
    $http.post($rootScope.configData.baseUrl + "/time").then(function (response) {
        var data = response.data.data;        
        clock.setTime(data.time);
    },function(error){
         console.log(error);
    })
}

$rootScope.getLangData = function (language) {    
    var data = {language:language};    
    $http.post($rootScope.configData.baseUrl + "/global",data).then(function(response) { 
        var data = response.data.data;        
        $rootScope.language = data.language;
        $rootScope.language.copyRight = data.copyright;
        $rootScope.$broadcast('changeUILanguage',{language:data.language,copyRight:data.copyRight});
    },function(error) {
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
