 app.directive('math', function () {
    return {
        restrict: 'EA',
        scope: {
            math: '@'
        },
        link: function (scope, elem, attrs) {
            scope.$watch('math', function (value) {
                if (!value) return;
                
                
                elem.addClass('loadMathData');
                elem.html(value);               
                setTimeout(function () {
                        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                        MathJax.Hub.Register.StartupHook("End",function () { 
                            setTimeout(()=>{
                               
                                elem.removeClass('loadMathData');
                            },300)
                        });
                 }, 0);
            });
        }
    };
});


app.directive('subjectmath', function () {
    return {
        restrict: 'EA',
        scope: {
            subjectmath: '@'
        },
        link: function (scope, elem, attrs) {
            scope.$watch('subjectmath', function (value) {
                elem.html('');  
                if (!value) return;

                elem.addClass('loadMathData');
                elem.html(value);               
                setTimeout(function () {
                        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                        MathJax.Hub.Register.StartupHook("End",function () { 
                            setTimeout(()=>{
                                elem.removeClass('loadMathData');
                            },300)
                        });
                 }, 0);
            });
        }
    };
});


app.directive('mathlimit', function () {
    return {
        restrict: 'EA',
        scope: {
            mathlimit: '@'
        },
        link: function (scope, elem, attrs) {
            scope.$watch('mathlimit', function (value) {
                if (!value) return;
               
                var len = value.length;
                var data = value;
                if(len>100){
                  var mstart = value.search("<math>");
                  if(mstart>-1 && mstart<100){
                    var mend = value.search("</math>");
                    data = value.substr(0,mend+7);
                  }else{
                    data = value.substr(0,100);
                   
                  }
                }
               
               
                elem.html(data);               
                setTimeout(function () {
                        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                 }, 0);
            });
        }
    };
});



app.directive('dynamic', function ($compile) {
    return {
        restrict: 'A',
        replace: true,
        link: function (scope, ele, attrs) {
            scope.$watch(attrs.dynamic, function (html) {
                ele.html(html);               
                $compile(ele.contents())(scope);
            });
        }
    };
});


app.directive('compile', function ($compile) {

    return function (scope, element, attrs) {
        scope.$watch(
            function (scope) {
                if(attrs.compile.substr(0,1)=="'"){
                    return scope.$eval(attrs.compile);
                }else{
                     return attrs.compile;
                }
                
            },
            function (value) {
               
                element.addClass('loadMathData');
                if(attrs.compile.substr(0,1)=="'"){
                   element.html(attrs.compile.substr(1).slice(0, -1));
                }else{
                    element.html(attrs.compile);
                }

                setTimeout(function () {                    
                        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                        MathJax.Hub.Register.StartupHook("End",function () { 
                            setTimeout(()=>{
                              
                                element.removeClass('loadMathData');
                            },300)
                        });
                }, 0);
               
                $compile(element.contents())(scope);
            }
        );
    };
});