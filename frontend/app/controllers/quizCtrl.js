//"use strict";
app.controller("quizCtrl", ["$scope","helperService","$timeout","$interval","$compile","$rootScope","$location","dataService","helperService","requestService","$window","$state","$sce","$filter",
  function ($scope,helper,$timeout,$interval,$compile,$rootScope,$location,dataService,helperService,requestService,$window,$state,$sce,$filter
  ) {
    const version = 5.4;
    const maxChars = 500;
    $scope.lang = $rootScope.language;
    $scope.graderNoteCollapse = false;
    $scope.resquestSend = false; //lock for simultaneous request in plain quiz
    let submitType = "manual";
    $scope.maxShapeAllowed = 30;
    $scope.langName = "default";
    if (typeof Storage !== "undefined") {
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
    $scope.hh = "00";
    $scope.mm = "00";
    $scope.ss = "00";
    let subDrawing = undefined;
    const subjectExpire = 1000 * 60 * 60 * 24;
    // it is use for stop using browser back button
    $scope.$on("$stateChangeStart", function (e,toState,toParams,fromState,fromParams
    ) {
      if ($rootScope.quizStarted != "quiz") {
        if (fromState.name == "quiz" && toState.name == "start") {
          e.preventDefault();
          history.pushState(
            null,
            null,
            window.location.origin + window.location.pathname + "#quiz"
          );
          if ($("html").hasClass("nav-open")) {
            $(".navbar-toggle").click();
          }
          if (dataService.getData("ISSECTION")) {
            swal({
              text: $scope.lang["msg_sec_backBtn_disabled"],
              buttonsStyling: false,
              confirmButtonClass: "btn btn-warning btn-fill",
            });
          } else {
            swal({
              text: $scope.lang["msg_plain_backBtn_disabled"],
              buttonsStyling: false,
              confirmButtonClass: "btn btn-warning btn-fill",
            });
          }
        }
      }
    });

    $scope.reqBy = "std";
    if (dataService.getData("reqByAuthor")) {
      $scope.reqBy = "auth";
    }

    $scope.questions = [""]; // stores question data
    $scope.data = "";
    $scope.mode = "";
    $scope.isLoad = false;
    //get meta instruction
    //$rootScope.activeQuiz is set at summary page or instruction page
    var secIndex = $scope.sections.findIndex(
      (x) => x.sectionId == $rootScope.activeQuiz
    );
    $scope.sectionNumber = secIndex + 1;
    $scope.sectData = $scope.sections[secIndex];
    // $scope.fcard ={0:[0,1],}
    $scope.flashCards = [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
      [8, 9],
    ];
    $scope.currentPage = 1; // set default current page to be 1. means first question to be loaded.
    //check that if the quiz is marked for review.
    $scope.isReviewQuestions = [];
    for (var i = 0; i < $scope.totalItems; i++) {
      $scope.isReviewQuestions.push(0); // default value 0
    }
    $scope.answergive = [];
    //================================Quiz Program Start Here====================================
    $scope.defaultConfig = {
      allowBack: true,
      allowReview: false,
      autoMove: false, // if true, it will move to next question automatically when answered.
      duration: 0, // indicates the time in which quiz needs to be completed. post that, quiz will be automatically submitted. 0 means unlimited.
      pageSize: 1,
      requiredAll: false, // indicates if you must answer all the questions before submitting.
      richText: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      showClock: true,
      showPager: true,
      theme: "none",
    };

    $("#calc").draggable({
      containment: "parent",
    });

    $scope.calculatorType = function () {
      if ($rootScope.calcType != "none") return true;
      else return false;
    };

    //TIMER FUNCTIONS
    //function to parse time into hour.
    var parseTime = function (diff) {
      var msec = diff;
      var hh = Math.floor(msec / 1000 / 60 / 60);
      msec -= hh * 1000 * 60 * 60;
      var mm = Math.floor(msec / 1000 / 60);
      msec -= mm * 1000 * 60;
      var ss = Math.floor(msec / 1000);
      msec -= ss * 1000;

      $scope.hh = hh < 10 ? "0" + hh : hh;
      $scope.mm = mm < 10 ? "0" + mm : mm;
      $scope.ss = ss < 10 ? "0" + ss : ss;
    };

    $scope.timerType = "timeSpent";
    $scope.timeUsed = 0;
    $scope.timerToggle = function () {
      // stop toggle time when duration is not applicable
      if (+$rootScope.DURATION == 525600) {
        return;
      }

      if ($scope.timerType == "timeSpent") $scope.timerType = "timeLeft";
      else $scope.timerType = "timeSpent";
    };

    $scope.timeSpent = function () {
      $scope.timerType = "timeSpent";
    };

    $scope.autoSaveUsingSec = 0;
    //Autosave counter - when it will be equal to 60 then response will be save automatically.
    // timer function
    var tick = function () {
      $scope.quizClock = new Date($scope.getClock()); //current time
      if ($scope.timerType == "timeSpent") {
        //for showing time consumed.
        var showTime = $scope.quizClock - $scope.session_begin_time; //current time - time at which
        parseTime(showTime);
      } else {
        // if timer is set to show 'time left'.
        //End time of validity of quiz
        var showTime = new Date($scope.session_end_time - $scope.quizClock);
        parseTime(showTime);
      }
      //Auto save after 60 sec.
      $scope.autoSaveUsingSec++;
      if ($scope.autoSaveUsingSec > 60) {
        $scope.autoSaveUsingSec = 0;
        $scope.autoSaveWithSec();
      }
    };

    //Time Alert
    var timeAlert = function () {
      //End time of validity of quiz
      var quizClock = new Date($scope.getClock());
      var msec = new Date($scope.session_end_time - quizClock);
      var hh = Math.floor(msec / 1000 / 60 / 60);
      msec -= hh * 1000 * 60 * 60;
      var mm = Math.floor(msec / 1000 / 60);
      msec -= mm * 1000 * 60;
      var ss = Math.floor(msec / 1000);
      msec -= ss * 1000;

      var hh1 = hh < 10 ? "0" + hh : hh;
      var mm1 = mm < 10 ? "0" + mm : mm;
      var ss1 = ss < 10 ? "0" + ss : ss;

      var timeCnt = hh1 + ":" + mm1 + ":" + ss1;
      if (+dataService.getData("LOGGEDIN") == 1) {
        if (hh == 0 && mm == 16 && ss < 2) {
          helperService.notifyMsg(
            "ti-alert",
            "warning",
            $scope.lang.alert_timeAlert,
            "top",
            "center"
          );
        }
        if (hh == 0 && mm < 16) {
          $("#timealert").delay(5000).slideUp(300);
          $("#showtime").hide();
          $("#timealertblock").show();
          $("#timealertblock").html(timeCnt);
        }
        if (hh < 0 && dataService.getData("ATTEMPT") == false) {
          $scope.onFinish($scope.currentPage);
          submitType = "autoTimeup";
          $scope.saveResponse("submit", "beforeSubmit");
        }
      }
    }; //--End Time Alert

    var timerTimeoutArray = [];
    var timerIntervalArray = [];
    var clearIntervalTimeAlert;
    var clearTime;
    var clearIntervalTick;
    $scope.startQuizTimer = function () {
      if (
        +dataService.getData("LOGGEDIN") == 1 &&
        dataService.getData("ATTEMPT") == false
      ) {
        clearTime = $timeout(function () {
          tick();
          timeAlert();
        }, 1000);
        clearIntervalTick = $interval(tick, 1000);
        clearIntervalTimeAlert = $interval(timeAlert, 1000);
        timerTimeoutArray.push(clearTime);
        timerIntervalArray.push(clearIntervalTick);
        timerIntervalArray.push(clearIntervalTimeAlert);
      }
    };

    //Clear all intervals
    $scope.clearTimer = function () {
      timerTimeoutArray.forEach(function (timeout, i) {
        $timeout.cancel(timeout);
      });
      timerIntervalArray.forEach(function (timeout, i) {
        $interval.cancel(timeout);
      });
    };

    $scope.validateTime = function () {
      var d = new Date($scope.getClock());
      var beginDt = new Date($rootScope.BTIME);
      if (d > beginDt) {
        return true;
      } else {
        return false;
      }
    };

    $scope.chkEndDate = function () {
      var d = new Date($scope.getClock());
      var endDt = new Date($rootScope.ETIME);
      if (d < endDt) {
        return false;
      } else {
        return true;
      }
    };

    // on select mcq.
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
    };

    $scope.onSelectExample = function (question, option, id) {
      $scope.lockToggle(id);
      question.object.rate.forEach(function (element, index, array) {
        if (element.Id != option.Id) {
          element.Selected = false;
          question.Answered = option.isanswer;
        }
      });
      if (
        $scope.config.autoMove == true &&
        $scope.currentPage < $scope.totalItems
      ) {
        $scope.currentPage++;
      }
    };

    $scope.pageCount = function () {
      return Math.ceil($scope.questions.length / $scope.itemsPerPage);
    };
    //========================================= lOAD QUIZ =============================================
    // load  response typeof fill in type question
    $scope.loadResponseFillIn = function () {
      if ($scope.questions[$scope.currentPage - 1].type === "fillIn") {
        var inputCount = document
          .getElementById("divFillInBlank")
          .getElementsByTagName("input").length;
        for (var i = 0; i < inputCount; i++) {
          // find the name and value of the input tag.
          var name = document
            .getElementById("divFillInBlank")
            .getElementsByTagName("input")
            [i].getAttribute("name");
          $scope.questions[$scope.currentPage - 1].object[name] =
            $scope.tempAns[$scope.currentPage - 1][name];
        }
        $scope.chkQusLock();
      }
    };

    // load response of subjective
    $scope.countCharacter = function (strData) {
      if (strData) {
        let str = strData.toString();
        str = str.replace(/[&]nbsp[;]/gim, " ");
        let finalStr = str.replace(/(<([^>]+)>)/gim, "");
        return finalStr.length;
      } else {
        return 0;
      }
    };

    let ckTypeInterval = null;
    let notifyAlert = {};
    $scope.clearNotifyAlert = function (type = 0) {
      if (type == 0) {
        $.notifyClose();
        notifyAlert = {};
      } else {
        if (notifyAlert[type]) {
          notifyAlert[type].close();
          notifyAlert[type] = undefined;
        }
      }
    };

    $scope.scrollBody = function (id) {
      var position = $("#" + id).offset().top;
      $("body, html").animate(
        {
          scrollTop: position - 80,
        },
        500
      );
    };

    $scope.loadSubjective = function (mode) {
      if ($scope.questions[$scope.currentPage - 1].type === "sub") {
        if (mode === "review") {
          if (ckTypeInterval) {
            $timeout.cancel(ckTypeInterval);
            ckTypeInterval = null;
          }
          ckTypeInterval = $timeout(() => {
            $(".answerPreviewOverlay").css({ visibility: "visible" });
          }, 500);
        } else if (mode === "quiz") {
          $scope.queslsSubKey = `${dataService.getData(
            "QUIZID"
          )}${dataService.getData("USER")}${$scope.sectionNumber}${
            $scope.questions[$scope.currentPage - 1].ref
          }`.toLowerCase();
          $(".answerPreviewOverlay").css({ visibility: "visible" });
          $scope.reloadCkEditor();
        }
      }
    };

    $scope.reloadCkEditor = function () {
      //configure ckeditor only when limit > 0
      $(".divOverLay").show();
      if ($scope.filteredQuestions[0].object.limit > 0) {
        if (CKEDITOR.instances.editor) {
          CKEDITOR.instances.editor.destroy();
        }
        CKEDITOR.replace("editor");
        $("#ckDiv")
          .unbind("mouseover")
          .on("mouseover", function () {
            //check grammarly is installed
            let ge = document.getElementsByTagName("grammarly-extension")
              .length;
            if (ge > 0) {
              alert("Please disable grammarly extension of your browser.");
              return;
            }
          });

        $scope.subNumCharacters = 0;

        //when ck is ready
        CKEDITOR.on("instanceReady", function (evt) {
          $scope.$apply(function () {
            evt.stop();
            //We can CKEDITOR.instances['editor'].setData(''); here to remove extra code
            //but it call twice editor change event
            if (
              $scope.filteredQuestions[0].object.limit > 0 &&
              !$scope.lock[$scope.currentPage - 1]
            ) {
              if ($scope.tempAns[$scope.currentPage - 1] !== -1) {
                if ("text" in $scope.tempAns[$scope.currentPage - 1]) {
                  CKEDITOR.instances["editor"].setData(
                    $scope.tempAns[$scope.currentPage - 1]["text"]
                  );
                  $scope.subNumCharacters = $scope.countCharacter(
                    $scope.tempAns[$scope.currentPage - 1]["text"]
                  );
                } else {
                  CKEDITOR.instances["editor"].setData("");
                }
              } else {
                CKEDITOR.instances["editor"].setData("");
              }
              $(".divOverLay").hide();
            }
          });
        });

        CKEDITOR.instances["editor"].on("change", function () {
          $scope.$apply(function () {
            if (
              $scope.filteredQuestions[0].object.limit > 0 &&
              !$scope.lock[$scope.currentPage - 1]
            ) {
              let str = CKEDITOR.instances.editor.getData();
              if ($scope.tempAns[$scope.currentPage - 1] == -1) {
                $scope.tempAns[$scope.currentPage - 1] = {
                  text: str,
                };
              } else {
                $scope.tempAns[$scope.currentPage - 1] = {
                  ...$scope.tempAns[$scope.currentPage - 1],
                };
                $scope.tempAns[$scope.currentPage - 1]["text"] = str;
              }

              dataService.setLS(
                "subjective",
                $scope.queslsSubKey,
                $scope.tempAns[$scope.currentPage - 1],
                subjectExpire
              );
              $(".answerPreviewOverlay").css({ visibility: "hidden" });
              if (ckTypeInterval) {
                $timeout.cancel(ckTypeInterval);
                ckTypeInterval = null;
              }
              ckTypeInterval = $timeout(() => {
                $(".answerPreviewOverlay").css({ visibility: "visible" });
              }, 500);
              $scope.subNumCharacters = $scope.countCharacter(
                $scope.tempAns[$scope.currentPage - 1]["text"]
              );
              if (
                $scope.subNumCharacters >
                $scope.filteredQuestions[0].object.limit
              ) {
                $scope.notifyAlertMsg("ck", $scope.lang.alert_subjectivelimit);
              } else {
                $scope.clearNotifyAlert("ck");
              }
            }
          });
        });
      }
    };

    $scope.showSubDB = function (operation, index = -1) {
      $scope.subDBStatus = operation;
      $scope.subNumDrawShapes = 0;
      $timeout(() => {
        subDrawing = LC.init(document.getElementById("subjevtiveDB"), {
          imageURLPrefix: "assets/literallycanvas/img",
          keyboardShortcuts: false,
          tools: [
            LC.tools.Pencil,
            LC.tools.Line,
            LC.tools.Ellipse,
            LC.tools.Rectangle,
            LC.tools.Text,
            LC.tools.Polygon,
            LC.tools.Pan,
            LC.tools.Eyedropper,
            LC.tools.SelectShape,
          ],
        });

        $scope.subDBIndex = index; //new = -1 edit = index
        if (operation == "edit") {
          let snapshot =
            $scope.tempAns[$scope.currentPage - 1]["drawing"][index];
          subDrawing.loadSnapshot(snapshot);
          if ("shapes" in snapshot) {
            $scope.subNumDrawShapes = snapshot["shapes"].length;
          }
        }

        subDrawing.on("drawingChange", () => {
          let snapshot = subDrawing.getSnapshot(["shapes", "colors"]);
          $scope.mointerMaxDrawShape(snapshot);
        });

        subDrawing.on("toolChange", () => {
          $scope.delShape = false;
          $scope.$digest();
        });

        subDrawing.on("lc-pointerup", () => {
          if (
            subDrawing["selectedShape"] &&
            Object.keys(subDrawing["selectedShape"]).length != 0
          ) {
            $scope.delShape = true;
            $scope.$digest();
          }
        });

        $scope.scrollBody("subjevtiveDB");
      }, 100);
    };

    $scope.delSelectedShape = function () {
      subDrawing["shapes"].splice(subDrawing["selectedShape"].shapeIndex, 1);
      subDrawing._shapesInProgress = [];
      subDrawing.trigger("drawingChange", {});
      subDrawing.repaintLayer("main");
    };

    $scope.delSubDB = function (index) {
      $scope.tempAns[$scope.currentPage - 1]["drawing"].splice(index, 1);
      dataService.setLS(
        "subjective",
        $scope.queslsSubKey,
        $scope.tempAns[$scope.currentPage - 1],
        subjectExpire
      );
      if ($scope.subDBIndex == index) {
        $scope.subDBStatus = "none";
        $scope.clearNotifyAlert("maxSubShape");
      }
    };

    $scope.updateSubDrawing = function () {
      let snapshot = subDrawing.getSnapshot(["shapes", "colors"]);
      if ($scope.subDBStatus == "add") {
        if ($scope.tempAns[$scope.currentPage - 1] != -1) {
          if (!("drawing" in $scope.tempAns[$scope.currentPage - 1])) {
            $scope.tempAns[$scope.currentPage - 1] = {
              ...$scope.tempAns[$scope.currentPage - 1],
            };
            $scope.tempAns[$scope.currentPage - 1]["drawing"] = [];
          }
        } else {
          $scope.tempAns[$scope.currentPage - 1] = {
            drawing: [],
          };
        }

        if ($scope.mointerMaxDrawShape(snapshot)) {
          $scope.tempAns[$scope.currentPage - 1]["drawing"].push(snapshot);
          $scope.subDBStatus = "none";
          dataService.setLS(
            "subjective",
            $scope.queslsSubKey,
            $scope.tempAns[$scope.currentPage - 1],
            subjectExpire
          );
        }
      } else if ($scope.subDBStatus == "edit") {
        if ($scope.mointerMaxDrawShape(snapshot)) {
          $scope.tempAns[$scope.currentPage - 1]["drawing"][
            $scope.subDBIndex
          ] = snapshot;
          $scope.subDBStatus = "none";
          dataService.setLS(
            "subjective",
            $scope.queslsSubKey,
            $scope.tempAns[$scope.currentPage - 1],
            subjectExpire
          );
        }
      }
    };

    $scope.cancelSubDrawing = function () {
      $scope.subDBStatus = "none";
      $scope.subDBIndex = -1;
      $scope.clearNotifyAlert("maxSubShape");
    };

    $scope.mointerMaxDrawShape = function (snapshot) {
      if ("shapes" in snapshot) {
        let msg = $scope.lang.msg_maxDrawAllowed.replace(
          "###",
          $scope.maxShapeAllowed
        );
        $scope.subNumDrawShapes = snapshot["shapes"].length;
        if ($scope.subNumDrawShapes > $scope.maxShapeAllowed) {
          $scope.notifyAlertMsg("maxSubShape", msg);
          return false;
        } else {
          $scope.clearNotifyAlert("maxSubShape");
          return true;
        }
      }
    };

    $scope.showAddSubDrawBtn = function () {
      let numofDrawing = 0;
      if ($scope.filteredQuestions[0].object.allowedDrawings > 0) {
        if ($scope.tempAns[$scope.currentPage - 1] != -1) {
          if ("drawing" in $scope.tempAns[$scope.currentPage - 1]) {
            numofDrawing =
              $scope.tempAns[$scope.currentPage - 1]["drawing"].length;
          }
        }
      }

      if (
        !$scope.rsgetData("ATTEMPT") &&
        !$scope.lock[$scope.currentPage - 1] &&
        $scope.filteredQuestions[0].object.allowedDrawings > 0 &&
        numofDrawing < $scope.filteredQuestions[0].object.allowedDrawings
      ) {
        return true;
      } else {
        return false;
      }
    };

    $scope.getSubSvgImg = function (draw) {
      return $sce.trustAsHtml(LC.renderSnapshotToSVG(draw));
    };

    $scope.openMathDoc = function () {
      $("#mathDocMdl").modal("show");
    };

    //Check Question Lock Status
    $scope.chkQusLock = function () {
      if ($scope.questions[$scope.currentPage - 1].type === "fillIn") {
        if ($scope.lock[$scope.currentPage - 1]) {
          $(".fillInOption").addClass("disable-block");
        } else {
          $(".fillInOption").removeClass("disable-block");
        }
      }
    };

    //Fillin keypress store value in tempAns
    $scope.fillValue = function (name) {
      if ($scope.lock[$scope.currentPage - 1]) {
        return;
      } else {
        if ($scope.tempAns[$scope.currentPage - 1] != -1) {
          var temp = $scope.tempAns[$scope.currentPage - 1];
        } else {
          var temp = {};
        }
        var type = $("input[name='" + name + "']").attr("type");
        var value = $("input[name='" + name + "']").val();
        if (type == "number") {
          if (value == "") {
            let option = {
              delay: 2000,
            };
            $scope.notifyAlertMsg(
              "numOnly",
              $scope.lang.msg_numericValueRequire,
              option
            );
          } else {
            temp[name] = parseFloat(value);
          }
        } else if (type == "text") {
          temp[name] = value;
        }
        var newtemp = JSON.stringify(temp);
        $scope.tempAns[$scope.currentPage - 1] = JSON.parse(newtemp);
      }
    };

    //load response for typeof example question-10-aug-2016
    $scope.loadResponseExample = function () {
      for (var i = 0; i < $scope.totalItems; i++) {
        if ($scope.questions[i].type === "example") {
          for (var j = 0; j < $scope.questions[i].object.rate.length; j++) {
            $scope.questions[i].object.rate[j].Selected = false;
          }
          if ($scope.quizResponse[i].tempAns != -1) {
            $scope.questions[i].object.rate[
              $scope.quizResponse[i].tempAns - 1
            ].Selected = true;
          }
        }
      }
    };

    // load  response typeof mcq type question
    $scope.loadResponseMcq = function () {
      for (var i = 0; i < $scope.totalItems; i++) {
        if ($scope.questions[i].type === "mcq") {
          for (var j = 0; j < $scope.questions[i].object.options.length; j++) {
            $scope.questions[i].object.options[j].Selected = false;
          }

          if ($scope.quizResponse[i].tempAns != -1) {
            $scope.questions[i].object.options[
              $scope.quizResponse[i].tempAns - 1
            ].Selected = true;
          }
        }
      }
    };

    // load  response typeof Arrange type question
    $scope.loadResponseArrange = function () {
      for (var i = 0; i < $scope.totalItems; i++) {
        if ($scope.questions[i].type === "arrange") {
          if ($scope.quizResponse[i].tempAns != -1) {
            var tmp = [];
            tmp = angular.copy($scope.quizResponse[i].tempAns);
            for (var j = 0; j < tmp.length; j++) {
              tmp[j] = Math.abs(tmp[j]);
            }
            $scope.arrangeType[i] = tmp;
          } else {
            var temp = [];
            for (var j = 0; j < $scope.questions[i].object.items.length; j++) {
              temp[j] = j + 1;
            }
            $scope.arrangeType[i] = temp;
          }
        }
      }
    };

    $scope.setEndTime = function () {
      var endMarker = new Date($rootScope.ETIME);
      var duration = +$rootScope.DURATION;
      var timeDiff =
        (endMarker.getTime() - $scope.session_begin_time.getTime()) / 60000;
      if (duration < timeDiff) {
        $scope.session_end_time = new Date(
          $scope.session_begin_time.getTime() + duration * 60000
        );
      } else {
        $scope.session_end_time = new Date($rootScope.ETIME);
      }
      var ct = new Date($scope.getClock());
      if (ct >= $scope.session_end_time) {
        $scope.clearTimer();
        $(".overlay-div").css("visibility", "visible");
      }
    };

    let loadQuizNewTim = null;
    let loadInitTim = null;
    let videoTim = null;
    let chartTim = null;
    let pdfTim = null;

    //key = ck,maxSubShape,numOnly
    $scope.notifyAlertMsg = function (key, msg, option = {}) {
      if (!notifyAlert[key]) {
        let placement = {
          from: "top",
          align: "right",
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

    $scope.clearVCPTim = function () {
      if (videoTim) {
        $timeout.cancel(videoTim);
        videoTim = null;
      }
      if (chartTim) {
        $timeout.cancel(chartTim);
        chartTim = null;
      }
      if (pdfTim) {
        $timeout.cancel(pdfTim);
        pdfTim = null;
      }
    };

    $scope.clearJQFill = function () {
      $scope.numFillIns = 0; //num of fill in for partial grading
      if (loadQuizNewTim) {
        $timeout.cancel(loadQuizNewTim);
        loadQuizNewTim = null;
      }
      if (loadInitTim) {
        $timeout.cancel(loadInitTim);
        loadInitTim = null;
      }
      $scope.subNumCharacters = 0;
      $scope.subNumDrawShapes = 0;
      $scope.subDBStatus = "none";
      $scope.delShape = false;
      $scope.clearNotifyAlert();
    };

    $scope.clearCkEditor = function () {
      try {
        if (
          $scope.filteredQuestions[0].type == "sub" &&
          $scope.filteredQuestions[0].object.limit > 0
        ) {
          if ($(".divOverLay").length > 0) {
            $(".divOverLay").show();
          }
          if (CKEDITOR.instances.editor) {
            CKEDITOR.instances.editor.destroy();
            $("#editor").val("");
          }
        }
      } catch (error) {
        console.log("ck error");
      }
    };

    $scope.subNumCharacters = 0;
    $scope.subNumDrawShapes = 0;
    $scope.loadQuizNew = function () {
      //$scope.getClockTime();
      $scope.helpAllowed = $rootScope.sectionHelp[$rootScope.activeQuiz];
      requestService
        .request("POST", true, "/quizData", { examId: $rootScope.activeQuiz })
        .then(
          function (response) {
            var result = response.data;
            $rootScope.consoleData(result, "/quizData-qc");
            $rootScope.updateTime(result.time);
            if (result.status) {
              var data = result.data;
              $scope.mode = "quiz";
              $scope.quiz = data.quizdata;
              $scope.swapOptions = []; //
              $scope.arrangeType = [];

              if ($scope.loginTime == "absolute") {
                if ($rootScope.absFirstQuizStart) {
                  $rootScope.startedOn = new Date($scope.getClock());
                }

                $scope.session_begin_time = new Date($rootScope.startedOn);
              } else {
                $scope.session_begin_time = new Date($scope.getClock());
              }

              $scope.config = helper.extend(
                {},
                $scope.defaultConfig,
                $scope.data.config
              );
              $scope.questions = $scope.config.shuffleQuestions
                ? helper.shuffle($scope.quiz.elements)
                : $scope.quiz.elements;
              $scope.totalItems = $scope.questions.length;
              if (data.isResponse && data.response.length > 0) {
                //Quiz Load with Response
                let quizSecId = `${dataService.getData(
                  "QUIZID"
                )}${dataService.getData("USER")}${$scope.sectionNumber}`;
                $scope.quizResponse = data.response;
                for (var i = 0; i < $scope.totalItems; i++) {
                  //set default value if tempAns not avail
                  if (typeof $scope.quizResponse[i].answerId === "undefined") {
                    $scope.quizResponse[i].answerId = -1;
                  }

                  if (!$scope.quizResponse[i].hasOwnProperty("tempAns")) {
                    $scope.quizResponse[i]["tempAns"] =
                      $scope.quizResponse[i].answerId;
                  }
                  $scope.isReviewQuestions[i] = $scope.quizResponse[i].review;
                  $scope.timeTaken[i] = $scope.quizResponse[i].timeTaken;
                  //For calculate used time

                  $scope.Stime[i] = 0;
                  $scope.Etime[i] = $scope.quizResponse[i].timeTaken;
                  $scope.hintUsed[i] = $scope.quizResponse[i].helpUsed;
                  $scope.answSelected[i] = $scope.quizResponse[i].answerId;
                  $scope.lock[i] = $scope.quizResponse[i].lock;
                  $scope.tempAns[i] = $scope.quizResponse[i].tempAns;

                  // update subjective tempAns data
                  if ($scope.quizResponse[i].type == "sub") {
                    let quesKey = `${quizSecId}${$scope.quizResponse[i].ref}`.toLowerCase();
                    let subLsData = dataService.getLS("subjective", quesKey);

                    if ($scope.tempAns[i] !== -1) {
                      if (subLsData) {
                        if (
                          subLsData.lastUpdate >= $scope.tempAns[i].lastUpdate
                        ) {
                          $scope.tempAns[i] = subLsData;
                        }
                      }
                    } else {
                      if (subLsData) {
                        $scope.tempAns[i] = subLsData;
                      }
                    }
                  }
                  //end of subjective tempAns
                } //End For

                $scope.timeUsed = data.timeTaken;
                if ($scope.loginTime != "absolute") {
                  $scope.session_begin_time.setSeconds(
                    $scope.session_begin_time.getSeconds() - $scope.timeUsed
                  );
                }

                //Load example response
                $scope.loadResponseExample();
                //Load mcq response
                $scope.loadResponseMcq();
                //Load arrange response
                $scope.loadResponseArrange();
                $scope.itemsPerPage = $scope.config.pageSize;
                //$scope.currentPage = 1;
                $scope.currentPage = data.lastQue;
                $scope.getStartTime($scope.currentPage);
                $scope.setGridCenter($scope.currentPage);

                $scope.$watch("currentPage + itemsPerPage", function () {
                  var begin = ($scope.currentPage - 1) * $scope.itemsPerPage;
                  var end = begin + $scope.itemsPerPage;
                  $scope.filteredQuestions = $scope.questions.slice(begin, end);
                  $scope.clearJQFill();
                  $scope.clearCkEditor();

                  loadQuizNewTim = $timeout(function () {
                    $scope.loadResponseFillIn();
                    $scope.loadSubjective("quiz");
                    $scope.initNumOfFillins();
                  }, 1500);

                  loadInitTim = $timeout(function () {
                    initJS("quiz");
                  }, 1500);
                });
              } else {
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
                $scope.$watch("currentPage + itemsPerPage", function () {
                  $scope.clearJQFill();
                  var begin = ($scope.currentPage - 1) * $scope.itemsPerPage,
                    end = begin + $scope.itemsPerPage;
                  $scope.filteredQuestions = $scope.questions.slice(begin, end);

                  $scope.clearCkEditor();
                  loadInitTim = $timeout(function () {
                    initJS("quiz");
                    $scope.loadSubjective("quiz");
                    $scope.initNumOfFillins();
                    $scope.chkQusLock();
                  }, 1000);
                });

                //Initilizing arrrange type questions here
                for (var i = 0; i < $scope.totalItems; i++) {
                  if ($scope.questions[i].type === "arrange") {
                    var temp = [];
                    for (
                      var j = 0;
                      j < $scope.questions[i].object.items.length;
                      j++
                    ) {
                      temp[j] = j + 1;
                    }
                    $scope.arrangeType[i] = temp;
                  }
                }
                //----------------------

                $scope.timeUsed = data.timeTaken;
                if ($scope.loginTime != "absolute") {
                  $scope.session_begin_time.setSeconds(
                    $scope.session_begin_time.getSeconds() - $scope.timeUsed
                  );
                }
              }

              $scope.setEndTime();
              $scope.gridMatrix();
              $scope.clearVCPTim();

              videoTim = $timeout(function () {
                dataService.getYtVideo();
              }, 2000);
              chartTim = $timeout(function () {
                dataService.getPlotChart();
              }, 2000);
              pdfTim = $timeout(function () {
                dataService.getPdfDoc();
              }, 2000);

              $scope.startQuizTimer();
              $timeout(() => {
                $(".pageLoader").fadeOut("slow");
              }, 500);

              $scope.isLoad = true;
            } else {
              $scope.errorHandling(result);
            }
          },
          function (errorResponse) {
            $scope.serverErrorHandling(errorResponse);
          }
        );
    };

    $scope.initNumOfFillins = function () {
      let eleInps = document.getElementById("divFillInBlank");
      if (eleInps) {
        let fillInputs = eleInps.getElementsByTagName("input");
        if (fillInputs) {
          $scope.numFillIns = fillInputs.length;
        }
      }
    };

    $scope.errorHandling = function (result) {
      if (result.error.code) {
        requestService.dbErrorHandler(result.error.code, result.error.type);
        if (result.error.code == "alert_afterQuizEnd") {
          $(".pageLoader").hide();
          $timeout(() => {
            dataService.loggoutWithReason("loggedOut");
          }, 4000);
        }
      } else {
        dataService.swalAndRedirect(
          $scope.lang["alert_unable_connect"],
          "warning",
          "btn-warning",
          "serverErr"
        );
      }
    };

    //==========Quiz response load ==========
    $scope.loadQuizReviewNew = function () {
      //$rootScope.activeQuiz set at summary page
      var reqdata = { examId: $rootScope.activeQuiz };
      $scope.helpAllowed = $rootScope.sectionHelpAtReview[$scope.activeQuiz];
      requestService.request("POST", true, "/quizResponseData", reqdata).then(
        function (response) {
          var result = response.data;

          $rootScope.updateTime(result.time);

          if (result.status) {
            var data = result.data;
            $scope.mode = "review";
            $scope.quiz = data.quizData;
            $scope.statistics = data.statistics;
            if (!$scope.validateTime()) {
              dataService.swalAndRedirect(
                $scope.lang.alert_beforeQuizStart,
                "warning",
                "btn-warning",
                "loggedOut"
              );
            }

            // for arrange type Questions.
            $scope.swapOptions = []; //
            $scope.arrangeType = [];
            $scope.session_begin_time = new Date($scope.getClock());
            $scope.startdatetime =
              $scope.session_begin_time.getDate() +
              "-" +
              ($scope.session_begin_time.getMonth() + 1) +
              "-" +
              $scope.session_begin_time.getFullYear() +
              " " +
              $scope.session_begin_time.getHours() +
              ":" +
              $scope.session_begin_time.getMinutes() +
              ":" +
              $scope.session_begin_time.getSeconds();
            $scope.config = helper.extend(
              {},
              $scope.defaultConfig,
              $scope.data.config
            );
            $scope.questions = $scope.config.shuffleQuestions
              ? helper.shuffle($scope.quiz.elements)
              : $scope.quiz.elements;
            $scope.totalItems = $scope.questions.length;

            //Quiz Load with Response
            $scope.quizResponse = data.response; //--start from here aak
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
            $scope.baseScore = [];
            $scope.grader = [];

            $scope.correction = [];
            $scope.ticket = [];
            $scope.feedback = [];

            $scope.allowPartialGrading = $scope.sectData.partialGrading;
            //clear localstorage for better performance
            $scope.clearCurrentSecLS();

            for (var i = 0; i < $scope.totalItems; i++) {
              //set default value if tempAns not avail
              if (typeof $scope.quizResponse[i].answerId === "undefined") {
                $scope.quizResponse[i].answerId = -1;
              }

              if (!$scope.quizResponse[i].hasOwnProperty("tempAns")) {
                $scope.quizResponse[i].tempAns = $scope.quizResponse[i].answerId;
              }

              $scope.isReviewQuestions[i] = $scope.quizResponse[i].review;
              $scope.timeTaken[i] = $scope.quizResponse[i].timeTaken;

              //For calculate used time
              $scope.timeUsed =
                $scope.timeUsed + $scope.quizResponse[i].timeTaken;
              $scope.Stime[i] = 0;
              $scope.Etime[i] = $scope.quizResponse[i].timeTaken;
              $scope.hintUsed[i] = $scope.quizResponse[i].helpUsed;
              $scope.answSelected[i] = $scope.quizResponse[i].answerId;
              $scope.lock[i] = $scope.quizResponse[i].lock;
              $scope.tempAns[i] = $scope.quizResponse[i].tempAns;
              /////add check for subjective old question /////
              ///Problem was that sometime text or drawing field is not exist
              if ($scope.questions[i].type == "sub") {
                if ($scope.tempAns[i] !== -1) {
                  if (
                    $scope.questions[i].object.limit == 0 ||
                    !$scope.tempAns[i].hasOwnProperty("text")
                  ) {
                    $scope.tempAns[i] = {
                      ...$scope.tempAns[i],
                      text: "",
                    };
                  }

                  if (
                    $scope.questions[i].object.allowedDrawings == 0 ||
                    !$scope.tempAns[i].hasOwnProperty("drawing")
                  ) {
                    $scope.tempAns[i] = {
                      ...$scope.tempAns[i],
                      drawing: [],
                    };
                  }
                }
              }
              ///end of old  subjective check

              const maxMark = $scope.sectData.gradingMatrix[0][$scope.hintUsed[i]];
              const minMark = $scope.sectData.gradingMatrix[2][$scope.hintUsed[i]];
              

              
              //aakTic
              // tickets //
              $scope.ticket[i] = {
                hasTicket: false,
                raiseDivStatus: "close",
                resDivStatus: "close",
                tempAuthRes: "",
                tempTxt: "",
                scoreCorrection: false,
                notResolved: true,
              };
              if ($scope.quizResponse[i].hasOwnProperty("ticket")) {
                $scope.ticket[i] = {
                  ...$scope.ticket[i],
                  hasTicket: true,
                  tempAuthRes: $scope.quizResponse[i].ticket.resolved
                    ? $scope.quizResponse[i].ticket.response
                    : "",
                  notResolved: !$scope.quizResponse[i].ticket.resolved,
                  ...$scope.quizResponse[i].ticket,
                };
              }
              // end of tickets //

              //feedback //
              $scope.feedback[i] = {
                hasFeedback: false,
                tempTxt: "",
                text: "",
                feedDivStatus: "close",
              };
              if ($scope.quizResponse[i].hasOwnProperty("feedback")) {
                $scope.feedback[i] = {
                  ...$scope.feedback[i],
                  hasFeedback: true,
                  tempTxt: $scope.quizResponse[i].feedback.text,
                  ...$scope.quizResponse[i].feedback,
                };
              }
              //end of feedback //
              let breakOutScore = 0;
              if ($scope.allowPartialGrading) {
                if (typeof $scope.scoreDetails[i].score === "number") {
                  if ("partial" in $scope.scoreDetails[i]) {
                    $scope.scoreDetails[i].score =
                      $scope.scoreDetails[i].score +
                      $scope.scoreDetails[i].partial;
                      breakOutScore += $scope.scoreDetails[i].partial;
                  }
                }
              }
              /// end of partial score //

              // correction //
              $scope.correction[i] = {
                hasCorrection: false,
                tempCorrection: 0,
                score:
                  typeof $scope.scoreDetails[i].score === "number"
                    ? $scope.scoreDetails[i].score
                    : 0,
                correction: 0,
                corrDivStatus: "close",
                minMark: minMark,
                maxMark: maxMark,
              };

              if ($scope.quizResponse[i].hasOwnProperty("correction") && $scope.quizResponse[i].correction !=0) {
                $scope.correction[i] = {
                  ...$scope.correction[i],
                  hasCorrection: true,
                  haveValue: true,
                  correction: $scope.quizResponse[i].correction,
                  tempCorrection: $scope.quizResponse[i].correction,
                };
              }

              if ($scope.quizResponse[i].hasOwnProperty("correctionReq")) {
                $scope.correction[i] = {
                  ...$scope.correction[i],
                  hasCorrection: true,
                  ...$scope.quizResponse[i].correctionReq,
                  tempCorrection:
                    $scope.quizResponse[i].correctionReq.correction,
                };
              }
              breakOutScore += $scope.correction[i].correction;
             
              //end of correction//
              
              $scope.grader[i] = {
                isGraded:false,
                isScoreMisMatch:false
              }
              //include adjustment
              
              if($scope.quizResponse[i].hasOwnProperty("grader")){
                $scope.grader[i] = {
                  isGraded:true,
                  ...$scope.quizResponse[i].grader
                }
                $scope.grader[i].queRubrics['rules'] = $scope.grader[i].queRubrics['rules'].filter(x=>$scope.grader[i].rubrics.indexOf(x.id) !== -1 && !x.deleted);
                $scope.grader[i].queRubrics['rules'].sort((a,b)=>b.value-a.value);
                breakOutScore += $scope.grader[i].queRubrics['rules'].reduce((a,cv)=>a= a + (+cv.value) ,0);
                breakOutScore += $scope.grader[i].queRubrics['adjEnabled'] &&  +$scope.grader[i].adjustment;
              }
              
             

              $scope.baseScore[i] = 'na';
              $scope.correctAnsGiven[i] = {
                avl:'no'
              }
              // show correct/incorrect/skipped
              if ($scope.quizResponse[i].hasOwnProperty("gradingIndex")) {
                $scope.hasGradIndex[i] = true;
                let gradeindex = $scope.quizResponse[i].gradingIndex;
                let score = (typeof $scope.scoreDetails[i].score === "number")?$scope.scoreDetails[i].score:0;
                let scoreAfterCorr = (score + $scope.correction[i].correction).toFixed(2);
                
                $scope.correctAnsGiven[i]['avl'] = 'yes';

                ///
                if(gradeindex[0] == 1){
                  $scope.correctAnsGiven[i]['status'] = "skipped";
                  $scope.baseScore[i] = $scope.sectData.gradingMatrix[1][$scope.hintUsed[i]];
                  $scope.correctAnsGiven[i]['label'] = "Skipped";
                }else{
                  let avg = (maxMark+minMark)/2;
                  if ($scope.questions[i].type == "sub" && gradeindex[0]==2) {
                    $scope.baseScore[i] = 0;
                  }else{
                    $scope.baseScore[i] = $scope.sectData.gradingMatrix[gradeindex[0]][$scope.hintUsed[i]];
                  }
                  if(scoreAfterCorr == maxMark){
                    $scope.correctAnsGiven[i]['status'] = "correct";
                    $scope.correctAnsGiven[i]['label'] = "Correct";
                  }else
                  if(scoreAfterCorr == minMark){
                    $scope.correctAnsGiven[i]['status'] = "incorrect";
                    $scope.correctAnsGiven[i]['label'] = "Incorrect";
                  }else 
                  if(scoreAfterCorr < avg){
                    $scope.correctAnsGiven[i]['status'] = "incorrect";
                    $scope.correctAnsGiven[i]['label'] = "Mostly incorrect";
                  }else 
                  if(scoreAfterCorr >= avg){
                    $scope.correctAnsGiven[i]['status'] = "correct";
                    $scope.correctAnsGiven[i]['label'] = "Mostly correct";
                  }
                  
                }
                breakOutScore += +$scope.baseScore[i];
              } else {
                $scope.hasGradIndex[i] = false;
              }
              // end of correct/incorrect  //
              $scope.grader[i].isScoreMisMatch = (breakOutScore != ($scope.scoreDetails[i].score+$scope.correction[i].correction) )?true:false;
              //update timetaken in stats//

              // if (
              //   $scope.quizResponse[i].type !== "info" &&
              //   $scope.quizResponse[i].type !== "sub"
              // ) {
              //   let stats = $scope.statistics[$scope.quizResponse[i].ref];

              //   $scope.statistics[$scope.quizResponse[i].ref] = stats;
              // }
              //end of timetaken in stats//
            }
            //Load example response
            $scope.loadResponseExample();
            //Load mcq response
            $scope.loadResponseMcq();
            //Load arrange response
            $scope.loadResponseArrange();
            $scope.itemsPerPage = $scope.config.pageSize;
            $scope.currentPage = 1;
            $scope.getStartTime($scope.currentPage);
            $scope.$watch("currentPage + itemsPerPage", function () {
              var begin = ($scope.currentPage - 1) * $scope.itemsPerPage;
              var end = begin + $scope.itemsPerPage;
              $scope.filteredQuestions = $scope.questions.slice(begin, end);
              $scope.qref = $scope.filteredQuestions[0].ref;
              $scope.clearJQFill();
              //$scope.clearCkEditor();
              loadQuizNewTim = $timeout(function () {
                $scope.loadResponseFillIn();
                //$scope.initNumOfFillins();
                $scope.loadSubjective("review");
              }, 1500);
              loadInitTim = $timeout(function () {
                initJS("review");
              }, 1000);
              $scope.analytics();
              $scope.graderNoteCollapse = false;
            });
            //Convert secondos to time hh:mm:ss
            var t = $scope.timeUsed;
            var time = new Date((t % 86400) * 1000)
              .toUTCString()
              .replace(/.*(\d{2}):(\d{2}):(\d{2}).*/, "$1:$2:$3");
            $scope.completeTimeTaken = time;
            $(
              "#mcqOptions,#flag-btn,#lock-btn,#arrOptions,#fillinStatement,#topLockIcon"
            ).addClass("review");
            $scope.clearTimer();
            $scope.gridMatrix();
            //Initial load video and plotchart
            $scope.clearVCPTim();
            videoTim = $timeout(function () {
              dataService.getYtVideo();
              if($("#switchQuiz")){
                $("#switchQuiz").trigger('mouseover');
              }
            }, 2000);
            chartTim = $timeout(function () {
              dataService.getPlotChart();
            }, 2000);
            pdfTim = $timeout(function () {
              dataService.getPdfDoc();
            }, 2000);
            $(".pageLoader").fadeOut("slow");
            $scope.isLoad = true;
          } else {
            //$(".pageLoader").show();
            requestService.dbErrorHandler(result.error.code, result.error.type);
          }
        },
        function (responseError) {
          $scope.serverErrorHandling(responseError);
        }
      );
    };

    $scope.openTicketInput = function (type, divStatus) {
      let divId = "";
      if (type === "studTik") {
        if ($scope.ticket[$scope.currentPage - 1].hasTicket) {
          return;
        }
        divId = "raiseTicketFocus";
        $scope.ticket[$scope.currentPage - 1].raiseDivStatus = divStatus;
      } else if (type == "authTik") {
        //extra check to no resolve multiple time
        if ($scope.ticket[$scope.currentPage - 1].resolved) {
          return;
        }

        divId = "resolveTicketFocus";
        $scope.ticket[$scope.currentPage - 1].resDivStatus = divStatus;
      } else if (type === "authFeedback") {
        divId = "authFeedbackFocus";
        $scope.feedback[$scope.currentPage - 1].feedDivStatus = divStatus;
      } else if (type === "authScoreCorr") {
        // if ($scope.ticket[$scope.currentPage - 1].scoreCorrection) {
        //   return;
        // }
        divId = "authScoreCorrInp";
        $scope.correction[$scope.currentPage - 1].corrDivStatus = divStatus;
      }
      $timeout(() => {
        $("#" + divId).focus();
        $scope.scrollBody(divId);
      }, 100);
    };

    $scope.raiseTicket = function () {
      const ref = $scope.qref;
      const index = $scope.currentPage - 1;
      const issue = $scope.ticket[index].tempTxt.trim();
      const maxCharMsg = $filter('findReplace')($scope.lang.alert_maxChar
        ,{'###': maxChars});

      if (issue === "") {
        helperService.notifyMsg(
          "ti-alert","danger",$scope.lang.alert_resOnIssue,"top","center",3000);
        return;
      }else 
      if (issue.length > 500) {
        helperService.notifyMsg(
          "ti-alert",
          "danger",
          maxCharMsg,
          "top",
          "center",
          3000
        );
        return;
      }

      if ($scope.resquestSend) {
        return;
      }
      swal({
        title: $scope.lang.caption_sure,
        type: "warning",
        showCancelButton: true,
        confirmButtonClass: "btn btn-success btn-fill",
        cancelButtonClass: "btn btn-danger btn-fill",
        confirmButtonText: $scope.lang.caption_yes,
        buttonsStyling: false,
      }).then(
      function () {
        $scope.resquestSend = true;
      requestService
        .request("POST", true, "/raiseTicket", {
          examId: $rootScope.activeQuiz,
          ref,
          issue,
          index,
        })
        .then(
          function (response) {
            var result = response.data;
            $scope.resquestSend = false;
            if (result.status) {
              let data = result.data;
              let reqIndex = data.index;
              $scope.ticket[reqIndex] = {
                ...$scope.ticket[reqIndex],
                ...data.ticket,
                hasTicket: true,
                raiseDivStatus: "close",
              };
            } else {
              if(result.error.code==="msg_maxTicket"){
                const message = $filter('findReplace')($scope.lang.msg_maxTicket
                  ,{'###': result.error.maxTickets});
                  helperService.notifyMsg(
                    "ti-alert",
                    "danger",
                    message,
                    "top",
                    "center",
                    4000
                  );

              }else{
                requestService.dbErrorHandler(
                  result.error.code,
                  result.error.type
                );
              }

              
            }
          },
          function (errorResponse) {
            $scope.resquestSend = false;
            $scope.serverErrorHandling(errorResponse);
          }
        );
      },
      function () {}
      );
    };

    //ch1
    $scope.resolvedTicket = function () {
      if ($scope.resquestSend) {
        return;
      }
      const ref = $scope.qref;
      const index = $scope.currentPage - 1;
      const response = $scope.ticket[index].tempAuthRes.trim();
      const maxCharMsg = $filter('findReplace')($scope.lang.alert_maxChar
        ,{'###': maxChars});

      if (response === "") {
        helperService.notifyMsg("ti-alert","danger",$scope.lang.alert_resOnIssue,"top","center",3000);
        return;
      }

      if (response.length > 500) {
        helperService.notifyMsg(
          "ti-alert",
          "danger",
          maxCharMsg,
          "top",
          "center",
          3000
        );
        return;
      }

      let data = {
        examId: $rootScope.activeQuiz,
        ref,
        response,
        index,
      };
    
      let isGradingScoreExceed = false;
      if ($scope.ticket[index].scoreCorrection) {
        data["scoreCorrection"] = true;
        data["correction"] = $scope.correction[index].tempCorrection;
        let afterCorr = ($scope.correction[$scope.currentPage-1].score+
          $scope.correction[$scope.currentPage-1].tempCorrection).toFixed(2);

        if (isNaN(data["correction"]) || data["correction"] === "") {
          helperService.notifyMsg("ti-alert","danger",$scope.lang.alert_validCorrValue,"top","center",3000);
          return;
        }

        ///start
        const absScore = $scope.getAbsoluteScore();
        if(absScore.absMax < afterCorr ||  absScore.absMin > afterCorr){
          helperService.notifyMsg("ti-alert","danger",$scope.lang.alert_CorrRange,"top","center",4000);
          return
        }

        if(afterCorr < $scope.correction[index].minMark || afterCorr > $scope.correction[index].maxMark){
          isGradingScoreExceed = true;
          //sweealert
          const msg =   $filter('findReplace')($scope.lang.alert_scoreOutOff
            ,{'###': $scope.correction[index].minMark, '@@@':$scope.correction[index].maxMark});
          swal({
            text: msg,
            type: "warning",
            showCancelButton: true,
            confirmButtonClass: "btn btn-success btn-fill",
            cancelButtonClass: "btn btn-danger btn-fill",
            confirmButtonText: $scope.lang.caption_yes,
            buttonsStyling: false,
          }).then(
            function () {
              $scope.resquestSend = true;
              requestService.request("POST", true, "/resolveTicket", data).then(
              function (response) {
                var result = response.data;
                $scope.resquestSend = false;
                if (result.status) {
                  let data = result.data;
                  let reqIndex = data.index;
                  $scope.ticket[reqIndex] = {
                    ...$scope.ticket[reqIndex],
                    ...data.ticket,
                    notResolved: false,
                    resDivStatus: "close",
                  };
    
                  if (data.hasOwnProperty("correctionReq")) {
                    $scope.correction[reqIndex] = {
                      ...$scope.correction[reqIndex],
                      hasCorrection: true,
                      corrDivStatus: "close",
                      ...data.correctionReq,
                    };
                  }
    
                  $scope.ticket[index].scoreCorrection = false;
                } else {
                  requestService.dbErrorHandler(result.error.code, result.error.type);
                }
              },
              function (errorResponse) {
                $scope.resquestSend = false;
                $scope.serverErrorHandling(errorResponse);
              }
            );
          },
          function () {}
          );
        
        }
        ///end
      }

      
     if(isGradingScoreExceed){
       return;
     }
    
     swal({
        title: $scope.lang.caption_sure,
        text: $scope.lang.alert_ticketResWarn,
        type: "warning",
        showCancelButton: true,
        confirmButtonClass: "btn btn-success btn-fill",
        cancelButtonClass: "btn btn-danger btn-fill",
        confirmButtonText: $scope.lang.caption_yes,
        buttonsStyling: false,
      }).then(
        function () {
          $scope.resquestSend = true;
          requestService.request("POST", true, "/resolveTicket", data).then(
          function (response) {
            var result = response.data;
            $scope.resquestSend = false;
            if (result.status) {
              let data = result.data;
              let reqIndex = data.index;
              $scope.ticket[reqIndex] = {
                ...$scope.ticket[reqIndex],
                ...data.ticket,
                notResolved: false,
                resDivStatus: "close",
              };

              if (data.hasOwnProperty("correctionReq")) {
                $scope.correction[reqIndex] = {
                  ...$scope.correction[reqIndex],
                  hasCorrection: true,
                  corrDivStatus: "close",
                  ...data.correctionReq,
                };
              }

              $scope.ticket[index].scoreCorrection = false;
            } else {
              requestService.dbErrorHandler(result.error.code, result.error.type);
            }
          },
          function (errorResponse) {
            $scope.resquestSend = false;
            $scope.serverErrorHandling(errorResponse);
          }
        );
      },
      function () {}
      );
    };

    $scope.getAbsoluteScore = function(){
      let score = {};
      score['absMax'] = $scope.sectData.gradingMatrix[0][0];
      score['absMin'] = $scope.sectData.gradingMatrix[2][$scope.sectData.helpAllowed];
     return score;
    }

    

    $scope.saveAuthorFeedBack = function () {
      const ref = $scope.qref;
      const index = $scope.currentPage - 1;
      const text = $scope.feedback[index].tempTxt.trim();
      const maxCharMsg = $filter('findReplace')($scope.lang.alert_maxChar
        ,{'###': maxChars});
       
      if (text.length > 500) {
        helperService.notifyMsg(
          "ti-alert",
          "danger",
          maxCharMsg,
          "top",
          "center",
          3000
        );
        return;
      }

      if ($scope.resquestSend) {
        return;
      }

      $scope.resquestSend = true;
      requestService
        .request("POST", true, "/queFeedback", {
          examId: $rootScope.activeQuiz,
          ref,
          text,
        })
        .then(
          function (response) {
            var result = response.data;
            $scope.resquestSend = false;
            if (result.status) {
              let data = result.data;
              let reqIndex = index;
              $scope.feedback[reqIndex] = {
                ...$scope.feedback[reqIndex],
                ...data.feedback,
                hasFeedback: true,
                feedDivStatus: "close",
              };
            } else {
              requestService.dbErrorHandler(
                result.error.code,
                result.error.type
              );
            }
          },
          function (errorResponse) {
            $scope.resquestSend = false;
            $scope.serverErrorHandling(errorResponse);
          }
        );

    
    };

    //ch1
    $scope.authScoreCorrection = function () {
      if ($scope.resquestSend) {
        return;
      }
      let isGradingScoreExceed = false;
      const ref = $scope.qref;
      const index = $scope.currentPage - 1;

      let data = {
        examId: $rootScope.activeQuiz,
        ref,
        index,
      };

      let afterCorr = ($scope.correction[$scope.currentPage-1].score+
        $scope.correction[$scope.currentPage-1].tempCorrection).toFixed(2)

      data["correction"] = $scope.correction[index].tempCorrection;

      if (isNaN(data["correction"]) || data["correction"] === "") {
        helperService.notifyMsg("ti-alert","danger",$scope.lang.alert_validCorrValue,"top","center",3000);
        return;
      }

      ///start
      const absScore = $scope.getAbsoluteScore();
      if(absScore.absMax < afterCorr ||  absScore.absMin > afterCorr){
        helperService.notifyMsg("ti-alert","danger",$scope.lang.alert_CorrRange,"top","center",4000);
        return
      }

      if (afterCorr < $scope.correction[index].minMark || afterCorr > $scope.correction[index].maxMark){
          isGradingScoreExceed = true;
          const msg =   $filter('findReplace')($scope.lang.alert_scoreOutOff
            ,{'###': $scope.correction[index].minMark, '@@@':$scope.correction[index].maxMark});
          swal({
           
            text: msg,
            type: "warning",
            showCancelButton: true,
            confirmButtonClass: "btn btn-success btn-fill",
            cancelButtonClass: "btn btn-danger btn-fill",
            confirmButtonText: $scope.lang.caption_yes,
            buttonsStyling: false,
          }).then(
            function () {
              $scope.resquestSend = true;
              //exceed
              requestService.request("POST", true, "/queCorrection", data).then(
                function (response) {
                  var result = response.data;
                  $scope.resquestSend = false;
                  if (result.status) {
                    let data = result.data;
                    let reqIndex = data.index;
                    $scope.correction[reqIndex] = {
                      ...$scope.correction[reqIndex],
                      hasCorrection: true,
                      corrDivStatus: "close",
                      ...data.correctionReq,
                    };
                  } else {
                    requestService.dbErrorHandler(result.error.code, result.error.type);
                  }
                },
                function (errorResponse) {
                  $scope.resquestSend = false;
                  $scope.serverErrorHandling(errorResponse);
                }
              );
            },
            function(){});
      }

      if(isGradingScoreExceed){
        return;
      }
      
      $scope.resquestSend = true;
      requestService.request("POST", true, "/queCorrection", data).then(
        function (response) {
          var result = response.data;
          $scope.resquestSend = false;
          if (result.status) {
            let data = result.data;
            let reqIndex = data.index;
            $scope.correction[reqIndex] = {
              ...$scope.correction[reqIndex],
              hasCorrection: true,
              corrDivStatus: "close",
              ...data.correctionReq,
            };
          } else {
            requestService.dbErrorHandler(result.error.code, result.error.type);
          }
        },
        function (errorResponse) {
          $scope.resquestSend = false;
          $scope.serverErrorHandling(errorResponse);
        }
      );
      
    };

    /* auto save data after 10 clicks nidhi 8-sep-16
    we can call function checkclick() where we want to count click
    */
    var counter = 0;
    //Autosave
    $scope.autoSave = function () {
      if (dataService.getData("ATTEMPT") == false) {
        counter++;
        if (counter > 10) {
          counter = 0;
          $scope.onFinish($scope.currentPage);
          $scope.saveResponse("save", "autoSave10Click");
        }
      }
    };

    //After 60 sec autosave
    $scope.autoSaveWithSec = function (cnt) {
      if (
        dataService.getData("ATTEMPT") == false &&
        +dataService.getData("LOGGEDIN") == 1
      ) {
        $scope.verifyToken();
        $scope.onFinish($scope.currentPage);
        $scope.saveResponse("save", "autoSave60Seconds", false);
      }
    };

    $scope.score = function () {
      $("#quiz-ans").show();
      $scope.scrollBody("quiz-ans");
    };

    /*-----------to load score nidhi 8-sep-16-----------*/
    //=================================  run any of the function to  load quiz or load the response.
    if (dataService.getData("ATTEMPT") == true) {
      $scope.loadQuizReviewNew();
    } else if (dataService.getData("ATTEMPT") == false) {
      // log me out when focus is out
      dataService.onFocusOut($rootScope.allowFC);
      $scope.loadQuizNew();
    }
    //======================   NEXT 20 / PREVIOUS 20 BUTTON ===================================
    //default variables to compute next twenty questions.
    $scope.initQuestions = 0;
    $scope.offset = 0;
    //======Question Grid=======
    $scope.martixRow = [];
    $scope.matrixPointer = 0;
    $scope.gridMatrix = function () {
      for (var i = 1; i <= $scope.questions.length; i++) {
        $scope.martixRow.push(i);
      }
      initilizeGridRow();
    };

    var initilizeGridRow = function () {
      $scope.gridRow1 = $scope.martixRow.slice(
        $scope.matrixPointer,
        $scope.matrixPointer + 3
      );
      $scope.gridRow2 = $scope.martixRow.slice(
        $scope.matrixPointer + 3,
        $scope.matrixPointer + 6
      );
      $scope.gridRow3 = $scope.martixRow.slice(
        $scope.matrixPointer + 6,
        $scope.matrixPointer + 9
      );
    };

    $scope.nextQus = function () {
      if (
        $scope.matrixPointer < $scope.questions.length - 9 &&
        $scope.questions.length > 9 &&
        $scope.currentPage >= 6 &&
        $scope.currentPage <= $scope.questions.length - 4
      ) {
        $scope.matrixPointer++;
        initilizeGridRow();
      }
    };

    $scope.preQus = function () {
      if (
        $scope.matrixPointer > 0 &&
        $scope.currentPage >= 4 &&
        $scope.currentPage <= $scope.questions.length - 5
      ) {
        $scope.matrixPointer--;
        initilizeGridRow();
      }
    };

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
    };
    //======End Qus Grid========

    //go to the last question of the set of twenty questions.
    $scope.goToLast = function () {
      if ($scope.initQuestions != 0) {
        $scope.prevTwentyQuestions();
        $scope.onLeft(
          ($scope.initQuestions + 1) * 20 + 1,
          $scope.initQuestions * 20 + 20
        );
      }
    };

    //go to particular page.
    $scope.goTo = function (index) {
      if (index > 0 && index <= $scope.totalItems) {
        $scope.currentPage = index;
      }
      $scope.chkQusLock();
    };

    //check whether the question is being answered or not.//rm
    $scope.isAnswered = function (index) {
      var answered = "not-answered";
      $scope.questions[index].object.options.forEach(function (
        element,
        index,
        array
      ) {
        if (element.Selected == true) {
          answered = "Answered";
          return false;
        }
      });
      return answered;
    };

    //function will be called when some one click review button.
    $scope.doReview = function (currentQues) {
      if ($scope.isReviewQuestions[$scope.currentPage - 1] == 0)
        $scope.isReviewQuestions[$scope.currentPage - 1] = 1;
      else $scope.isReviewQuestions[$scope.currentPage - 1] = 0;
      if (!dataService.getData("ISSECTION")) $scope.autoSave(); //Auto save
    };

    // check if the particular question is being checked for review.
    $scope.checkReview = function (currentQ) {
      if ($scope.isReviewQuestions[currentQ - 1] == 0) return false;
      else return true;
    };

    // changes the color of the current question to blue color.
    $scope.currentQ = function (id) {
      if ($scope.currentPage == id) return true;
      else return false;
    };

    $scope.checkClick = function () {
      var a = new Date($scope.getClock());
    };

    //set the hint used
    $scope.setHintUsed = function (id) {
      if ($scope.hintUsed[id - 1] == 0) {
        if ($scope.filteredQuestions[0].type != "info") {
          $scope.hintUsed[id - 1] = 1;
        }
      }
    };
    //get the hint used.
    $scope.getHintUsed = function (id) {
      return $scope.hintUsed[id - 1];
    };
    //set the explnation used.
    $scope.setExpUsed = function (id) {
      if ($scope.filteredQuestions[0].type != "info") {
        if ($scope.hintUsed[id - 1] == 1) {
          $scope.hintUsed[id - 1] = 2;
        }
      }
    };

    $scope.onLeft = function (currentPage, prev) {
      if (currentPage > 1) {
        $scope.getStartTime(prev);
        $scope.getEndTime(currentPage);
        $scope.getTotalTime(currentPage);
        $scope.goTo(prev);
      }
    };
    $scope.onRight = function (currentPage, next) {
      if (currentPage < $scope.totalItems) {
        $scope.checkClick();
        $scope.getStartTime(next);
        $scope.getEndTime(currentPage);
        $scope.getTotalTime(currentPage);
        $scope.goTo(next);
      }
    };

    // ================ Functions for toggling hint Explanation Button==============
    let graphTimeout = undefined;
    $scope.analytics = function () {
      if (
        ($rootScope.allowStats || $scope.reqBy == "auth") &&
        $scope.statistics[$scope.qref].queType !== "na" &&
        $scope.statistics[$scope.qref].gradingIndexExists
      ) {
        
        $("#quiz-hintExpDiv").html(
          `<canvas id="hintExpDivGraph" width="400" height="300"></canvas>`
        );
        $("#quiz-answerDiv").html(
          `<canvas id="answerGraph" width="400" height="400"></canvas>`
        );
        $(".summLable").hide();
        $("#canvasguagetimeGraph").html("");
        $("#canvasguagescoreGraph").html("");

        //help used statistics option
        var chartOptions = {
          responsive: true,
          legend: {
            position: "bottom",
          },
          title: {
            display: true,
            text: "Score statistics",
          },
          scales: {
            yAxes: [
              {
                ticks: {
                  beginAtZero: true,
                },
              },
            ],
          },
        };
        //answer statistics option
        var Options = {
          responsive: true,
          legend: {
            position: "bottom",
          },
          title: {
            display: true,
            text: "Answered statistics",
          },
          animation: {
            animateRotate: true,
          },
        };
        //dataset of answer stat
       

        let barChartData = null;
        let doughnutdata = null;
        if($scope.questions[$scope.currentPage - 1].type =="sub"){
          barChartData = {
            labels: [
              "Correct",
              "Incorrect",
              "Mostly Correct",
              "Mostly Incorrect",
              "Skipped"
            ],
            datasets: [
              {
                label: "No Help Used",
                backgroundColor: "#68B3C8",
                borderColor: "#68B3C8",
                borderWidth: 1,
                barThickness: 20,
                data:  [$scope.statistics[$scope.qref].Subjective['correct']['noHelp'],$scope.statistics[$scope.qref].Subjective['mostlyCorrect']['noHelp'] ,$scope.statistics[$scope.qref].Subjective['incorrect']['noHelp'],$scope.statistics[$scope.qref].Subjective['mostlyIncorrect']['noHelp'],$scope.statistics[$scope.qref].Subjective['skipped']['noHelp']]
              },
              {
                label: "Hint Only Used",
                backgroundColor: "#7AC29A",
                borderColor: "#7AC29A",
                borderWidth: 1,
                barThickness: 20,
                data: [$scope.statistics[$scope.qref].Subjective['correct']['hint'],$scope.statistics[$scope.qref].Subjective['mostlyCorrect']['hint'],$scope.statistics[$scope.qref].Subjective['incorrect']['hint'],$scope.statistics[$scope.qref].Subjective['mostlyIncorrect']['hint'],$scope.statistics[$scope.qref].Subjective['skipped']['hint']]
              },
              {
                label: "Help used (Both hint and explanation)",
                backgroundColor: "#F3BB45",
                borderColor: "#F3BB45",
                borderWidth: 1,
                barThickness: 20,
                data: [$scope.statistics[$scope.qref].Subjective['correct']['expl'],$scope.statistics[$scope.qref].Subjective['mostlyCorrect']['expl'],$scope.statistics[$scope.qref].Subjective['incorrect']['expl'],$scope.statistics[$scope.qref].Subjective['mostlyIncorrect']['expl'],$scope.statistics[$scope.qref].Subjective['skipped']['expl']]
              }
            ]
          };
         
          barChartData = ($scope.sectData.helpAllowed==2) ? barChartData 
          : ($scope.sectData.helpAllowed==1) ? {...barChartData,datasets:barChartData.datasets.filter((ele, idx) => idx !==2)}
          : {...barChartData,datasets:barChartData.datasets.filter((ele, idx) => idx !==2 && idx !==1)};

          doughnutdata = {
            datasets: [
              {
                data: [
                  ($scope.statistics[$scope.qref].Subjective['correct']['noHelp']+ $scope.statistics[$scope.qref].Subjective['correct']['hint']+ $scope.statistics[$scope.qref].Subjective['correct']['expl']),($scope.statistics[$scope.qref].Subjective['mostlyCorrect']['noHelp']+$scope.statistics[$scope.qref].Subjective['mostlyCorrect']['hint']+$scope.statistics[$scope.qref].Subjective['mostlyCorrect']['expl']),($scope.statistics[$scope.qref].Subjective['incorrect']['noHelp']+$scope.statistics[$scope.qref].Subjective['incorrect']['hint']+$scope.statistics[$scope.qref].Subjective['incorrect']['expl']),($scope.statistics[$scope.qref].Subjective['mostlyIncorrect']['noHelp']+$scope.statistics[$scope.qref].Subjective['mostlyIncorrect']['hint']+$scope.statistics[$scope.qref].Subjective['mostlyIncorrect']['expl']),($scope.statistics[$scope.qref].Subjective['skipped']['noHelp']+$scope.statistics[$scope.qref].Subjective['skipped']['hint']+$scope.statistics[$scope.qref].Subjective['skipped']['expl'])],
                backgroundColor: ["#7AC29A","#79c29a8a", "#EB5E28","#ec5e2982","#66615b78"],
                hoverBackgroundColor: ["#7AC29A","#79c29a8a", "#EB5E28","#ec5e2982","#66615b78"],
                hoverBorderColor: ["#7AC29A","#79c29a8a", "#EB5E28","#ec5e2982","#66615b78"],
              },
            ],
            labels: ["Correct","Mostly Correct","Incorrect","Mostly Incorrect","Skipped"],
          };
        
         
          
        }else{
          //non subjective
          barChartData = {
            labels: ["Correct", "Incorrect", "Skipped"],
            datasets: [
              {
                label: "No Help Used",
                backgroundColor: "#68B3C8",
                borderColor: "#68B3C8",
                borderWidth: 1,
                barThickness: 20,
                data: [
                  $scope.statistics[$scope.qref].GradMatrix[0][0],
                  $scope.statistics[$scope.qref].GradMatrix[2][0],
                  $scope.statistics[$scope.qref].GradMatrix[1][0],
                ],
              },
              {
                label: "Hint Only Used",
                backgroundColor: "#7AC29A",
                borderColor: "#7AC29A",
                borderWidth: 1,
                barThickness: 20,
                data: [
                  $scope.statistics[$scope.qref].GradMatrix[0][1],
                  $scope.statistics[$scope.qref].GradMatrix[2][1],
                  $scope.statistics[$scope.qref].GradMatrix[1][1],
                ],
              },
              {
                label: "Help used (Both hint and explanation)",
                backgroundColor: "#F3BB45",
                borderColor: "#F3BB45",
                borderWidth: 1,
                barThickness: 20,
                data: [
                  $scope.statistics[$scope.qref].GradMatrix[0][2],
                  $scope.statistics[$scope.qref].GradMatrix[2][2],
                  $scope.statistics[$scope.qref].GradMatrix[1][2],
                ],
              }
            ],
          };
          barChartData = 
          ($scope.sectData.helpAllowed==2) ? barChartData 
          : ($scope.sectData.helpAllowed==1) ? {...barChartData,datasets:barChartData.datasets.filter((ele, idx) => idx !==2)}
          : {...barChartData,datasets:barChartData.datasets.filter((ele, idx) => idx !==1 && idx !==2 )};

          doughnutdata = {
            datasets: [
              {
                data: [
                  $scope.statistics[$scope.qref].correct,
                  $scope.statistics[$scope.qref].incorrect,
                  $scope.statistics[$scope.qref].skipped,
                ],
                backgroundColor: ["#7AC29A", "#EB5E28", "#66615b78"],
                hoverBackgroundColor: ["#7AC29A", "#EB5E28", "#66615b78"],
                hoverBorderColor: ["#7AC29A", "#EB5E28", "#66615b78"],
              },
            ],
            labels: ["Correct", "Incorrect", "Skipped"],
          };
        }
       
        if (graphTimeout) {
          $timeout.cancel(graphTimeout);
          graphTimeout = undefined;
        }

        graphTimeout = $timeout(() => {
          let hEG = document.getElementById("hintExpDivGraph");
          if (hEG) {
            var ctx = hEG.getContext("2d");
            let myBar = new Chart(ctx, {
              type: "horizontalBar",
              data:barChartData,
              options: chartOptions,
            });
          }
          
          let ansG = document.getElementById("answerGraph");
          if (ansG) {
            var ctx1 = ansG.getContext("2d");
            var myDoughnutChart = new Chart(ctx1, {
              type: "doughnut",
              data: doughnutdata,
              options: Options,
            });
          }
          //average time and average score guage chart
          dataService.createGuage(
            $scope.statistics[$scope.qref],
            "averagetime",
            "canvasguagetimeGraph"
          );
          dataService.createGuage(
            $scope.statistics[$scope.qref],
            "averagescore",
            "canvasguagescoreGraph"
          );
          $(".summLable").show();
        }, 300);
      }
    };

    $scope.showHint = function (id) {
      if ($scope.filteredQuestions[0].type == "info") {
        let option = {
          placement: {
            from: "top",
            align: "center",
          },
          delay: 3000,
        };
        $scope.notifyAlertMsg("hintInfo", $scope.lang.caption_hintInfo, option);
        return;
      }

      if ($("#quiz-hint").length > 0) {
        $("#quiz-hint").remove();
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
                    <div class="help-content" style="font-weight:normal;" ng-repeat="question in filteredQuestions">
                      <br>  
                      <span  math="{{ question.object.hint }}"></span>
                    </div>
                </div>
            </div>
          </div>`;

      if (dataService.getData("ATTEMPT") == false) {
        $("#quiz-info").append($compile(hint)($scope));
        $scope.setHintUsed(id);
        if (!dataService.getData("ISSECTION")) $scope.autoSave(); //Auto save
      } else {
        $("#quiz-info").append($compile(hint)($scope));
      }

      if ($("#quiz-hint").length > 0) {
        $scope.scrollBody("quiz-hint");
      }
    };

    $scope.showExplanation = function (id) {
      if ($scope.filteredQuestions[0].type == "info") {
        let option = {
          placement: {
            from: "top",
            align: "center",
          },
          delay: 3000,
        };
        $scope.notifyAlertMsg("expInfo", $scope.lang.caption_hintExpl, option);
        return;
      }

      if ($("#quiz-explanation").length > 0) {
        $("#quiz-explanation").remove();
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
                    <div class="help-content" style="font-weight:normal;" ng-repeat="question in filteredQuestions">
                      <br> 
                      <span  math="{{ question.object.explanation }}"></span>
                    </div>
                </div>
            </div>
          </div>`;

      if (dataService.getData("ATTEMPT") == false) {
        if ($scope.hintUsed[id - 1] >= 1) {
          $scope.setExpUsed($scope.currentPage);
          $("#quiz-info").append($compile(exp)($scope));
        } else {
          let option = {
            placement: {
              from: "top",
              align: "center",
            },
            delay: 2000,
          };
          $scope.notifyAlertMsg(
            "hintFirst",
            $scope.lang.msg_useHintFirst,
            option
          );
        }

        if (!dataService.getData("ISSECTION")) $scope.autoSave(); //Auto save
      } else {
        $("#quiz-info").append($compile(exp)($scope));
      }

      if ($("#quiz-explanation").length > 0) {
        $scope.scrollBody("quiz-explanation");
      }
    };

    $scope.hideAll = function () {
      $("#quiz-instructions").addClass("hide-instruction");
      $("#quiz-hint").remove();
      $("#quiz-explanation").remove();
    };

    $scope.resetAll = function () {
      $("body, html").animate(
        {
          scrollTop: 0,
        },
        500
      );

      //$(".main-panel").scrollTop(0);
      //$(".navbar-fixed").scrollTop(0);
      $scope.clearVCPTim();
      videoTim = $timeout(function () {
        dataService.getYtVideo();
      }, 2000);
      chartTim = $timeout(function () {
        dataService.getPlotChart();
      }, 2000);
      pdfTim = $timeout(function () {
        dataService.getPdfDoc();
      }, 2000);
    };

    //Exit info like hint, explanantion and instruction
    $scope.closeInfo = function (id) {
      $("#" + id).toggle();
    };

    $scope.closeHelp = function (id) {
      $("#" + id).remove();
    };

    //===================== All logic to print json===================================
    $scope.selectAns = function (id, ansId) {
      // if question type == mcq then ansId will be Option Id
      // If it is arrange type then andID will be A Number like 3214 which represents the pattern
      // if code fr mcq type questions.
      $scope.answSelected[id - 1] = ansId;
    };

    $scope.getTime = function () {
      var d = new Date($scope.getClock());
      return d;
    };

    $scope.getStartTime = function (id) {
      var d = $scope.getTime();
      $scope.Stime[id - 1] = d;
    };

    $scope.getEndTime = function (id) {
      var d = $scope.getTime();
      $scope.Etime[id - 1] = d;
    };

    $scope.getTimeDiff = function (id) {
      var now = $scope.Stime[id - 1];
      var then = $scope.Etime[id - 1];
      var d = then - now;
      return d;
    };

    $scope.onFinish = function (currentPage) {
      $scope.getEndTime(currentPage);
      $scope.getTotalTime(currentPage);
      $scope.getStartTime(currentPage);
    };

    $scope.getTotalTime = function (id) {
      $scope.timeTaken[id - 1] =
        $scope.timeTaken[id - 1] + $scope.getTimeDiff(id) / 1000;
    };
    $scope.getTotalTimeOflastQues = function (id) {
      $scope.timeTaken[id - 1] =
        $scope.timeTaken[id - 1] + $scope.getTimeDiff(id) / 1000;
    };

    $scope.isSubmitClick = false;
    $scope.finalSubmit = function () {
      $(".modal").modal("hide");
      $(".pageLoader").show();
      var data = {
        quizId: dataService.getData("QUIZID"),
        uname: dataService.getData("USER"),
        isSection: dataService.getData("ISSECTION"),
        submitReason: submitType,
      };

      $scope.isSubmitClick = true;
      requestService.request("POST", true, "/submitQuiz", data).then(
        function (response) {
          var result = response.data;
          $rootScope.consoleData(result, "/submitQuiz-qc");
          $rootScope.updateTime(result.time);
          $scope.isSubmitClick = false;
          if (result.status) {
            dataService.setData("ATTEMPT", true);
            if ($scope.chkEndDate()) {
              dataService.setData("VIEWRES", true);
            }

            ////close overlay////
            $(".overlay-div").css("visibility", "hidden");
            $("body").css("overflow", "");
            //////////////////////

            $location.path("/quiz-summary");
          } else {
            $(".pageLoader").fadeOut("slow");
            requestService.dbErrorHandler(result.error.code, result.error.type);
          }
          $scope.submitBtnClick = false;
        },
        function (errorResponse) {
          $(".pageLoader").fadeOut("slow");
          $scope.serverErrorHandling(errorResponse);
          $scope.isSubmitClick = false;
          $scope.submitBtnClick = false;
          //$window.location.href = window.location.origin + window.location.pathname;
        }
      );
    };

    $scope.serverErrorHandling = function (errorResponse) {
      console.log("serverErrorHandling----");
      console.log(errorResponse);
      dataService.swalAndRedirect(
        $scope.lang["alert_unable_connect"],
        "warning",
        "btn-warning",
        "serverErr"
      );
    };

    $scope.submitQuizWithConfirm = function () {
      swal({
        title: $scope.lang.caption_sure,
        text: $scope.lang.caption_restartWarning,
        type: "warning",
        showCancelButton: true,
        confirmButtonClass: "btn btn-success btn-fill",
        cancelButtonClass: "btn btn-danger btn-fill",
        confirmButtonText: $scope.lang.caption_yes,
        buttonsStyling: false,
      }).then(
        function () {
          //stop simultaneous request
          if (!$scope.resquestSend) {
            $scope.onFinish($scope.currentPage);
            $scope.clearNotifyAlert();
            submitType = "manual";
            $scope.saveResponse("submit", "beforeSubmit");
          }
        },
        function () {}
      );
    };

    $scope.clearCurrentSecLS = function () {
      let quizSecId = `${dataService.getData("QUIZID")}${dataService.getData(
        "USER"
      )}${$scope.sectionNumber}`.toLowerCase();
      dataService.clearSectionLS("subjective", quizSecId);
    };

    $scope.submitBtnClick = false;
    // function to make a response object.
    $scope.saveResponse = function (val, savetype, notify = true) {
      $scope.resquestSend = true;
      $scope.quizResponse = {};
      var lastQue = $scope.currentPage;
      $scope.quizResponse.response = [];
      for (var i = 0; i < $scope.totalItems; i++) {
        $scope.quizResponse.response[i] = {};
        $scope.quizResponse.response[i].ref = $scope.questions[i].ref;
        $scope.quizResponse.response[i].type = $scope.questions[i].type;
        $scope.quizResponse.response[i].timeTaken = $scope.timeTaken[i];
        $scope.quizResponse.response[i].helpUsed = $scope.hintUsed[i];
        $scope.quizResponse.response[i].lock = $scope.lock[i];
        $scope.quizResponse.response[i].review = $scope.isReviewQuestions[i];
        if ($scope.questions[i].type == "sub") {
          $scope.quizResponse.response[i].answerId = $scope.lock[i] ? 1 : -1; //lock
          //generate blank response
          if ($scope.tempAns[i] !== -1) {
            if (
              $scope.questions[i].object.limit == 0 ||
              !$scope.tempAns[i].hasOwnProperty("text")
            ) {
              $scope.tempAns[i] = {
                ...$scope.tempAns[i],
                text: "",
              };
            }

            if (
              $scope.questions[i].object.allowedDrawings == 0 ||
              !$scope.tempAns[i].hasOwnProperty("drawing")
            ) {
              $scope.tempAns[i] = {
                ...$scope.tempAns[i],
                drawing: [],
              };
            }

            if (!$scope.tempAns[i].hasOwnProperty("lastUpdate")) {
              $scope.tempAns[i] = {
                ...$scope.tempAns[i],
                lastUpdate: new Date().getTime(),
              };
            }
          }
        } else {
          $scope.quizResponse.response[i].answerId = $scope.lock[i]
            ? $scope.tempAns[i]
            : -1;
        }
        $scope.quizResponse.response[i].tempAns = $scope.tempAns[i];
      }

      if (val == "save") {
        requestService
          .request("POST", true, "/saveResp", {
            examId: $rootScope.activeQuiz,
            saveType: savetype,
            resData: $scope.quizResponse,
            lastQue: lastQue,
          })
          .then(
            function (response) {
              var result = response.data;
              $rootScope.consoleData(result, "/saveResp-qc");
              $rootScope.updateTime(result.time);

              $scope.resquestSend = false; //work for resquest block
              if (result.status) {
                if (notify) {
                  helperService.notifyMsg(
                    "ti-save",
                    "success",
                    $scope.lang.msg_saveResponse,
                    "top",
                    "left"
                  );
                }
                //clear localstorage of current section
                $scope.clearCurrentSecLS();
              } else {
                requestService.dbErrorHandler(
                  result.error.code,
                  result.error.type
                );
              }
            },
            function (errorResponse) {
              $scope.resquestSend = false;
              $scope.serverErrorHandling(errorResponse);
            }
          );
      } else if (val == "exit") {
        requestService
          .request("POST", true, "/saveResp", {
            examId: $rootScope.activeQuiz,
            saveType: savetype,
            resData: $scope.quizResponse,
            exit: true,
            lastQue: lastQue,
          })
          .then(
            function (response) {
              var result = response.data;
              $rootScope.consoleData(result, "/saveResp-qc");
              $rootScope.updateTime(result.time);
              $scope.resquestSend = false;
              if (result.status) {
                //clear localstorage of current section
                $scope.clearCurrentSecLS();
                $timeout(()=>{ $scope.loggedOut(); },1000);
              } else {
                requestService.dbErrorHandler(
                  result.error.code,
                  result.error.type
                );
              }
            },
            function (errorResponse) {
              $scope.resquestSend = false;
              $scope.serverErrorHandling(errorResponse);
            });
      } else if (val == "submit") {
        $scope.isLoad = false;
        $scope.submitBtnClick = true;
        $(".pageLoader").fadeIn("slow");

        $scope.clearTimer();
        $scope.clearNotifyAlert();
        //save
        requestService.request("POST", true, "/saveResp", {
            examId: $rootScope.activeQuiz,
            saveType: savetype,
            resData: $scope.quizResponse,
            lastQue: lastQue,
          }).then(
            function (response) {
              var result = response.data;
              $rootScope.consoleData(result, "/saveResp-qc");
              $rootScope.updateTime(result.time);

              $scope.resquestSend = false;
              if (result.status) {
                //clear localstorage of current section
                $scope.clearCurrentSecLS();
                $scope.startQuiz("quiz");
                if (dataService.getData("ISSECTION")) {
                  //section quiz with single section will act as plain quiz
                  if ($scope.sections.length == 1) {
                    $scope.finalSubmit();
                  } else {
                    //if it is section quiz with more then 1 section then it will go to instruction page
                    $scope.submitBtnClick = false;
                    $location.path("/start");
                  }
                } else {
                  //plain quiz submit
                  $scope.finalSubmit();
                }
              } else {
                $scope.submitBtnClick = false;
                requestService.dbErrorHandler(
                  result.error.code,
                  result.error.type
                );
              }
            },
            function (errorResponse) {
              $scope.resquestSend = false;
              $scope.submitBtnClick = false;
              $scope.serverErrorHandling(errorResponse);
            }
          );
      }
    };

    //it redirect to quiz-summary from routing -routes.js
    $scope.goToSummary = function () {
      // $location.path("/quiz-summary");
      $scope.clearNotifyAlert();
      $scope.startQuiz("quiz");
      $location.path("/start");
    };

    $scope.saveAndExit = function () {
      //it stop simaltaneous request
      if ($scope.resquestSend) {
        return;
      }
      //end of simultaneous request
      $("#exitSec").button("loading");
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

        if ($scope.questions[i].type == "sub") {
          //if lock then put 1 in anwserid in case of sub
          $scope.quizResponse.response[i].answerId = $scope.lock[i] ? 1 : -1;
          //generate blank response
          if ($scope.tempAns[i] !== -1) {
            if (
              $scope.questions[i].object.limit == 0 ||
              !$scope.tempAns[i].hasOwnProperty("text")
            ) {
              $scope.tempAns[i] = {
                ...$scope.tempAns[i],
                text: "",
              };
            }

            if (
              $scope.questions[i].object.allowedDrawings == 0 ||
              !$scope.tempAns[i].hasOwnProperty("drawing")
            ) {
              $scope.tempAns[i] = {
                ...$scope.tempAns[i],
                drawing: [],
              };
            }

            if (!$scope.tempAns[i].hasOwnProperty("lastUpdate")) {
              $scope.tempAns[i] = {
                ...$scope.tempAns[i],
                lastUpdate: new Date().getTime(),
              };
            }
          }
        } else {
          $scope.quizResponse.response[i].answerId = $scope.lock[i]
            ? $scope.tempAns[i]
            : -1;
        }
        $scope.quizResponse.response[i].tempAns = $scope.tempAns[i];
      }

      if ($scope.mode == "quiz") {
        $scope.resquestSend = true;
        requestService
          .request("POST", true, "/saveResp", {
            examId: $rootScope.activeQuiz,
            saveType: "exitQuizSection",
            resData: $scope.quizResponse,
            lastQue: currentPage,
            exit: true,
          })
          .then(
            function (response) {
              var result = response.data;
              $rootScope.consoleData(result, "/saveResp-qc");
              $rootScope.updateTime(result.time);
              $scope.resquestSend = false;
              $(".modal").modal("hide");
              if (result.status) {
                //clear localstorage of current section
                $scope.clearCurrentSecLS();
                if ($("html").hasClass("nav-open")) {
                  $(".navbar-toggle").click();
                }
                $("#exitSec").button("reset");
                $scope.clearTimer();
                $scope.startQuiz("quiz");
                $location.path("/start");
              } else {
                $("#exitSec").button("reset");
                requestService.dbErrorHandler(
                  result.error.code,
                  result.error.type
                );
              }
            },
            function (errorResponse) {
              $(".modal").modal("hide");
              $("#exitSec").button("reset");
              console.log("Server Error");
              console.log(errorResponse);
              $scope.resquestSend = false;
            }
          );
      } else {
        if ($("html").hasClass("nav-open")) {
          $(".navbar-toggle").click();
        }
        $("#exitSec").button("reset");
        $scope.clearTimer();
        $scope.startQuiz("quiz");
        $location.path("/start");
      }
    };

    //get summary of the quiz
    $scope.showSumm = false;
    $scope.getSummary = function () {
      var finaldate = new Date($scope.getClock());
      $scope.summary = [];
      for (var i = 0; i < 2; i++) {
        $scope.summary.push(0);
      }
      for (var i = 0; i < $scope.totalItems; i++) {
        if ($scope.answSelected[i] == -1) $scope.summary[0]++;
        else $scope.summary[1]++;
      }
      $scope.showSumm = true;
      $scope.timeTakenToComplete =
        $scope.hh + ":" + $scope.mm + ":" + $scope.ss;
    };

    //validate that all input tag is filled and then lock is preessed. For Fill in the blank type.
    $scope.validateForm = function () {
      var inputCount = document
        .getElementById("divFillInBlank")
        .getElementsByTagName("input").length; //get the number of input tags
      var temp = false;
      let fillIn = "allBlank";
      for (var i = 0; i < inputCount; i++) {
        var name = document
          .getElementById("divFillInBlank")
          .getElementsByTagName("input")
          [i].getAttribute("name");
        var value = document.getElementsByName(name)[0].value;
        if (value === "") {
          temp = true;
        } else {
          fillIn = "partialFill";
        }
      }

      let obj = {
        status: false,
        msg: "",
      };
      //partial grading is allow
      if ($scope.sectData.partialGrading) {
        if (fillIn == "partialFill") {
          obj.status = true;
        } else {
          obj.status = false;
          if (inputCount == 1) {
            obj.msg = $scope.lang.alert_FillIN;
          } else {
            obj.msg = $scope.lang.alert_FillINPartial;
          }
        }
      } else {
        if (temp) {
          obj.status = false;
          obj.msg = $scope.lang.alert_FillIN;
        } else {
          obj.status = true;
        }
      }
      return obj;
    };

    // Important function. Lock==> perform acc to question type.
    $scope.Lock = function () {
      if (!dataService.getData("ISSECTION")) {
        $scope.autoSave(); //Auto save
      }

      if ($scope.questions[$scope.currentPage - 1].type == "fillIn") {
        if ($scope.lock[$scope.currentPage - 1]) {
          // toggle lock. if lock is already pressed. unlock the lock.
          $scope.selectAns($scope.currentPage, -1); //make answer = -1
          $scope.lock[$scope.currentPage - 1] = false; //set value of lock = false
          $(".fillInOption").removeClass("disable-block");
        } else {
          //lock the answer.

          let lockData = $scope.validateForm();
          if (!lockData.status) {
            let option = {
              placement: {
                from: "top",
                align: "center",
              },
              delay: 2000,
            };
            $scope.notifyAlertMsg("lock", lockData.msg, option);
            $scope.lock[$scope.currentPage - 1] = false;
          } else {
            $(".fillInOption").addClass("disable-block");
            var inputCount = document
              .getElementById("divFillInBlank")
              .getElementsByTagName("input").length;
            var temp = {};
            for (var i = 0; i < inputCount; i++) {
              var name = document
                .getElementById("divFillInBlank")
                .getElementsByTagName("input")
                [i].getAttribute("name");
              var type = document
                .getElementById("divFillInBlank")
                .getElementsByTagName("input")
                [i].getAttribute("type");
              var value = document.getElementsByName(name)[0].value;
              if (type == "number") {
                value = parseFloat(value);
                temp[name] = value;
              } else if (type == "text") {
                temp[name] = value;
              }
            }
            $scope.selectAns($scope.currentPage, temp);
            var newtemp = JSON.stringify(temp);
            $scope.tempAns[$scope.currentPage - 1] = JSON.parse(newtemp);
            $scope.lock[$scope.currentPage - 1] = true;
          }
        }
      } else if ($scope.questions[$scope.currentPage - 1].type == "arrange") {
        // For arrange type questions.
        if ($scope.lock[$scope.currentPage - 1]) {
          //toggle lock. if lock is already pressed. unlock the lock.
          //multiply the answer with -1 to represent it as skipped question
          var tmp = angular.copy($scope.swapOptions);
          for (var i = 0; i < tmp.length; i++) {
            tmp[i] = tmp[i] * -1;
          }
          $scope.selectAns($scope.currentPage, tmp);
          $scope.lock[$scope.currentPage - 1] = false;
        } else {
          var tmp = [];
          tmp = $scope.swapOptions;
          for (var i = 0; i < tmp.length; i++) {
            tmp[i] = Math.abs(tmp[i]);
          }
          $scope.selectAns($scope.currentPage, $scope.swapOptions);

          $scope.tempAns[$scope.currentPage - 1] = $scope.swapOptions;
          $scope.lock[$scope.currentPage - 1] = true;
        }
      } else if ($scope.questions[$scope.currentPage - 1].type == "mcq") {
        if ($scope.lock[$scope.currentPage - 1]) {
          $scope.lock[$scope.currentPage - 1] = false;
          $scope.selectAns($scope.currentPage, -1);
        } else {
          if ($scope.tempAns[$scope.currentPage - 1] == -1) {
            let option = {
              placement: {
                from: "top",
                align: "center",
              },
              delay: 2000,
            };
            $scope.notifyAlertMsg("lock", $scope.lang.alert_mcqSelect, option);
          } else {
            $scope.lock[$scope.currentPage - 1] = true;
            $scope.selectAns(
              $scope.currentPage,
              $scope.tempAns[$scope.currentPage - 1]
            );
          }
        }
      } else if ($scope.questions[$scope.currentPage - 1].type == "info") {
        if ($scope.lock[$scope.currentPage - 1]) {
          $scope.lock[$scope.currentPage - 1] = false;
          $scope.selectAns($scope.currentPage, -1);
        } else {
          $scope.lock[$scope.currentPage - 1] = true;
          $scope.selectAns(
            $scope.currentPage,
            $scope.tempAns[$scope.currentPage - 1]
          );
        }
      } else if ($scope.questions[$scope.currentPage - 1].type === "sub") {
        $scope.subDBStatus = "none";
        $scope.clearNotifyAlert("maxSubShape");

        if ($scope.lock[$scope.currentPage - 1]) {
          $scope.lock[$scope.currentPage - 1] = false;
          $scope.selectAns($scope.currentPage, -1);
          $scope.reloadCkEditor();
          // if (CKEDITOR.instances.editor) {
          //     CKEDITOR.instances.editor.setReadOnly(false);
          // }
        } else {
          if ($scope.tempAns[$scope.currentPage - 1] != -1) {
            //validation for charater count
            if (
              "text" in $scope.tempAns[$scope.currentPage - 1] &&
              $scope.filteredQuestions[0].object.limit > 0
            ) {
              let charCount = $scope.countCharacter(
                $scope.tempAns[$scope.currentPage - 1]["text"]
              );
              if (charCount > $scope.filteredQuestions[0].object.limit) {
                $scope.notifyAlertMsg("ck", $scope.lang.alert_subjective_limit);
                return;
              }
            }

            if (
              $scope.filteredQuestions[0].object.limit == 0 ||
              !$scope.tempAns[$scope.currentPage - 1].hasOwnProperty("text")
            ) {
              $scope.tempAns[$scope.currentPage - 1] = {
                ...$scope.tempAns[$scope.currentPage - 1],
                text: "",
              };
            }

            if (
              $scope.filteredQuestions[0].object.allowedDrawings == 0 ||
              !$scope.tempAns[$scope.currentPage - 1].hasOwnProperty("drawing")
            ) {
              $scope.tempAns[$scope.currentPage - 1] = {
                ...$scope.tempAns[$scope.currentPage - 1],
                drawing: [],
              };
            }
          } else {
            $scope.tempAns[$scope.currentPage - 1] = {
              text: "",
              drawing: [],
              lastUpdate: new Date().getTime(),
            };
          }

          $scope.lock[$scope.currentPage - 1] = true;
          // if (CKEDITOR.instances.editor) {
          //     CKEDITOR.instances.editor.setReadOnly(true);
          // }
          $scope.selectAns($scope.currentPage, 1);
        }
      }
    };

    // =============== lock toggle is only for mcq type.
    $scope.lockToggle = function (ansId) {
      var temp = ansId;
      if (document.getElementById(temp).checked) {
        $scope.lock[$scope.currentPage - 1] = true;
        $scope.selectAns($scope.currentPage, ansId);
        //This store temporary ans
        $scope.tempAns[$scope.currentPage - 1] = ansId;
      } else {
        $scope.lock[$scope.currentPage - 1] = false;
        $scope.selectAns($scope.currentPage, -1);
      }

      if (!dataService.getData("ISSECTION")) $scope.autoSave(); //Auto save
    };

    // Add different type of question and thier template url here.
    $scope.quizOptions = [
      { url: "app/views/Options/mcq.html?v=" + version },
      { url: "app/views/Options/arrange.html?v=" + version },
      { url: "app/views/Options/fill.html?v=" + version },
      { url: "app/views/Options/info.html?v=" + version },
      { url: "app/views/Options/subjective.html?v=" + version },
    ];
    //ARRANGE TYPE
    $scope.flag = false;
    $scope.ToID = -1; //it will contain the option number to swap
    $scope.FromID = -1; //it will contain the option number from swap
    $scope.flag2 = false;
    $scope.isFlag = function () {
      return $scope.flag;
    };

    //-------SWAP FUNCTION BY SLIDING-----------
    $scope.sortListItems = function () {
      $("#arrOptions").sortable({
        update: function (event, ui) {
          $scope.getArray();
        },
        placeholder: "highlight",
      });
    };

    $scope.getArray = function () {
      var temp = $("#arrOptions").sortable("toArray");
      for (var i = 0; i < temp.length; i++) {
        temp[i] = Math.abs(temp[i]);
      }
      $scope.arrangeType[$scope.currentPage - 1] = temp;
      $scope.selectAns(
        $scope.currentPage,
        $scope.arrangeType[$scope.currentPage - 1]
      ); //set the answer in our answer array.
      $scope.tempAns[$scope.currentPage - 1] =
        $scope.arrangeType[$scope.currentPage - 1];
      $scope.lock[$scope.currentPage - 1] = true; // mark the question answered.
    };

    $scope.getType = function (id) {
      var index = 0;
      //MCQ Type Question
      if ($scope.questions[id - 1].type == "mcq") index = 0;
      //FillIn Type Question
      if ($scope.questions[id - 1].type == "fillIn") {
        index = 2;
        // its temporary to make the change of color of question number when answered
      }
      //Example Type Question
      if ($scope.questions[id - 1].type == "info") {
        index = 3;
      }
      //Arrange Type Question
      if ($scope.questions[id - 1].type == "arrange") {
        index = 1;
        $scope.swapOptions = $scope.arrangeType[$scope.currentPage - 1];
      }
      // for arrange
      return index;
    };

    // returns the template source of question with given id
    $scope.getQuestionTemplateName = (id) => {
      // template sources
      let templList = {
        mcq: "app/views/Options/mcq.html?v=" + version,
        fillIn: "app/views/Options/fill.html?v=" + version,
        arrange: "app/views/Options/arrange.html?v=" + version,
        info: "app/views/Options/info.html?v=" + version,
        sub: "app/views/Options/subjective.html?v=" + version,
      };
      // for arrangement type question , set swapOptions also
      if ($scope.questions[id - 1].type == "arrange") {
        $scope.swapOptions = $scope.arrangeType[$scope.currentPage - 1];
      }
      return templList[$scope.questions[id - 1].type];
    };

    $scope.getReviewTemplate = () => {
      return `app/views/gradingReview.html?v=${version}`;
    };

    // FillIn type functions start here
    $scope.saveFillIn = function () {
      var inputCount = document
        .getElementById("divFillInBlank")
        .getElementsByTagName("input").length;
    };

    $scope.AppendText = function () {
      var myEl = angular.element(document.querySelector("#divID"));
      myEl.append($scope.filteredQuestions[0].object.statement);
    };

    //Logged Out
    $scope.loggedOut = function () {
      dataService.loggoutWithReason("loggedOut");
    }; //End Logged Out

    //Verifing token
    $scope.verifyToken = function () {
      //if (+dataService.getData('LOGGEDIN') == 1) {
      var lastQuestion = $scope.currentPage;
      requestService
        .request("POST", true, "/verifyToken", {
          userId: dataService.getData("USER"),
          quizId: dataService.getData("QUIZID"),
          lastQuestion: lastQuestion,
        })
        .then(
          function (response) {
            var result = response.data;
            $rootScope.consoleData(result, "/verifyToken-qc");
            $rootScope.updateTime(result.time);

            if (!result.status) {
              dataService.swalAndRedirect(
                $scope.lang.alert_sessionExpired,
                "warning",
                "btn-warning",
                "loggedOutSessionExpired"
              );
            }
          },
          function (err) {
            var msg = $scope.lang["alert_unable_connect"];
            dataService.swalAndRedirect(
              msg,
              "warning",
              "btn-warning",
              "loggedOutSessionExpired"
            );
          }
        );
      //}
    };

    //Expand function
    $scope.expand = function (name) {
      var obj = $("input[name='" + name + "']");
      obj.css("width", (obj.val().toString().length + 8) * 8 + "px");
    };

    //Resize Block For arrange qus
    $scope.resizeBlock = function () {
      $("#qusBlock").resizable({ minHeight: 258 });
    };

    //For load calculaor
    $scope.calc = function () {
      $("#calc").css("display", "block");
      $("#display").focus();
    };

    $scope.showSubmitBtn = function () {
      var isSection = dataService.getData("ISSECTION");
      var attempt = dataService.getData("ATTEMPT");
      if (isSection == true) {
        //section quiz with one section will act as plain quiz
        if ($scope.sections.length == 1) {
          if (attempt == true) return true;
          else return false;
        } else return true;
      } else {
        if (attempt == true) return true;
        else return false;
      }
    };

    $scope.showExitBtn = function () {
      var isSection = dataService.getData("ISSECTION");
      if (isSection == true) {
        //section quiz with one section will act as plain quiz
        if ($scope.sections.length == 1) {
          return false;
        } else return true;
      } else return false;
    };

    $scope.$on("changeUILanguage", function (e, data) {
      $scope.lang = data.language;
      if (typeof Storage !== "undefined") {
        if (sessionStorage.language) {
          $scope.langName = sessionStorage.language;
        }
      }
    });

    $scope.$on("onFocusOutWin", function (e, data) {
      if (data.hash == "/quiz") {
        if (+dataService.getData("LOGGEDIN") == 1 && $scope.mode == "quiz") {
          $scope.onFinish($scope.currentPage);
          $scope.saveResponse("save", "saveBeforeFocusOut", false);
          $scope.clearTimer();
        }
      }
    });

    // on direct window close but it is not accurrate
    // $scope.onExit = function() {

    // };
    // $window.onbeforeunload =  $scope.onExit;

    $scope.showUserDetail = function (prop) {
      return dataService.isShowUserDetail(prop);
    };

    $scope.checkLoginEmail = function(){
      return  ($scope.mode == "review" && sessionStorage.getItem('loginToken'))?true:false;
    }

  },
]);
