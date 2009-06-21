var status;

function onLoad() {
    status = document.getElementById('status');
    println("Application initialized.");

    var tabbox = document.getElementById('main-tabs-list');
    var tabs = document.getElementById('main-tabs');
    var tabpanels = document.getElementById('main-panels');

    var list_file = Cc["@mozilla.org/file/directory_service;1"].
            getService(Ci.nsIProperties).get('CurProcD', Ci.nsIFile);
    list_file.append('tools.list');
    if (list_file.exists()) {
        var istream = Cc["@mozilla.org/network/file-input-stream;1"].
                createInstance(Ci.nsIFileInputStream);
        istream.init(list_file, 0x01, 0444, 0);
        istream.QueryInterface(Ci.nsILineInputStream);
        var line = {}, hasmore, lines = [];

        do {
            hasmore = istream.readLine(line);
            if (line.value.length)
                lines.push(line.value);
        } while (hasmore);
        
        lines.forEach(function (line) {
            var tabpanel = document.createElement('tabpanel');
            var iframe = document.createElement('iframe');
            var props = line.split(/\s*\t\s*/);
            var tool = props[0], name = props[1], chrome = props[2];
            tabpanel.setAttribute('orient', 'horisontal');
            tabpanel.setAttribute('flex', '1');
            iframe.setAttribute('src', chrome);
            iframe.setAttribute('flex', '1000');
            tabpanel.appendChild(iframe);

            tabs.appendItem(name);
            tabpanels.appendChild(tabpanel);
        });
    } else {
        list_file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666); 
    }

    if (tabbox.hasChildNodes())
        tabbox.selectedIndex = 0;
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
    println("Pricing activated.");
    openDialog("pricing.xul", "",
            "chrome,menubar,extra-chrome,toolbar,dialog=no,resizable");
}

function market() {
    println("Market activated.");
    openDialog("market.xul", "",
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
