
//DRAG FUNCTION
$(function () {
  if($("#calc").length>0){
    $("#calc").draggable({
      containment: "parent"
    });
  }  
});

$(window).resize(function () {
  if( $("#calc").length>0 && $("#calc").css('display') != "none" ){
  $("#calc").draggable("option", "refreshPositions", true);
  }
});

if($("#calc").length>0){
$('#calc').draggable();
}


//GET CURSOR POSITION
(function ($, undefined) {
  $.fn.getCursorPosition = function () {
    var el = $(this).get(0);
    var pos = 0;
    if ('selectionStart' in el) {
      pos = el.selectionStart;
    } else if ('selection' in document) {
      el.focus();
      var Sel = document.selection.createRange();
      var SelLength = document.selection.createRange().text.length;
      Sel.moveStart('character', -el.value.length);
      pos = Sel.text.length - SelLength;
    }
    return pos;
  }
})(jQuery);


//DEL BUTTON
function del(){
  var btnVal = $('#display').val();
  var strChar = "";
  var cursorPosition = $('#display').getCursorPosition();
  //console.log(cursorPosition);
  if (cursorPosition == 0) {

  }
  else {
    strChar = setCharAt(btnVal, cursorPosition - 1, '');
    setCaretToPos($('#display').val(strChar)[0], cursorPosition - 1);
    $("#display").val(strChar);
  }
}
// $("#del").on("click", function () {
  //   var btnVal = $('#display').val();
  //   var strChar = "";
  //   var cursorPosition = $('#display').getCursorPosition();
  //   console.log(cursorPosition);
  //   if (cursorPosition == 0) {
  
  //   }
  //   else {
  //     strChar = setCharAt(btnVal, cursorPosition - 1, '');
  //     setCaretToPos($('#display').val(strChar)[0], cursorPosition - 1);
  //     $("#display").val(strChar);
  //   }
  // });


function setCharAt(str, index, chr) {
  if (index > str.length - 1) 
  return str;
  return str.substr(0, index) + chr + str.substr(index + 1);
}



//CURSOR BETWEEN PARENTHESES FUNCTION
function setSelectionRange(input, selectionStart, selectionEnd) {
  if (input.setSelectionRange) {
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
  } else if (input.createTextRange) {
    var range = input.createTextRange();
    range.collapse(true);
    range.moveEnd('character', selectionEnd);
    range.moveStart('character', selectionStart);
    range.select();
  }
}

function setCaretToPos(input, pos) {
  setSelectionRange(input, pos, pos);
}

// 
function getindex(ind, thisVal){
  var btnVal = $('#display').val() + thisVal;
    addAtCursor("display", thisVal);
    var btnVal = $('#display').val();
    var getp = btnVal.indexOf(ind);
   // console.log(getp);
    var resJson = {};
    resJson["getp"] = getp;
    resJson["btnVal"] =btnVal;
    return resJson;
}

//FUNCTION KEYS CURSOR POSITION
$().ready(function () {
  $('body').on('click', '.cursor', function () {
    var thisVal = $(this).val();
    var getI = getindex("()",thisVal);
    setCaretToPos($('#display').val(getI.btnVal)[0], getI.getp + 1);
  }); 
});
//End of cursor between parentheses


//X^Y AND 10^X KEYS CURSOR POSITION
function toPower(thisVal){
  var getI = getindex("x",thisVal);
  setCaretToPos($("#display").val(getI.btnVal)[0], getI.getp+1);
} 

function toMod(thisVal){
  var getI = getindex("x",thisVal);
  setCaretToPos($("#display").val(getI.btnVal)[0], getI.getp+1);
} 
// $(".powten").on("click", function(){
//   var thisVal = $(this).val();
//   var getI = getindex("x",thisVal);
//   setCaretToPos($("#display").val(getI.btnVal)[0], getI.getp+1);    
// });


//INSERT AT CURSOR POSITION FUNCTION
function addAtCursor(element, txt, curPos) {
  var whereTo = document.getElementById(element);

  if (document.selection) {
    whereTo.focus();
    sel = document.selection.createRange();
    sel.text = txt;
    return;
  } 

  if (whereTo.selectionStart || whereTo.selectionStart == "0") {
    var t_start = whereTo.selectionStart;
    var t_end = whereTo.selectionEnd;
    var val_start = whereTo.value.substring(0, t_start);
    var val_end = whereTo.value.substring(t_end, whereTo.value.length);
    whereTo.value = val_start + txt + val_end;
    
    setCaretToPos($('#display').val($('#display').val())[0], curPos+txt.toString().length);
  } else {
    whereTo.value += txt;
  }
}


