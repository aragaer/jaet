function onLoad() {
    println("Application initialized.");
}

function quit() {
    if (confirm(document.getElementById('quit-label').value))
        doQuit(false);
}

function doQuit (aForceQuit) {
    var appStartup = Cc['@mozilla.org/toolkit/app-startup;1'].
            getService(Ci.nsIAppStartup);

    appStartup.quit(aForceQuit
            ? Ci.nsIAppStartup.eForceQuit
            : Ci.nsIAppStartup.eAttemptQuit);
}

function pricing() {
    println("Preferences activated.");
    openDialog("pricing.xul", "",
            "chrome,menubar,extra-chrome,toolbar,dialog=no,resizable");
}

function setupPreferences() {
    println("Preferences activated.");
    openPreferences();
}

function setupApiKeys() {
    println("API keys activated.");
    openDialog("dialogs/api.xul", "",
            "chrome,menubar,extra-chrome,toolbar,dialog=no,resizable");
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
