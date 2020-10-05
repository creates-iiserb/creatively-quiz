//toggle show password button on login page
var isEyeOn = false;
$('.eye-btn').click(function () {
    if (isEyeOn) {
        isEyeOn = false;
        $('#pwd').attr('type', 'password');
        $('#eyeIcon').removeClass('fa-eye-slash').addClass('fa-eye');
    } else {
        isEyeOn = true;
        $('#pwd').attr('type', 'text');
        $('#eyeIcon').removeClass('fa-eye').addClass('fa-eye-slash');
    }
}
);
//Check CAPS Lock ON/OFF
//????
var isShiftPressed = false;
var isCapsOn = null;
$("#pwd").bind("keydown", function (e) {
    var keyCode = e.keyCode ? e.keyCode : e.which;
    if (keyCode == 16) {
        isShiftPressed = true;
    }
});
$("#pwd").bind("keyup", function (e) {
    var keyCode = e.keyCode ? e.keyCode : e.which;
    if (keyCode == 16) {
        isShiftPressed = false;
    }
    if (keyCode == 20) {
        if (isCapsOn == true) {
            isCapsOn = false;
            $(".capson-msg").hide(500);
        } else if (isCapsOn == false) {
            isCapsOn = true;
            $(".capson-msg").show(500);
        }
    }
});
$("#pwd").bind("keypress", function (e) {
    var keyCode = e.keyCode ? e.keyCode : e.which;
    if (keyCode >= 65 && keyCode <= 90 && !isShiftPressed) {
        isCapsOn = true;
        $(".capson-msg").show(500);
    } else {
        $(".capson-msg").hide(500);
    }
});


$('.navbar-toggle').click(function(){
    $("ul.navbar-nav").toggle(300);
});




