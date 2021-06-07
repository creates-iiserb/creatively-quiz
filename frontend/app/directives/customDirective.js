/*Important: Don't change this directive it is used in many places
 It is indirectly used by compile directive(fill in directive)*/
 //EA means directive can be element or attribute
 app.directive('math', function () {
    return {
        restrict: 'EA',
        scope: {
            math: '@'
        },
        link: function (scope, elem, attrs) {
            scope.$watch('math', function (value) {
                if (!value) return;
                
                //add loadMathData class to hide data
                elem.addClass('loadMathData');
                elem.html(value);               
                setTimeout(function () {
                        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                        MathJax.Hub.Register.StartupHook("End",function () { 
                            setTimeout(()=>{
                                //remove loadMathData class after proper load
                                elem.removeClass('loadMathData');
                            },300)
                        });
                 }, 0);
            });
        }
    };
});


/*Only used in subjective*/
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

/* used in grid modal */ 
app.directive('mathlimit', function () {
    return {
        restrict: 'EA',
        scope: {
            mathlimit: '@'
        },
        link: function (scope, elem, attrs) {
            scope.$watch('mathlimit', function (value) {
                if (!value) return;
                //start trim
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
                // end of trim
               
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

/*Important: Don't change this directive, used in fill in the blank questions.
It is internally called above math directive */
app.directive('compile', function ($compile) {
    // directive factory creates a link function
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
                //add loadMathData class to hide data
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
                                //remove loadMathData class after proper load
                                element.removeClass('loadMathData');
                            },300)
                        });
                }, 0);
                // it bind the ng-model,ng-keypress with current scope.
                $compile(element.contents())(scope);
            }
        );
    };
});