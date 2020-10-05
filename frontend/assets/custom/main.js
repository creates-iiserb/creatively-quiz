$(document).ready(function () {
	    if($('[data-toggle="tooltip"]').length>0)
		$('[data-toggle="tooltip"]').tooltip();

		//this one line will disable the right mouse click menu  
		$(document)[0].oncontextmenu = function () { return false; }
		$(document).keydown(function (event) {
			var pressedKey = String.fromCharCode(event.keyCode).toLowerCase();
			if (event.ctrlKey && (pressedKey == "c" || pressedKey == "u")) {
				return false;
			}
			if (event.ctrlKey && event.shiftKey && (pressedKey == "i" || pressedKey == "J")) {
				return false;
			}
			if (pressedKey == "{") {
				return false;
			}
		});
	});

	function isNumber(evt) {
		evt = (evt) ? evt : window.event;
		var charCode = (evt.which) ? evt.which : evt.keyCode;
		if (charCode > 57) {
			return false;
		}
		return true;
	}

	function expand(obj) {
		obj.style.width = ((obj.value.length + 8) * 8) + 'px';
	}

	document.onkeydown = function (e) {
		if (e.keyCode == 123) {			
			return false;
		}
		if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) {
			return false;
		}
		if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) {
			return false;
		}
		if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) {
			return false;
		}
	}

	var plotlyToggle = 1;
	function zoomPlotlyToggle(id) {
		if (plotlyToggle == 0) {
			plotlyToggle = 1;
			$(".sidebar").css("z-index", "3");
			$("#" + id).removeClass('plotly-overlay');
		} else {
			plotlyToggle = 0;
			$(".sidebar").css("z-index", "0");
			$("#" + id).addClass('plotly-overlay');
		}
	}





function initJS(quizMode){

	/////////review mode///////////
	if(quizMode=='review'){ 		
		if($('#arrOptions').length>0)
		{
			$("#arrOptions").sortable({
				cancel: ".static"
			});
			$('#arrOptions').addClass("static");

		}

		if($('#inputBlankNumber').length>0)
		{	
			$('[id=inputBlankNumber]').prop("disabled", true);
		}

		if($('#inputBlankText').length>0)
		{	
			$('[id=inputBlankText]').prop("disabled", true);
		}
		
	}
	
	if(quizMode=='quiz'){
		if($('#inputBlankNumber').length>0)
		{	
			$('[id=inputBlankNumber]').prop("disabled", false);
		}

		if($('#inputBlankText').length>0)
		{	
			$('[id=inputBlankText]').prop("disabled", false);
		}

	}


	
    /////////common mode//////////
	if($('.flipbtn').length>0){   
		$('.flipper').removeClass('active');
		
		window.setTimeout(function() {
		  $(".flipbtn").unbind().click(function() {
			$(this).parents(".flipper").toggleClass("active");
		  });
		  let flipEle = document.getElementById('flipElement');
		  if(flipEle){
			flipEle.style.visibility = 'visible';
		  }
		}, 500);		
		 
	}

}


function onImgLoadError(ele){
   ele.setAttribute('src','assets/img/defaultuser.png')
}