// // INSERT AT CURSOR POSITION : NUM KEYS
$("body").on("click", ".posit", function () {
  var curPos = $('#display').getCursorPosition();
  let g = $(this).val();
  addAtCursor("display", g, curPos); 
});

// function numInsert(){
//   var curPos = $('#display').getCursorPosition();
//   let g = $(this).val();
//   addAtCursor("display", g, curPos); 
// }



//PI BUTTON
function piVal(){
  let g = math.PI;
  var curPos = $('#display').getCursorPosition();
  addAtCursor("display", g, curPos);
  var btnVal = $('#display').val();
}
// $("body").on("click", ".pie", function () {
//   let g = math.PI;
//   var curPos = $('#display').getCursorPosition();
//   addAtCursor("display", g, curPos);
//   var btnVal = $('#display').val();
// });




//OUTPUT AT CURSOR POSITION
// $("#output").on('click', '#res', function () {
//   let a = $(this).text();
//   var curPos = $('#display').getCursorPosition();
//   addAtCursor('display', a, curPos);
//   $('#display').focus();
//   //console.log($("display").getCursorPosition());

// });

function outputAtCursor(id) {
  let a = $(id).text();
  var curPos = $('#display').getCursorPosition();
  addAtCursor('display', a, curPos);
  $('#display').focus();
}



//CALCULATION ON CLICK
var exp;
var result;

function calculate() {
  exp = $("#display").val(); //for exp history
  var calctype = $('#calcType').val();
  if(calctype == 'scientific')
  {
    try {
      //$("#err").html('');
      $("#display").css("background-color", "");
      result = parseFloat(math.eval(exp).toFixed(10));
      // $("#output").html(exp);
      $("#output").append("<div align=\"left\" class='red', id='res' onclick=\"outputAtCursor(this)\">" + exp + "</div>");
      $("#output").append("<div align=\"right\">= <span class='green', id='res' onclick=\"outputAtCursor(this)\">" + result + "</span></div>");
      $("#display").val('');
      $(".red").css("color", "red");
      $(".green").css("color", "green");
      $(".green").css("font-weight", "bold");
      $("#display").focus();
    } catch (err) {
      $("#display").val(exp);
      $("#display").focus();
      $("#display").css("background-color", "rgb(248, 209, 206)");
    }


  }

  if(calctype == 'basic')
  {
    exp = $.trim(exp);  
    exp = exp.toLowerCase();   
    var notAllowed = ['asin','acos','atan','sin','cos','tan','sqrt','cbrt','exp','log','log10','factorial','square','inv','abs','pow','mod'];
      
    for (i = 0;i< notAllowed.length; i++) {
      if(exp.indexOf(notAllowed[i])>-1)
      { 
        $("#display").val(exp);
        $("#display").focus();
        $("#display").css("background-color", "rgb(248, 209, 206)");
        return;
      } 
      
    }

    try {
      //$("#err").html('');
      $("#display").css("background-color", "");
      result = parseFloat(math.eval(exp).toFixed(10));
      // $("#output").html(exp);
      $("#output").append("<div align=\"left\" class='red', id='res' onclick=\"outputAtCursor(this)\">" + exp + "</div>");
      $("#output").append("<div align=\"right\">= <span class='green', id='res' onclick=\"outputAtCursor(this)\">" + result + "</span></div>");
      $("#display").val('');
      $(".red").css("color", "red");
      $(".green").css("color", "green");
      $(".green").css("font-weight", "bold");
      $("#display").focus();
    } catch (err) {
      $("#display").val(exp);
      $("#display").focus();
      $("#display").css("background-color", "rgb(248, 209, 206)");
    }
  
  }
  
}
//END CALCULATION ON CLICK


