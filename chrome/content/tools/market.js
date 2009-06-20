const MarketService = initMarketService();

function initMarketService() {
    var marketPath = getCharPref('jaet.exports.dir');
    return Cc["@aragaer.com/eve-market-export/service;1"].
        getService(Ci.nsIEveMarketExportService).
        initWithPath(marketPath);
}

function marketOnLoad() {
}

function check_market() {
    dump("woof!\n");
}
