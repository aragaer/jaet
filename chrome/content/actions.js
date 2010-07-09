var status, tabbox;

function onLoad() {
    tabbox = document.getElementById('main-tabs-list')
    status = document.getElementById('status');
    println("Application initialized.");

    var view_list = document.getElementById('menu_View');
    var i;
    for (i = 0; i < view_list.itemCount; i++) {
        var item = view_list.getItemAtIndex(i);
        if (item.getAttribute('type') != 'checkbox')
            continue;
        var func = viewCmd(item);
        item.addEventListener('command', func, true);
        if (getBoolPref('jaet.panels_shown.'+item.getAttribute('panel'), false)) {
            item.setAttribute('checked', true);
            func();
        }
    }
}

function quit() {
    if (confirm("Really quit JAET?")) // TODO: use .properties
        doQuit(false);
}

function doQuit (aForceQuit) {
    var appStartup = Cc['@mozilla.org/toolkit/app-startup;1'].
            getService(Ci.nsIAppStartup);

    appStartup.quit(aForceQuit
            ? Ci.nsIAppStartup.eForceQuit
            : Ci.nsIAppStartup.eAttemptQuit);
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
    var features = "chrome,titlebar,toolbar,centerscreen" +
        (instantApply ? ",dialog=no" : ",modal");
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

function viewCmd(item) {
    var panel = item.getAttribute('panel');
    var chrome = item.getAttribute('chrome');
    var label = item.getAttribute('label');
    return function (aEvt) {
        var checked = item.getAttribute('checked');
        Prefs.setBoolPref('jaet.panels_shown.'+panel, checked == 'true');
        if (checked)
            openMainPanel(panel, label, chrome)
        else
            closeMainPanel(panel);
    }
}

const tabList = {
    __iterator__: function () {
        var t = tabbox.tabs.firstChild;
        var tp = tabbox.tabpanels.firstChild;
        while (tp) {
            yield {panel: tp, tab: t};
            t = t.nextSibling;
            tp = tp.nextSibling;
        }
    }
};

function findMainPanel(panel) {
    var i;
    for each (i in tabList)
        if (i.tab.value == panel)
            return i;
    return undefined;
}

function openMainPanel(panel, label, chrome) {
    var t = findMainPanel(panel);
    if (!t) {
        t = {
            panel:  document.createElement('tabpanel'),
            tab:    tabbox.tabs.appendItem(label, panel),
        };
        t.panel.setAttribute('flex', 1);
        var iframe = document.createElement('iframe');
        iframe.setAttribute('flex', 1);
        iframe.setAttribute('src', chrome);
        t.panel.appendChild(iframe);
        tabbox.tabpanels.appendChild(t.panel);
    }

    tabbox.selectedTab = t.tab;
    tabbox.selectedPanel = t.panel;
}

function closeMainPanel(panel) {
    var t = findMainPanel(panel);
    if (!t)
        return;

    var currentIndex = tabbox.selectedIndex;
    var index = tabbox.tabs.getIndexOfItem(t.tab);
    tabbox.tabpanels.removeChild(t.panel);
    tabbox.tabs.removeItemAt(index);

    if (currentIndex < index)
        return;

    if (index == 0 && tabbox.tabs.itemCount)
        tabbox.selectedIndex = 0;
    else
        tabbox.selectedIndex = currentIndex - 1;
}

