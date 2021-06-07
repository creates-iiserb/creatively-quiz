//authentication-ctrl.js
app.controller('resetTokenCtrl',['$scope', '$rootScope', '$location','requestService','helperService',function ($scope, $rootScope, $location,requestService,helperService){   
    $scope.pageLoad = false; 
    $scope.btnReq = false;
    $scope.isValidReq = 1;

    $scope.initReq = function(){
        var data = $location.search();
        //console.log(data);
        if (data.quizId && data.uname && data.token){
            $scope.reqData = {
                quizId : data.quizId,
                uname : data.uname,
                token : data.token
            }

            console.log($scope.reqData);
            setTimeout(function(){
                    $(".pageLoader").fadeOut("slow");
                    $scope.isValidReq = 1;    
                    $scope.pageLoad = true;
                    $scope.$digest();
            },1000);
        }else{
            $scope.isValidReq = 2;
            setTimeout(function(){
                $(".pageLoader").fadeOut("slow");
                $scope.pageLoad = true;
                $scope.$digest();
            },1000);
        }

       

    } 


    $scope.unblock = function () {
        $scope.btnReq = true;
        requestService.request('POST',true,'/unlockAccount',$scope.reqData).then(function(response){ 
        var result = response.data;
            //console.log('Load quizresponsedata---------')
            //console.log(JSON.stringify(result,null,2));
            let type="";
            let msg = "";
            if(result.status){
               $scope.isValidReq = 3;
               //type="success";
               //msg = result.data.msg;
            }else{
                let errorcode = result.error.code;
                type =  result.error.type;
                if(errorcode =="msg_tokenAlreadyReset"){
                    $scope.isValidReq = 3;
                }else 
                if(errorcode == "msg_unauthReq"){
                    $scope.isValidReq = 2;
                }

                msg = $rootScope.language[errorcode];
                helperService.notifyMsg('ti-alert', type,msg , 'top', 'center');
            }

        },function(responseError){
            $scope.btnReq = false;
           console.log(responseError);
           helperService.notifyMsg('ti-alert', 'danger','Server not responding' , 'top', 'center');
        });
    }
   
}]);