//CALCULATION ON ENTER
var currHeight = 0;  // to scroll down at the end to the latest output
var ht = 0;
function evalOnEnter(e) {
  if (e.keyCode == 13) { // the enter key code
    calculate();
    $("#output").animate({ scrollTop:ht }, "fast"); 
    ht += 150;
    // console.log(1)
    e.preventDefault();
    return false;
  }
}
// $('#display').keypress(function (e) {
  // if (e.keyCode == 13)  // the enter key code
  // {
  //   calculate();
  //   return false;
  // }
// });



//ANS BUTTON
function ansKey(){
  var dis= $('#display').val()+result;
  $('#display').val(dis);
}
// $('#answer').on('click', function () {
//   var dis= $('#display').val()+result;
//   $('#display').val(dis);
// });




//CLEAR SCREEN
function clearAll() {
  $("#output").html('');
  // $("#display").val('');
  $('#display').focus();
  $("#display").css("background-color", "");
}




//CLOSE BUTTON
function calcClose(){
  $("#output").html('');
  $("#display").val('');
  $('#anglesChk').prop('checked', false);
  $('#display').focus();
  $("#calc").fadeOut('slow');
}
// $('#close').on('click', function (c) {
//   $("#output").html('');
//   $("#display").val('');
//   $('#anglesChk').prop('checked', false);
//   $('#display').focus();
//   $(this).parents().fadeOut('slow', function (c) {
//   });
// });



//SHOW/HIDE KEYPAD
function keypadToggle(){
  $(".keypad").toggle();

  $('#display').focus();
  $('#button1, #button3').toggle();
  $('.keys').toggleClass("");
}
// $("#button2").click(function () {
//   $(".keypad").toggle();

//   $('#display').focus();
//   $('#button1, #button3').toggle();
//   $('.keys').toggleClass("");
// });



//AC BUTTON
function clearKey(){
  $("#display").val('');
  $("#display").focus();
  $("#display").css("background-color", "");
}
// $('#clear').on('click', function () {
//   $('#output').empty();
//   $('#display').val('');
//   $("#display").css("background-color", "");
// });

//keypad function
// $('.btn-light ').on('click', function () {
//   $('#display').focus();
// });




//Radians and degrees button
// angle configuration
var replacements = {};

// our extended configuration options
var config = {
  angles: 'deg' // 'rad', 'deg', 'grad'
};

if (typeof math !== "undefined") { 
  // create trigonometric functions replacing the input depending on angle config
  ['sin', 'cos', 'tan', 'sec', 'cot', 'csc'].forEach(function (name) {
    var fn = math[name]; // the original function

    var fnNumber = function (x) {
      // convert from configured type of angles to radians
      switch (config.angles) {
        case 'deg':
          return fn(x / 360 * 2 * Math.PI);
        case 'grad':
          return fn(x / 400 * 2 * Math.PI);
        default:
          return fn(x);
      }
    };

    // create a typed-function which check the input types
    replacements[name] = math.typed(name, {
      'number': fnNumber,
      'Array | Matrix': function (x) {
        return math.map(x, fnNumber);
      }
    });
  });

  // create trigonometric functions replacing the output depending on angle config
  ['asin', 'acos', 'atan', 'atan2', 'acot', 'acsc', 'asec'].forEach(function (name) {
    var fn = math[name]; // the original function

    var fnNumber = function (x) {
      var result = fn(x);

      if (typeof result === 'number') {
        // convert to radians to configured type of angles
        switch (config.angles) {
          case 'deg': return result / 2 / Math.PI * 360;
          case 'grad': return result / 2 / Math.PI * 400;
          default: return result;
        }
      }

      return result;
    };

    // create a typed-function which check the input types
    replacements[name] = math.typed(name, {
      'number': fnNumber,
      'Array | Matrix': function (x) {
        return math.map(x, fnNumber);
      }
    });
  });

  // import all replacements into math.js, override existing trigonometric functions
  math.import(replacements, { override: true });

}

// pointers to the input elements
var display = document.getElementById('display');
var evaluate = document.getElementById('evaluate');
var output = document.getElementById('output');
var angles = document.getElementById('angles');

// attach event handlers for select box and button
function changeAngle() {
  if (config.angles == 'deg') {
    config.angles = 'rad';
    $("#angles").html('RAD');
  } else {
    config.angles = 'deg';
    $("#angles").html('DEG');    
  }  
}

// evaluate.onclick = function () {
//   output.innerHTML = math.eval(display.value);
// };