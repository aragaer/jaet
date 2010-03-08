const Cc = Components.classes;
const Ci = Components.interfaces;
const Prefs = Cc["@mozilla.org/preferences-service;1"].
        getService(Ci.nsIPrefBranch);

Components.utils.import("resource://jaet/sqlite.jsm");
Components.utils.import("resource://jaet/api.jsm");

const MAIN = window.top;

function println(s) {
    dump(s + "\n");
}

function print(s) {
    dump(s);
}
            
function showError(objError) {
    var sMsg;

    with (objError) {
        sMsg = 'NAME: ' + name;
        sMsg += '\nMESSAGE: ' + message;
        sMsg += '\n\nFILE: ' + fileName;
        sMsg += '\nLINE: ' + lineNumber;        
    }
            
    alert(sMsg);
}

function printError(objError) {
    var sMsg;

    with (objError) {
        sMsg = 'NAME: ' + name;
        sMsg += '\nMESSAGE: ' + message;
        sMsg += '\n\nFILE: ' + fileName;
        sMsg += '\nLINE: ' + lineNumber;
    }
            
    println(sMsg);
}             
            
function getBoolPref(prefname, def) {
    try {
        return Prefs.getBoolPref(prefname);
    } catch (er) {
        return def;
    } 
}

function getCharPref(prefname, def) {
    try {
        return Prefs.getCharPref(prefname);
    } catch (er) {
        return def;
    } 
}

function printObj(obj) {
    var serializer = Cc["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Ci.nsIDOMSerializer);
    println(XML(serializer.serializeToString(obj)).toXMLString());
}

