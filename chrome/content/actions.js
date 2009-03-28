function onLoad() {
    println("Application initialized.");
}

function setupNetwork() {
    println("Network settings activated.");
    openPreferences('proxy');
}

function openExtManager() {
    println("Extension manager activated.");
    openDialog("chrome://mozapps/content/extensions/extensions.xul?type=extensions",
            "", "chrome,menubar,extra-chrome,toolbar,dialog=no,resizable");
}

function openPreferences(paneID) {
    var instantApply = getBoolPref("browser.preferences.instantApply", false);
    var features = "chrome,titlebar,toolbar,centerscreen"
            + (instantApply ? ",dialog=no" : ",modal");
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
            getService(Ci.nsIWindowMediator);
    var win = wm.getMostRecentWindow("Preferences");
    if (win) {
        win.focus();
        if (paneID) {
            var pane = win.document.getElementById(paneID);
            win.document.documentElement.showPane(pane);
        }
    } else 
        openDialog("dialogs/preferences.xul", "Preferences", features, paneID);
}

function onAbout (event) {
    println("onAbout activated.");
    window.openDialog("dialogs/about.xul", "_blank", "chrome,close,modal");
}
